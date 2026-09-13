import { angleDelta, distance, stepGame, interact } from "../src/simulation.js";

export function advance(game, seconds, input = {}) {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++)
    stepGame(game, input, 1 / 60);
}

// Only ordinary movement and interaction inputs: no teleporting or state edits.
export function walkTo(game, target, timeout = 30) {
  for (
    let frame = 0;
    frame < timeout * 60 && distance(game.player, target) > 4.8;
    frame++
  ) {
    const delta = angleDelta(
      Math.atan2(target.x - game.player.x, -(target.z - game.player.z)),
      game.player.heading,
    );
    stepGame(
      game,
      {
        forward: Math.abs(delta) < 0.5,
        boost: true,
        left: delta < -0.035,
        right: delta > 0.035,
      },
      1 / 60,
    );
  }
  return distance(game.player, target) < 5.5;
}

export function boardNearby(game) {
  interact(game);
  for(let frame=0;frame<1200&&game.transition;frame++)stepGame(game,{},1/60);
  return game.mode === "driving";
}

export function routeInput(game, path, cursor) {
  while (cursor.index < path.length - 1) {
    const a = path[cursor.index - 1] || path[0],
      b = path[cursor.index];
    const passed =
      (game.player.x - b.x) * (b.x - a.x) +
        (game.player.z - b.z) * (b.z - a.z) >
      0;
    if (distance(game.player, b) < 4 || passed) cursor.index++;
    else break;
  }
  const target = path[cursor.index] || game.player,
    next = path[Math.min(cursor.index + 1, path.length - 1)] || target;
  const delta = angleDelta(
    Math.atan2(target.x - game.player.x, -(target.z - game.player.z)),
    game.player.heading,
  );
  const turn = Math.abs(
    angleDelta(
      Math.atan2(next.x - target.x, -(next.z - target.z)),
      game.player.heading,
    ),
  );
  const speed = Math.hypot(game.player.vx, game.player.vz);
  const atEnd =
    game.phase !== "free" &&
    game.guidance?.destination?.inside &&
    distance(game.player, game.guidance.destination.inside) < 3;
  let wanted =
    atEnd || game.phase === "cooldown"
      ? 0
      : Math.abs(delta) > 0.4 || turn > 0.5
        ? 7
        : game.guidance?.distance < 45
          ? 8
          : 23;
  let preview = distance(game.player, target);
  for (let j = cursor.index; j < path.length - 1 && preview < 80; j++) {
    const a = path[Math.max(0, j - 1)],
      b = path[j],
      c = path[j + 1];
    const corner = Math.abs(
      angleDelta(
        Math.atan2(b.x - a.x, -(b.z - a.z)),
        Math.atan2(c.x - b.x, -(c.z - b.z)),
      ),
    );
    if (corner > 0.25)
      wanted = Math.min(wanted, Math.sqrt(30 * Math.max(0, preview - 10) + 49));
    preview += distance(b, c);
  }
  return {
    forward: speed < wanted,
    reverse: speed > wanted + 0.3,
    left: wanted > 0 && delta < -0.035,
    right: wanted > 0 && delta > 0.035,
    handbrake: wanted === 0,
  };
}
