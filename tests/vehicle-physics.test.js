import test from 'node:test';
import assert from 'node:assert/strict';
import { drivePlayer, MAX_CAR_SPEED, forward, distance } from '../src/physics.js';
import { createGame, startGame, triggerPursuit, stepGame, makeVehicle } from '../src/simulation.js';
import { atCircuit } from '../src/district.js';

function accelerate(boost = false, dt = 1 / 60) {
  const g = { player: makeVehicle(0, 0), boost: 100 };
  let previous = 0;
  for (let i = 0; i < Math.round(12 / dt); i++) {
    drivePlayer(g, { forward: true, boost }, dt);
    const speed = Math.hypot(g.player.vx, g.player.vz);
    assert.ok(speed >= previous - 1e-8, 'holding throttle must not lose speed on a straight');
    assert.ok(speed <= MAX_CAR_SPEED + 1e-8, 'boost must respect the 150 km/h cap');
    previous = speed;
  }
  return g;
}

test('continuous acceleration reaches 150 km/h with and without boost at different frame rates', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    for (const boost of [false, true]) {
      const g = accelerate(boost, dt);
      assert.ok(Math.abs(g.player.speed * 3.6 - 150) < .1);
      drivePlayer(g, { reverse: true }, dt);
      assert.ok(g.player.speed < MAX_CAR_SPEED, 'braking must reduce speed at the limit');
    }
  }
});

test('medium police maintain pursuit at a lower speed cap after the head start', () => {
  const g = createGame();
  startGame(g);
  g.mode = 'driving';
  g.traffic = []; g.vehicles = []; g.pedestrians = []; g.patrols = [];
  Object.assign(g.player, atCircuit(3865));
  triggerPursuit(g);g.pursuitDelay=0;
  g.police = [g.police[0]];
  const cop = g.police[0];
  Object.assign(cop, makeVehicle(0, 0), atCircuit(3800), { visible: true });
  const cf=forward(cop.heading);Object.assign(cop,{speed:MAX_CAR_SPEED*.88,vx:cf.x*MAX_CAR_SPEED*.88,vz:cf.z*MAX_CAR_SPEED*.88});
  const initialGap = distance(cop, g.player);
  for (let i = 0; i < 180; i++) {
    const p = atCircuit(3865 + i / 60 * 35), f = forward(p.heading);
    Object.assign(g.player, p, { vx: f.x * 35, vz: f.z * 35, speed: 35 });
    stepGame(g, { forward: true }, 1 / 60);
  }
  assert.equal(g.phase, 'pursuit');
  assert.ok(cop.speed * 3.6 > 126, `pursuit speed was ${cop.speed * 3.6}`);
  assert.ok(cop.speed <= MAX_CAR_SPEED*.88 + 1e-8);
  assert.ok(distance(cop, g.player) < initialGap, 'police should close the gap');
});
