import {carPoint} from '../src/boarding.js';
import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  startGame,
  stepGame,
  triggerPursuit,
  hasLineOfSight,
  togglePause,
  makeVehicle,
  interact,
  selectCharacter,
  COOLDOWN_SECONDS,
  EXPLOSION_SECONDS,
} from "../src/simulation.js";
import {
  gems,
  garages,
  circuit,
  CIRCUIT_LENGTH,
  SPAWN,
  MERLION,
  inWater,
  MISSIONS,
  POLICE_STATION,
  policeStationCollider,
  parkFurniture,
  atCircuit,
  closestRoad,
} from "../src/district.js";
import { roadGraph } from "../src/navigation.js";
import {
  driveableConnector,
  resolveWorldCollision,
} from "../src/collision-world.js";
const tick = (g, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) stepGame(g, input, 1 / 60);
};
function finishTransition(g){
  for(let i=0;i<1200&&g.transition;i++)stepGame(g,{},1/60);
  assert.equal(g.transition,null,'boarding or exit must finish within 20 seconds');
}
function board(g, id = "starter-jeep") {
  const v = g.vehicles.find((x) => x.id === id);
  Object.assign(g.player, carPoint(v,2.3,-.98));
  assert.equal(interact(g), true);
  finishTransition(g);
  assert.equal(g.mode, "driving");
  return v;
}
function pursuitGame() {
  const g = createGame();
  startGame(g);
  g.traffic = [];
  board(g);
  assert.equal(triggerPursuit(g), true);
  // These fixtures exercise an already active pursuit; response timing has its own tests.
  g.pursuitDelay=0;
  return g;
}
function parkedScenario() {
  const g = pursuitGame();
  Object.assign(g.player, garages[0].inside, { vx: 0, vz: 0, speed: 0 });
  g.police.forEach((c, i) =>
    Object.assign(c, {
      x: 500 + i * 20,
      z: 0,
      lastSeen: { x: 500 + i * 20, z: 0 },
      pathTimer: 100,
    }),
  );
  return g;
}

test("2026 circuit, mission, police access and navigation edges are driveable", () => {
  assert.equal(Math.round(CIRCUIT_LENGTH), 4927);
  assert.ok(circuit.length > 400);
  for (const e of roadGraph.edges)
    assert.ok(
      driveableConnector(roadGraph.nodes[e.a], roadGraph.nodes[e.b]),
      e.road.id,
    );
  assert.ok(roadGraph.route(SPAWN, MISSIONS[0]));
  assert.ok(roadGraph.route(SPAWN, POLICE_STATION));
  assert.equal(policeStationCollider.kind, "police-station");
});
test("character selection is limited to the two available characters before play", () => {
  const g = createGame();
  assert.equal(g.mode, "foot");
  assert.equal(g.mission, "available");
  assert.equal(g.phase, "free");
  assert.ok(Math.hypot(g.player.x - MERLION.x, g.player.z - MERLION.z) < 60);
  assert.equal(inWater(g.player), false);
  assert.equal(selectCharacter(g, "rae"), true);
  assert.equal(g.character, "rae");
  assert.equal(selectCharacter(g, "unknown"), false);
  startGame(g);
  assert.equal(selectCharacter(g, "kai"), false);
});
test("player starts beside a car, boards and exits the persistent vehicle after stopping", () => {
  const g = createGame();
  startGame(g);
  assert.equal(interact(g), true);
  finishTransition(g);
  const v = g.vehicles.find((x) => x.id === g.activeVehicleId);
  tick(g, 0.5, { forward: true });
  assert.equal(v.x, g.player.x);
  assert.equal(interact(g), false);
  tick(g, 1, { reverse: true });
  g.player.vx = g.player.vz = g.player.speed = 0;
  assert.equal(interact(g), true);
  finishTransition(g);
  assert.equal(g.mode, "foot");
  assert.equal(g.activeVehicleId, null);
  assert.ok(distance2(g.player, v) > 2);
});
test("mission only starts by boarding the designated sports car", () => {
  const g = createGame();
  startGame(g);
  board(g);
  assert.equal(g.mission, "available");
  interact(g);
  finishTransition(g);
  const mission = g.vehicles.find((v) => v.id === MISSIONS[0].vehicleId);
  Object.assign(g.player, carPoint(mission,2.3,-.98));
  interact(g);
  finishTransition(g);
  assert.equal(g.mission, "active");
  assert.equal(g.guidance.kind, "gem");
});
test("gems collect only in the active mission and completion leaves free roam running", () => {
  const g = createGame(gems.slice(0, -1).map((x) => x.id));
  startGame(g);
  const mission = g.vehicles.find((v) => v.missionVehicle);
  Object.assign(g.player, carPoint(mission,2.3,-.98));
  interact(g);
  finishTransition(g);
  g.collected = gems.slice(0, -1).map((x) => x.id);
  Object.assign(g.player, gems.at(-1), { vx: 0, vz: 0 });
  stepGame(g, {}, 1 / 60);
  assert.equal(g.mission, "complete");
  assert.equal(g.status, "running");
  assert.equal(g.collected.length, 24);
});
test("a moving vehicle hitting a pedestrian starts pursuit without changing mission progress", () => {
  const g = createGame();
  startGame(g);
  g.traffic = [];
  board(g, MISSIONS[0].vehicleId);
  g.collected = ["gem-1"];
  g.player.vx = 6;
  g.player.speed = 6;
  const p = g.pedestrians[0];
  Object.assign(p, g.player, { hit: false });
  stepGame(g, {}, 1 / 60);
  assert.equal(g.phase, "pursuit");
  assert.equal(g.collected.length, 1);
  assert.ok(g.police.every((c) => c.visible));
});
test("a stationary overlap with a pedestrian does not start pursuit", () => {
  const g = createGame();
  startGame(g);
  g.traffic = [];
  board(g);
  const p = g.pedestrians[0];
  Object.assign(p, g.player, { hit: false });
  g.player.vx = g.player.vz = g.player.speed = 0;
  stepGame(g, {}, 1 / 60);
  assert.equal(g.phase, "free");
});
test("five-second cooldown clears heat only after the visible countdown ends", () => {
  assert.equal(COOLDOWN_SECONDS, 5);
  const g = parkedScenario();
  g.mission = "active";
  g.collected = ["gem-1", "gem-2"];
  tick(g, 1.5);
  assert.equal(g.phase, "cooldown");
  tick(g, 4.5);
  assert.equal(g.phase, "cooldown");
  assert.ok(g.escape < 5);
  tick(g, 0.6);
  assert.equal(g.phase, "free");
  assert.equal(g.escapes, 1);
  assert.deepEqual(g.collected, ["gem-1", "gem-2"]);
  assert.equal(g.guidance.kind, "gem");
});
test("leaving cover or being spotted interrupts cooldown", () => {
  const a = parkedScenario();
  tick(a, 3);
  assert.ok(a.escape > 0);
  Object.assign(a.player, garages[0].approach);
  stepGame(a, {}, 1 / 60);
  assert.equal(a.phase, "pursuit");
  assert.equal(a.escape, 0);
  const b = parkedScenario();
  tick(b, 3);
  Object.assign(b.police[0], garages[0].local(-4, -17), { vx: 0, vz: 0 });
  stepGame(b, {}, 1 / 60);
  assert.equal(b.phase, "pursuit");
  assert.equal(b.escape, 0);
});
test("police contacts require closing impact and separation before the next hit", () => {
  const g = pursuitGame(),
    cop = g.police[0];
  g.police.slice(1).forEach((c) => (c.visible = false));
  const place = (speed = 0) => {
    const f = { x: Math.sin(g.player.heading), z: -Math.cos(g.player.heading) };
    Object.assign(cop, {
      x: g.player.x - f.x * 4.3,
      z: g.player.z - f.z * 4.3,
      vx: f.x * speed,
      vz: f.z * speed,
      heading: g.player.heading,
      contact: false,
      pathTimer: 100,
      lastSeen: { ...g.player },
    });
  };
  place();
  g.player.vx = g.player.vz = 0;
  stepGame(g, {}, 1 / 60);
  assert.equal(g.policeHits, 0);
  for (let hit = 1; hit <= 3; hit++) {
    place(40);
    g.player.vx = g.player.vz = 0;
    stepGame(g, {}, 1 / 60);
    assert.equal(g.policeHits, hit);
    if (hit < 3) {
      Object.assign(cop, { x: g.player.x + 20, z: g.player.z, vx: 0, vz: 0 });
      stepGame(g, {}, 1 / 60);
      // Each fixture ram represents a new impact after the recovery window.
      g.policeImpactGrace=0;
    }
  }
  assert.equal(g.mode, "encounter");
  const stopped={x:g.player.x,z:g.player.z};
  tick(g, 1, {forward:true});
  assert.deepEqual({x:g.player.x,z:g.player.z},stopped);
  tick(g, g.encounter.duration + .6 - 1 + .02);
  assert.equal(g.mode, "exploding");
  assert.ok(g.explosion);
  tick(g, EXPLOSION_SECONDS + 0.1);
  assert.equal(g.mode, "foot");
  assert.equal(g.phase, "free");
  assert.equal(g.policeHits, 0);
  assert.ok(Math.hypot(g.player.x - SPAWN.x, g.player.z - SPAWN.z) < 10);
  assert.equal(
    g.vehicles.find((v) => v.id === "starter-jeep").destroyed,
    false,
  );
});
test("throttle, braking and pause work after boarding", () => {
  const g = createGame();
  startGame(g);
  g.traffic = [];
  board(g);
  tick(g, 2, { forward: true });
  assert.ok(g.player.speed > 20);
  tick(g, 0.5, { reverse: true });
  assert.ok(g.player.speed < 20);
  togglePause(g);
  const elapsed = g.elapsed;
  tick(g, 1, { forward: true });
  assert.equal(g.elapsed, elapsed);
});
test("garage cover blocks police sight and its wall resolves collisions", () => {
  for (const area of garages) {
    assert.equal(hasLineOfSight(area.entrance, area.inside), false);
    assert.equal(hasLineOfSight(area.entrance, area.elbow), true);
  }
  const area = garages[0],
    p = area.local(-17, -10),
    car = makeVehicle(p.x, p.z, -Math.atan2(area.outward.x, area.outward.z));
  resolveWorldCollision(car);
  assert.ok(Math.hypot(car.x - p.x, car.z - p.z) > 1);
});
function distance2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("boarding the mission vehicle preserves a saved partial collection", () => {
  const g = createGame(["gem-1", "gem-2"]);
  startGame(g);
  board(g, MISSIONS[0].vehicleId);
  assert.equal(g.mission, "active");
  assert.deepEqual(g.collected, ["gem-1", "gem-2"]);
});

test("a cop driving alongside is not a hit, and sustained contact cannot count twice", () => {
  const g = pursuitGame(),
    cop = g.police[0];
  g.police.slice(1).forEach((c) => (c.visible = false));
  const f = { x: Math.sin(g.player.heading), z: -Math.cos(g.player.heading) };
  Object.assign(cop, {
    x: g.player.x - f.z * 4,
    z: g.player.z + f.x * 4,
    heading: g.player.heading,
    vx: 0,
    vz: 0,
    pathTimer: 100,
    lastSeen: { ...g.player },
  });
  stepGame(g, {}, 1 / 60);
  assert.equal(g.policeHits, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    Object.assign(cop, {
      x: g.player.x - f.x * 4.3,
      z: g.player.z - f.z * 4.3,
      vx: f.x * 40,
      vz: f.z * 40,
      heading: g.player.heading,
      pathTimer: 100,
    });
    g.player.vx = g.player.vz = 0;
    stepGame(g, {}, 1 / 60);
  }
  assert.equal(g.policeHits, 1);
  assert.equal(g.mode, "driving");
});

test("traffic matches imported vehicles and the waterfront crowd wanders without entering water", () => {
  const g = createGame();
  startGame(g);
  assert.equal(g.pedestrians.length, 120);
  assert.deepEqual([...new Set(g.traffic.map(t => t.type))].sort(), ["jeep", "mini", "sports"]);
  const crowd = g.pedestrians.filter(p => p.wanderRoad);
  const before = crowd.map(p => ({x: p.x, z: p.z}));
  tick(g, 12);
  assert.ok(crowd.filter((p, i) => Math.hypot(p.x-before[i].x,p.z-before[i].z) > 1).length > 4);
  assert.ok(crowd.every(p => !inWater(p)));
  assert.ok(crowd.some(p => p.wanderTimer > 0));
});


test("pedestrian walking cannot pass through a park bench", () => {
  const g = createGame(); startGame(g); g.traffic = []; g.vehicles = [];
  const bench = parkFurniture.find(o => o.kind === "bench");
  const p = g.pedestrians[0];
  Object.assign(p, {x:bench.x-5,z:bench.z,y:0,hit:false,direction:1,pause:0,wanderTimer:100,
    wanderRoad:{points:[{x:bench.x-5,z:bench.z,y:0},{x:bench.x+5,z:bench.z,y:0}]},waypoint:1});
  g.pedestrians = [p];
  for (let i=0;i<600;i++) {
    stepGame(g, {}, 1/60);
    assert.ok(p.x < bench.x - bench.w/2 - .35);
  }
});


test("police update the pursuit target after losing sight outside cooldown zones", () => {
  const g=pursuitGame(), cop=g.police[0];
  Object.assign(g.player,atCircuit(1500),{vx:0,vz:0,speed:0});
  Object.assign(cop,atCircuit(100),{vx:0,vz:0,lastSeen:atCircuit(100),pathTimer:0});
  assert.equal(hasLineOfSight(cop,g.player),false);
  stepGame(g,{},1/60);
  assert.ok(Math.hypot(cop.lastSeen.x-g.player.x,cop.lastSeen.z-g.player.z)<1);
  assert.equal(cop.searchingCourt,false);
  assert.ok(cop.speed>0);
  assert.equal(g.phase,"pursuit");
});
test("local pedestrian population follows walking and driving while preserving identities", () => {
  const g=createGame();startGame(g);
  const appearances=g.pedestrians.map(p=>[p.id,p.appearance]);
  for(const [mode,x,z] of [["foot",100,-300],["driving",-1500,100]]) {
    g.mode=mode;Object.assign(g.player,{x,z,vx:0,vz:0});g.populationTimer=0;
    stepGame(g,{},1/60);
    assert.ok(g.pedestrians.filter(p=>Math.hypot(p.x-x,p.z-z)<130).length>=18);
  }
  assert.deepEqual(g.pedestrians.map(p=>[p.id,p.appearance]),appearances);
});
test("the expanded parked fleet can be boarded through normal interaction", () => {
  const g=createGame();startGame(g);
  assert.ok(g.vehicles.length>=12);
  assert.ok(g.vehicles.filter(v=>v.id.startsWith("parked-")).every(v=>closestRoad(v).distance>=6.5));
  board(g,g.vehicles.find(v=>v.id.startsWith("parked-")).id);
  assert.equal(g.mode,"driving");assert.equal(g.mission,"available");
});

test("a pedestrian impact is recorded once with its elevated ground position", () => {
  const g=createGame();startGame(g);g.traffic=[];board(g);
  const bridge=circuit.find(p=>p.y>2.8);Object.assign(g.player,bridge);
  const p=g.pedestrians[0];Object.assign(p,g.player,{hit:false});
  const f={x:Math.sin(g.player.heading),z:-Math.cos(g.player.heading)};
  Object.assign(g.player,{vx:f.x*5,vz:f.z*5,speed:5});
  stepGame(g,{},1/60);
  assert.equal(g.pedestrianImpacts.length,1);
  assert.equal(g.pedestrianImpacts[0].y,bridge.y);
  stepGame(g,{},1/60);
  assert.equal(g.pedestrianImpacts.length,1);
});

test("pedestrian impact falls, leaves ground blood, recovers and flees without disappearing",()=>{
  const g=createGame();startGame(g);g.traffic=[];board(g);g.police=[];
  const p=g.pedestrians[0];Object.assign(p,g.player,{hit:false});
  const f={x:Math.sin(g.player.heading),z:-Math.cos(g.player.heading)};
  Object.assign(g.player,{vx:f.x*5,vz:f.z*5,speed:5});stepGame(g,{},1/60);
  assert.equal(p.reaction.phase,"falling");g.player.vx=g.player.vz=0;
  tick(g,1.2);assert.equal(p.reaction.phase,"down");assert.ok(g.pedestrianImpacts.length>=2);
  tick(g,1.2);assert.equal(p.reaction.phase,"gettingUp");
  tick(g,1.4);assert.equal(p.reaction.phase,"fleeing");
  tick(g,6.5);assert.equal(p.reaction,null);assert.equal(p.hit,false);
});
test("police gunfire targets exposed players on foot and respects solid cover",()=>{
  const g=pursuitGame();g.mode="foot";g.activeVehicleId=null;g.vehicles=[];g.pedestrians=[];g.patrols=[];
  Object.assign(g.player,atCircuit(100),{vx:0,vz:0});
  Object.assign(g.police[0],atCircuit(110),{vx:0,vz:0});g.police.slice(1).forEach(c=>c.visible=false);
  // Recoil spread can miss an opening burst; verify contact over multiple bursts.
  tick(g,3);assert.ok(g.shots.length>0);assert.ok(g.gunHealth<100);
  const health=g.gunHealth;
  Object.assign(g.player,garages[0].local(-4,-10),{vx:0,vz:0});
  Object.assign(g.police[0],garages[0].local(-4,12),{vx:0,vz:0});
  tick(g,1);assert.equal(g.gunHealth,health);
});

test('downtown limits contain cars and reject pedestrian routes outside the map', async () => {
  const { WORLD_BOUNDS: b } = await import('../src/district.js');
  for (const p of [{x:b.minX-10,z:100},{x:b.maxX+10,z:100},{x:-700,z:b.minZ-10},{x:-700,z:b.maxZ+10}]) {
    const car={...p,vx:8,vz:8,heading:0,halfW:1,halfL:2};
    resolveWorldCollision(car);
    assert.ok(car.x>=b.minX+1&&car.x<=b.maxX-1&&car.z>=b.minZ+1&&car.z<=b.maxZ-1);
    assert.equal(driveableConnector({x:-700,z:100},p),false);
  }
});
