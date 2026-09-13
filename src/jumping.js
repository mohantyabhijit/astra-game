// Wobbleheads prototype/js/app.js: grounded launch at 4.8 m/s, gravity 14 m/s².
export const JUMP_SPEED = 4.8;
export const JUMP_GRAVITY = 14;

export function jump(game) {
  const p = game.player;
  if (game.status !== 'running' || game.mode !== 'foot' || game.transition ||
      p.grounded === false || p.reaction || p.attack || p.hitstun > 0 || p.dead) return false;
  p.jumpHeight = 0;
  p.jumpVelocity = JUMP_SPEED;
  p.grounded = false;
  return true;
}

export function resetJump(player) {
  player.jumpHeight = 0;
  player.jumpVelocity = 0;
  player.grounded = true;
}

export function stepJump(player, dt, surfaceHeight) {
  if (player.grounded === false) {
    player.jumpVelocity -= JUMP_GRAVITY * dt;
    player.jumpHeight = Math.max(0, player.jumpHeight + player.jumpVelocity * dt);
    if (player.jumpHeight === 0) resetJump(player);
  }
  player.y = surfaceHeight + (player.jumpHeight || 0);
}
