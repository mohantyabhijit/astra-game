import { createGame, startGame, stepGame, angleDelta, distance } from '../src/simulation.js';

// An input-only test driver. It uses the same throttle, brake and steering inputs as a player.
// No teleporting, checkpoint edits, health restoration or police removal.
const route = [
  [4,30],[4,0],[90,0],[90,-55],[90,-180],[55,-180],[-90,-180],[-90,-55],[-90,90],[-55,90],
  [180,90],[180,-180],[-180,-180],[-180,180],[180,180],[180,-180],
];
const game = createGame(); startGame(game); let point = 0; const milestones = [];
for (let frame = 0; frame < 120 * 230 && game.status === 'running'; frame++) {
  let target = { x: route[point][0], z: route[point][1] };
  const d = distance(game.player, target);
  if (d < 10 && point < route.length - 1) { point++; target = { x: route[point][0], z: route[point][1] }; }
  const diff = angleDelta(Math.atan2(target.x - game.player.x, -(target.z - game.player.z)), game.player.heading);
  const speed = Math.hypot(game.player.vx, game.player.vz);
  const next = route[point + 1];
  const isCorner = next && Math.abs(angleDelta(Math.atan2(next[0] - target.x, -(next[1] - target.z)), Math.atan2(target.x - game.player.x, -(target.z - game.player.z)))) > .7;
  const wanted = Math.abs(diff) > .3 ? 10 : isCorner ? Math.min(51, Math.sqrt(44 * Math.max(0, distance(game.player, target) - 10) + 64)) : 51;
  const before = game.checkpoint;
  stepGame(game, { forward: speed < wanted + 1, reverse: speed > wanted + 2,
    left: diff < -.04, right: diff > .04, boost: wanted > 36 && Math.abs(diff) < .15 && distance(game.player, target) > 45 }, 1/120);
  if (game.checkpoint !== before) milestones.push({ checkpoint: game.checkpoint, seconds: +game.elapsed.toFixed(2), health: +game.health.toFixed(1) });
}
const result = { status: game.status, outcome: game.outcome, seconds: +game.elapsed.toFixed(2), checkpoint: game.checkpoint,
  health: +game.health.toFixed(1), score: Math.floor(game.score), collisions: game.collisions, nearMisses: game.nearMisses,
  waypoint: point, player: { x: +game.player.x.toFixed(2), z: +game.player.z.toFixed(2) }, escape: game.escape, nearestCop: game.nearestCop, milestones };
console.log(JSON.stringify(result, null, 2));
if (game.status !== 'won') process.exitCode = 1;
