import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, togglePause, recoverCar, collideCars, collideBuildings, pursuitTarget, hasLineOfSight, CHECKPOINTS, BUILDINGS, distance } from '../src/simulation.js';

function fresh() { const g = createGame(); startGame(g); g.traffic = []; g.police = [{ x: -180, z: -180, heading: 0, vx: 0, vz: 0, speed: 0, hit: 0 }]; return g; }
function run(g, input, seconds, dt = 1 / 120) { for (let t = 0; t < seconds - dt / 2; t += dt) stepGame(g, input, dt); }
test('accelerates, brakes, reverses and steers responsively', () => {
  const g = fresh(); run(g, { forward: true }, 2); assert.ok(g.player.speed > 25); assert.ok(g.player.z < 120);
  run(g, { reverse: true }, 1); assert.ok(g.player.speed < 5);
  run(g, { reverse: true, right: true }, 1); assert.ok(g.player.speed < -3); assert.ok(g.player.heading < -.15);
});
test('nitro adds speed, consumes charge, then recharges', () => {
  const g = fresh(); run(g, { forward: true }, 2); const normal = g.player.speed;
  run(g, { forward: true, boost: true }, 1); assert.ok(g.player.speed > normal + 8); assert.ok(g.boost < 80);
  const used = g.boost; run(g, {}, .5); assert.ok(g.boost > used);
});
test('stationary steering cannot spin the car', () => { const g = fresh(); run(g, { right: true }, 1); assert.equal(g.player.heading, 0); });
test('same driving result across fixed step rates', () => {
  const a = fresh(), b = fresh(); run(a, { forward: true }, 2, 1 / 120); run(b, { forward: true }, 2, 1 / 60);
  assert.ok(Math.abs(a.player.z - b.player.z) < .5); assert.ok(Math.abs(a.player.speed - b.player.speed) < .3);
});
test('pause freezes simulation and resumes', () => {
  const g = fresh(); togglePause(g); const before = JSON.stringify(g); run(g, { forward: true }, 2); assert.equal(JSON.stringify(g), before);
  togglePause(g); run(g, { forward: true }, 1); assert.ok(g.player.z < 148);
});
test('oriented vehicle collision separates bodies and transfers momentum', () => {
  const a = { x: 0, z: 0, heading: 0, vx: 0, vz: -25 }, b = { x: 0, z: -4, heading: 0, vx: 0, vz: 0 };
  const impact = collideCars(a, b); assert.equal(impact, 25); assert.ok(distance(a, b) >= 4.8); assert.ok(a.vz > -25); assert.ok(b.vz < 0);
  assert.equal(collideCars(a, b), 0);
});
test('building collision resolves a high-speed impact without entering the building', () => {
  const b = { x: 0, z: 0, w: 20, d: 20 }, p = { x: 0, z: 11.9, heading: 0, vx: 0, vz: -50 };
  assert.equal(collideBuildings(p, [b]), 50); assert.ok(p.z > 12.2); assert.ok(p.vz > 0);
});
test('checkpoint ordering, single collection, time reward and score', () => {
  const g = fresh(); Object.assign(g.player, CHECKPOINTS[1]); stepGame(g, {}, 1 / 120); assert.equal(g.checkpoint, 0);
  Object.assign(g.player, CHECKPOINTS[0]); stepGame(g, {}, 1 / 120); assert.equal(g.checkpoint, 1); assert.ok(g.time > 164); assert.ok(g.score >= 1000);
  stepGame(g, {}, 1 / 120); assert.equal(g.checkpoint, 1);
});
test('police close distance on a straight street and route through junctions', () => {
  const g = createGame(); startGame(g); const initial = distance(g.player, g.police[0]); run(g, {}, 1);
  assert.ok(distance(g.player, g.police[0]) < initial - 10);
  const c = { x: 0, z: 30 }; const target = pursuitTarget(c, { x: 90, z: -55 }); assert.deepEqual(target, { x: 0, z: 0 });
  c.x = 0; c.z = 0; assert.deepEqual(pursuitTarget(c, { x: 90, z: -55 }), { x: 90, z: 0 });
});
test('buildings block police vision while open streets preserve it', () => {
  assert.equal(hasLineOfSight({ x: 0, z: 25 }, { x: 60, z: 25 }), false);
  assert.equal(hasLineOfSight({ x: 0, z: 25 }, { x: 0, z: -55 }), true);
  assert.equal(hasLineOfSight({ x: 0, z: 148 }, { x: 0, z: -50 }), false);
});
test('close calls score once until the traffic car is out of range', () => {
  const g = fresh(); g.player.vz = -25;
  const traffic = { x: 8.5, z: 148, vx: 0, vz: -12, heading: 0, speed: 12, cruise: 12, horizontal: false, dir: 1, near: false, hit: 0 };
  g.traffic.push(traffic); stepGame(g, { forward: true }, 1 / 120);
  assert.equal(g.nearMisses, 1); assert.ok(g.score >= 150);
  stepGame(g, { forward: true }, 1 / 120); assert.equal(g.nearMisses, 1);
});
test('all checkpoints still require an escape, then award victory', () => {
  const g = fresh(); g.checkpoint = CHECKPOINTS.length; stepGame(g, {}, 1 / 120); assert.equal(g.status, 'running');
  run(g, {}, 5.1); assert.equal(g.status, 'won'); assert.ok(g.score > 2500);
});
test('nearby pursuit prevents an immediate escape', () => {
  const g = fresh(); g.checkpoint = CHECKPOINTS.length; g.police[0].x = 4; g.police[0].z = 160; run(g, {}, .5); assert.equal(g.escape, 0); assert.equal(g.status, 'running');
});
test('timeout and destroyed car end the run; fresh restart clears progress', () => {
  const a = fresh(); a.time = .01; run(a, {}, .1); assert.equal(a.status, 'lost'); assert.match(a.outcome, /clock/);
  const b = fresh(); b.health = 0; run(b, {}, .1); assert.equal(b.status, 'lost');
  const clean = createGame(); assert.equal(clean.health, 100); assert.equal(clean.checkpoint, 0); assert.equal(clean.score, 0);
});
test('recovery has a score cost, cooldown and leaves a drivable position', () => {
  const g = fresh(); g.score = 500; Object.assign(g.player, { x: 32, z: 30, vx: 8, vz: 5 }); recoverCar(g);
  assert.equal(g.score, 250); assert.equal(g.player.speed, 0); assert.equal(g.resetCooldown, 5);
  assert.ok(!BUILDINGS.some(b => Math.abs(g.player.x - b.x) < b.w / 2 && Math.abs(g.player.z - b.z) < b.d / 2));
  recoverCar(g); assert.equal(g.score, 250);
});
test('simulation remains finite over a seeded long chase', () => {
  const g = createGame(); startGame(g);
  for (let i = 0; i < 7200 && g.status === 'running'; i++) stepGame(g, { forward: true, right: i % 1500 < 180, boost: i % 1000 < 300 }, 1 / 120);
  for (const c of [g.player, ...g.police, ...g.traffic]) for (const k of ['x', 'z', 'vx', 'vz', 'heading']) assert.ok(Number.isFinite(c[k]));
  assert.ok(g.health >= 0 && g.health <= 100); assert.ok(g.boost >= 0 && g.boost <= 100);
});
