import { createGame, startGame, stepGame } from "../src/simulation.js";
import { roadGraph } from "../src/navigation.js";
import { writeFileSync } from "node:fs";
import { walkTo, boardNearby, routeInput } from "./driving-helper.js";
const g = createGame();
startGame(g);
const mission = g.vehicles.find((v) => v.id === "mission-sports");
// Follow the connected public roads on foot from Merlion Park to the optional mission.
const approach = roadGraph.route(g.player, mission);
if (!approach) throw new Error("Mission unreachable from Merlion Park");
for (const waypoint of approach.points)
  if (!walkTo(g, waypoint)) throw new Error("Could not explore along the mission approach");
if (!walkTo(g, mission) || !boardNearby(g) || g.mission !== "active")
  throw new Error("Could not walk to and board the mission car");
let lastPhase = g.phase,
  events = [],
  route = [],
  routeId = "",
  cursor = { index: 1 };
for (
  let frame = 0;
  frame < 60 * 1800 && g.status === "running" && g.mission !== "complete";
  frame++
) {
  const destination = g.guidance?.destination;
  if (destination && destination.id !== routeId) {
    routeId = destination.id;
    route = g.guidance.points.map((p) => ({ ...p }));
    cursor.index = 1;
  }
  if (g.mode === "foot") {
    events.push({
      event: "respawn",
      time: g.elapsed,
      collected: g.collected.length,
    });
    if (!boardNearby(g)) throw new Error("Could not board after respawn");
    routeId = "";
    continue;
  }
  stepGame(g, routeInput(g, route, cursor), 1 / 60);
  if (g.phase !== lastPhase) {
    events.push({
      phase: g.phase,
      time: g.elapsed,
      x: g.player.x,
      z: g.player.z,
    });
    lastPhase = g.phase;
  }
}
const result = {
  status: g.status,
  mode: g.mode,
  mission: g.mission,
  phase: g.phase,
  collected: g.collected.length,
  escapes: g.escapes,
  policeHits: g.policeHits,
  collisions: g.collisions,
  elapsed: g.elapsed,
  player: g.player,
  destination: g.guidance?.destination?.id,
  remaining: g.guidance?.distance,
  events,
};
console.log(JSON.stringify(result, null, 2));
writeFileSync(
  "artifacts/integrated-mission-loop.json",
  JSON.stringify(result, null, 2),
);
if (g.mission !== "complete" || g.collected.length !== 24) process.exitCode = 1;
