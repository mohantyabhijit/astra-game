import test from 'node:test';
import assert from 'node:assert/strict';
import {jump, stepJump, resetJump} from '../src/jumping.js';
import {createGame, stepGame, interact} from '../src/simulation.js';
import {walkingSurfaceHeight} from '../src/district.js';

function footGame() {
  const g = createGame();
  g.status = 'running';
  g.pedestrians = []; g.patrols = []; g.police = []; g.traffic = [];
  return g;
}

test('jump rises and lands on the Merlion terrace through the full simulation', () => {
  const g = footGame(), surface = walkingSurfaceHeight(g.player);
  assert.equal(jump(g), true);
  assert.equal(interact(g), false, 'cannot board in midair');
  let highest = surface;
  for (let i = 0; i < 50; i++) {
    stepGame(g, {}, 1 / 60);
    highest = Math.max(highest, g.player.y);
    if (i === 5) assert.equal(jump(g), false, 'no double jump');
  }
  assert.ok(highest > surface + .65 && highest < surface + .9);
  assert.equal(g.player.y, walkingSurfaceHeight(g.player));
  assert.equal(g.player.grounded, true);
  assert.equal(jump(g), true, 'can jump again after landing');
});

test('jump is rejected while driving, boarding, paused, reacting or attacking', () => {
  for (const setup of [g => g.mode = 'driving', g => g.transition = {},
    g => g.status = 'paused', g => g.player.reaction = {}, g => g.player.attack = {},
    g => g.player.hitstun = 1, g => g.player.dead = true]) {
    const g = footGame(); setup(g); assert.equal(jump(g), false);
  }
});

test('jump timing stays consistent across frame rates and elevated surfaces', () => {
  for (const hz of [30, 60, 120]) {
    const g = footGame(); jump(g);
    for (let i = 0; i < hz; i++) stepJump(g.player, 1 / hz, 12);
    assert.equal(g.player.y, 12);
    assert.equal(g.player.jumpVelocity, 0);
    assert.equal(g.player.grounded, true);
  }
});

test('pause freezes an airborne player and reset clears vertical momentum', () => {
  const g = footGame(); jump(g); stepGame(g, {}, 1 / 60);
  const height = g.player.y, velocity = g.player.jumpVelocity;
  g.status = 'paused'; stepGame(g, {}, 1 / 30);
  assert.equal(g.player.y, height); assert.equal(g.player.jumpVelocity, velocity);
  resetJump(g.player); assert.equal(g.player.grounded, true); assert.equal(g.player.jumpHeight, 0);
});
