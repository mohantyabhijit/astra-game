import { mkdirSync, writeFileSync } from "node:fs";
import { createGame, startGame, stepGame } from "../src/simulation.js";
import { garages } from "../src/district.js";
import { routeInput } from "./driving-helper.js";

const game = createGame();
startGame(game);
game.traffic = [];

// A deterministic pre-chase setup at a real garage approach. From the first
// simulation step onward, only ordinary driving input is supplied.
const area = garages[Number(process.env.COOLDOWN_AREA || 0)];
const car = game.vehicles.find((vehicle) => vehicle.id === "starter-jeep");
Object.assign(car, area.approach, {
  heading: Math.atan2(
    area.entrance.x - area.approach.x,
    -(area.entrance.z - area.approach.z),
  ),
  vx: 0,
  vz: 0,
  speed: 0,
});
Object.assign(game.player, car, {
  vx: Math.sin(car.heading) * 7,
  vz: -Math.cos(car.heading) * 7,
  speed: 7,
});
game.mode = "driving";
game.activeVehicleId = car.id;
const pedestrian = game.pedestrians[0];
Object.assign(pedestrian, game.player, { hit: false });

stepGame(game, {}, 1 / 60);
if (game.phase !== "pursuit")
  throw new Error("Pre-chase pedestrian collision did not start pursuit");

let route = game.guidance?.points.map((point) => ({ ...point })) || [];
let routeId = game.guidance?.destination?.id || "";
const cursor = { index: 1 };
const timeline = [
  { event: "pursuit", time: game.elapsed, player: position(game.player) },
];
let lastPhase = game.phase;
let reachedCover = false;

for (
  let frame = 0;
  frame < 60 * 120 && game.phase !== "free" && game.mode !== "foot";
  frame++
) {
  const destinationId = game.guidance?.destination?.id || "";
  if (destinationId !== routeId) {
    routeId = destinationId;
    route = game.guidance?.points.map((point) => ({ ...point })) || route;
    cursor.index = 1;
  }
  const input = routeInput(game, route, cursor);
  if ((game.guidance?.distance || Infinity) < 4) reachedCover = true;
  if (reachedCover) {
    input.forward = game.player.speed < -0.3;
    input.reverse = game.player.speed > 0.3;
    input.left = false;
    input.right = false;
    input.handbrake = true;
  } else if ((game.guidance?.distance || Infinity) < 18) {
    const speed = Math.hypot(game.player.vx, game.player.vz);
    input.forward = speed < 5;
    input.reverse = speed > 5.5;
    input.handbrake = (game.guidance?.distance || Infinity) < 5;
  }
  stepGame(game, input, 1 / 60);
  if (game.phase !== lastPhase) {
    timeline.push({
      event: game.phase,
      time: game.elapsed,
      player: position(game.player),
    });
    lastPhase = game.phase;
  }
  if (frame % 60 === 0)
    timeline.push({
      event: "sample",
      time: game.elapsed,
      phase: game.phase,
      hits: game.policeHits,
      nearestCop: game.nearestCop,
      destinationDistance: game.guidance?.distance,
      player: position(game.player),
    });
}

const result = {
  success: game.phase === "free" && game.escapes > 0,
  phase: game.phase,
  mode: game.mode,
  escapes: game.escapes,
  policeHits: game.policeHits,
  elapsed: game.elapsed,
  cooldownArea: game.cooldownArea,
  destination: game.guidance?.destination?.id,
  remaining: game.guidance?.distance,
  player: position(game.player),
  police: game.police.map((cop) => ({
    ...position(cop),
    visible: cop.visible,
  })),
  timeline,
};
if (!result.success)
  result.diagnosis =
    "Police enter or regain line of sight inside cover before the eight-second cooldown finishes, then deliver three impacts.";

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  `artifacts/integrated-cooldown-${area.id}.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;

function position(value) {
  return {
    x: value.x,
    y: value.y || 0,
    z: value.z,
    speed: Math.hypot(value.vx || 0, value.vz || 0),
  };
}
