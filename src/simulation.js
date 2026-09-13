// Pure, deterministic game simulation. World units are metres; time is seconds.
export const STREETS = [-180, -90, 0, 90, 180];
export const CHECKPOINTS = [
  { x: 4, z: 30, name: 'Palm Avenue', axis: 'z' },
  { x: 90, z: -55, name: 'Financial District', axis: 'z' },
  { x: 55, z: -180, name: 'North Quay', axis: 'x' },
  { x: -90, z: -55, name: 'Old Town', axis: 'z' },
  { x: -55, z: 90, name: 'Harbour Drive', axis: 'x' },
];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const nearestStreet = n => STREETS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
const forward = h => ({ x: Math.sin(h), z: -Math.cos(h) });
export function seededRandom(seed = 731) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}

export function makeCity() {
  const rand = seededRandom();
  const buildings = [];
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 4; iz++) {
    for (let sx = 0; sx < 2; sx++) for (let sz = 0; sz < 2; sz++) {
      const x = -180 + ix * 90 + 29 + sx * 32;
      const z = -180 + iz * 90 + 29 + sz * 32;
      buildings.push({ x, z, w: 21 + rand() * 6, d: 21 + rand() * 6,
        h: 14 + rand() * 53, color: Math.floor(rand() * 5), roof: rand() });
    }
  }
  return buildings;
}
export const BUILDINGS = makeCity();
const vehicle = (x, z, heading = 0) => ({ x, z, heading, vx: 0, vz: 0, speed: 0, steer: 0, hit: 0 });

export function createGame() {
  const traffic = [];
  for (let i = 0; i < 24; i++) {
    const row = i % 5, col = (i * 3 + 1) % 5;
    const dir = i % 2 === 0 ? 1 : -1;
    const horizontal = i % 4 < 2;
    const t = vehicle(horizontal ? -200 + i * 17 % 400 : STREETS[col] + dir * 5,
      horizontal ? STREETS[row] + dir * 5 : -210 + i * 31 % 420,
      horizontal ? dir * Math.PI / 2 : dir === 1 ? 0 : Math.PI);
    Object.assign(t, { horizontal, dir, cruise: 10 + i % 6, near: false, color: i % 6 });
    if (distance(t, { x: 4, z: 148 }) > 25) traffic.push(t);
  }
  return { status: 'ready', player: vehicle(4, 148), traffic,
    police: [vehicle(-4, 191), vehicle(7, 207), vehicle(-5, 223)],
    score: 0, checkpoint: 0, time: 150, elapsed: 0, health: 100,
    boost: 100, boosting: false, escape: 0, nearestCop: 43,
    busted: 0, distance: 0, collisions: 0, nearMisses: 0, events: [],
    resetCooldown: 0, outcome: '', combo: 1,
  };
}
function emit(g, text, kind = 'info') { g.events.push({ text, kind }); }
export function startGame(g) { if (g.status === 'ready') g.status = 'running'; }
export function togglePause(g) {
  if (g.status === 'running') g.status = 'paused';
  else if (g.status === 'paused') g.status = 'running';
}
export function recoverCar(g) {
  if (g.status !== 'running' || g.resetCooldown > 0) return;
  const p = g.player, x = nearestStreet(p.x), z = nearestStreet(p.z);
  if (Math.abs(p.x - x) < Math.abs(p.z - z)) { p.x = x + 4; p.heading = 0; }
  else { p.z = z + 4; p.heading = Math.PI / 2; }
  p.vx = p.vz = p.speed = 0; g.score = Math.max(0, g.score - 250);
  g.resetCooldown = 5; p.hit = 1; emit(g, 'Back on the road · −250', 'warning');
}
function drivePlayer(g, input, dt) {
  const p = g.player;
  const f = forward(p.heading), r = { x: -f.z, z: f.x };
  let longitudinal = p.vx * f.x + p.vz * f.z;
  let lateral = p.vx * r.x + p.vz * r.z;
  const throttle = (input.forward ? 1 : 0) - (input.reverse ? 1 : 0);
  const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.steer += (steering - p.steer) * (1 - Math.exp(-12 * dt));
  g.boosting = !!(input.boost && input.forward && g.boost > 1 && longitudinal > 3);
  const acceleration = throttle < 0 && longitudinal > 1 ? -37 : throttle * (g.boosting ? 30 : 20);
  longitudinal += acceleration * dt;
  longitudinal *= Math.exp(-(input.handbrake ? 1.35 : throttle ? 0.30 : 0.70) * dt);
  longitudinal = clamp(longitudinal, -12, g.boosting ? 51 : 37);
  lateral *= Math.exp(-(input.handbrake ? 2.0 : 10) * dt);
  p.heading += p.steer * clamp(longitudinal / 9, -1, 1) * (input.handbrake ? 2.2 : 1.45) /
    (1 + Math.abs(longitudinal) / 48) * dt;
  const nf = forward(p.heading), nr = { x: -nf.z, z: nf.x };
  // Most of the grip follows the steering; handbraking preserves more lateral momentum.
  const grip = input.handbrake ? 0.30 : 0.88;
  p.vx = (nf.x * grip + f.x * (1 - grip)) * longitudinal + nr.x * lateral;
  p.vz = (nf.z * grip + f.z * (1 - grip)) * longitudinal + nr.z * lateral;
  p.speed = longitudinal;
  g.boost = clamp(g.boost + (g.boosting ? -27 : 13) * dt, 0, 100);
}

// Route along the street graph. The next corner persists until reached to avoid oscillation.
export function pursuitTarget(cop, player) {
  const cx = nearestStreet(cop.x), cz = nearestStreet(cop.z);
  const px = nearestStreet(player.x), pz = nearestStreet(player.z);
  if (Math.abs(cop.x - player.x) < 11 && Math.abs(cop.x - cx) < 12 && Math.abs(player.x - cx) < 12)
    return { x: player.x, z: player.z };
  if (Math.abs(cop.z - player.z) < 11 && Math.abs(cop.z - cz) < 12 && Math.abs(player.z - cz) < 12)
    return { x: player.x, z: player.z };
  if (cop.target && distance(cop, cop.target) > 5) return cop.target;
  // Join a junction first; only make turns inside intersections.
  if (distance(cop, { x: cx, z: cz }) > 7) return (cop.target = { x: cx, z: cz });
  if (Math.abs(px - cx) > 4) return (cop.target = { x: cx + Math.sign(px - cx) * 90, z: cz });
  if (Math.abs(pz - cz) > 4) return (cop.target = { x: cx, z: cz + Math.sign(pz - cz) * 90 });
  return { x: player.x, z: player.z };
}
function drivePolice(g, c, i, dt) {
  const visible = hasLineOfSight(c, g.player);
  if (visible || !c.lastSeen) c.lastSeen = { x: g.player.x, z: g.player.z };
  const target = pursuitTarget(c, c.lastSeen);
  const desired = Math.atan2(target.x - c.x, -(target.z - c.z));
  const turn = angleDelta(desired, c.heading);
  c.heading += clamp(turn, -2.4 * dt, 2.4 * dt);
  const searching = !visible && distance(c, c.lastSeen) < 12;
  const speed = (searching ? 8 : 27 + g.checkpoint * 1.1 + i * .4) * clamp(1 - Math.abs(turn) * .55, .25, 1);
  const f = forward(c.heading), blend = 1 - Math.exp(-3.5 * dt);
  c.vx += (f.x * speed - c.vx) * blend; c.vz += (f.z * speed - c.vz) * blend;
  c.speed = Math.hypot(c.vx, c.vz);
}
export function hasLineOfSight(a, b) {
  if (distance(a, b) > 110) return false;
  // Segment/AABB slab intersection; buildings occlude the police's view.
  for (const building of BUILDINGS) {
    let near = 0, far = 1;
    for (const [axis, size] of [['x', 'w'], ['z', 'd']]) {
      const delta = b[axis] - a[axis], min = building[axis] - building[size] / 2, max = building[axis] + building[size] / 2;
      if (Math.abs(delta) < .00001) { if (a[axis] < min || a[axis] > max) { near = 2; break; } }
      else {
        const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta;
        near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2));
      }
    }
    if (near <= far && far > 0 && near < 1) return false;
  }
  return true;
}
function driveTraffic(t, dt) {
  const f = forward(t.heading), blend = 1 - Math.exp(-2 * dt);
  t.vx += (f.x * t.cruise - t.vx) * blend; t.vz += (f.z * t.cruise - t.vz) * blend;
  // Gentle lane return after impacts, while allowing collision impulses to settle.
  if (t.horizontal) t.vz += (nearestStreet(t.z) + t.dir * 5 - t.z) * dt;
  else t.vx += (nearestStreet(t.x) + t.dir * 5 - t.x) * dt;
  t.speed = Math.hypot(t.vx, t.vz);
}

// OBB separating-axis collision: a tight car footprint, not a large spherical proxy.
export function collideCars(a, b) {
  if (distance(a, b) > 5.4) return 0;
  const fa = forward(a.heading), fb = forward(b.heading);
  const ra = { x: -fa.z, z: fa.x }, rb = { x: -fb.z, z: fb.x };
  const dx = a.x - b.x, dz = a.z - b.z;
  let overlap = Infinity, normal;
  for (const n of [fa, ra, fb, rb]) {
    const ap = 2.4 * Math.abs(fa.x * n.x + fa.z * n.z) + 1.1 * Math.abs(ra.x * n.x + ra.z * n.z);
    const bp = 2.4 * Math.abs(fb.x * n.x + fb.z * n.z) + 1.1 * Math.abs(rb.x * n.x + rb.z * n.z);
    const projection = dx * n.x + dz * n.z;
    const penetration = ap + bp - Math.abs(projection);
    if (penetration <= 0) return 0;
    if (penetration < overlap) { overlap = penetration; const s = projection < 0 ? -1 : 1; normal = { x: n.x * s, z: n.z * s }; }
  }
  a.x += normal.x * (overlap / 2 + .01); a.z += normal.z * (overlap / 2 + .01);
  b.x -= normal.x * (overlap / 2 + .01); b.z -= normal.z * (overlap / 2 + .01);
  const closing = (a.vx - b.vx) * normal.x + (a.vz - b.vz) * normal.z;
  if (closing >= 0) return 0;
  const impulse = -closing * .67;
  a.vx += normal.x * impulse; a.vz += normal.z * impulse;
  b.vx -= normal.x * impulse; b.vz -= normal.z * impulse;
  return -closing;
}
export function collideBuildings(car, buildings = BUILDINGS) {
  let impact = 0;
  const f = forward(car.heading), radius = 1.15;
  for (const b of buildings) {
    if (Math.abs(car.x - b.x) > b.w / 2 + 4 || Math.abs(car.z - b.z) > b.d / 2 + 4) continue;
    for (const offset of [-1.2, 1.2]) {
      const x = car.x + f.x * offset, z = car.z + f.z * offset;
      const nx = clamp(x, b.x - b.w / 2, b.x + b.w / 2), nz = clamp(z, b.z - b.d / 2, b.z + b.d / 2);
      let dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz), penetration;
      if (d >= radius) continue;
      if (d < .0001) {
        const sides = [{ d: x - (b.x - b.w / 2), x: -1, z: 0 }, { d: b.x + b.w / 2 - x, x: 1, z: 0 },
          { d: z - (b.z - b.d / 2), x: 0, z: -1 }, { d: b.z + b.d / 2 - z, x: 0, z: 1 }];
        sides.sort((a, b) => a.d - b.d); dx = sides[0].x; dz = sides[0].z; penetration = radius + sides[0].d;
      } else { dx /= d; dz /= d; penetration = radius - d; }
      car.x += dx * (penetration + .01); car.z += dz * (penetration + .01);
      const vn = car.vx * dx + car.vz * dz;
      if (vn < 0) { impact = Math.max(impact, -vn); car.vx -= dx * vn * 1.3; car.vz -= dz * vn * 1.3; }
    }
  }
  return impact;
}
function damage(g, impact) {
  if (impact < 4 || g.player.hit > 0) return;
  g.health = Math.max(0, g.health - clamp(impact * .65, 3, 23));
  g.player.hit = .65; g.collisions++; g.combo = 1;
  emit(g, 'Collision · keep moving', 'impact');
}
export function stepGame(g, input, dt) {
  if (g.status !== 'running') return;
  dt = clamp(dt, 0, 1 / 30);
  g.elapsed += dt; g.time -= dt; g.resetCooldown = Math.max(0, g.resetCooldown - dt);
  drivePlayer(g, input, dt);
  g.police.forEach((c, i) => drivePolice(g, c, i, dt));
  g.traffic.forEach(t => driveTraffic(t, dt));
  const all = [g.player, ...g.police, ...g.traffic];
  for (const c of all) {
    c.hit = Math.max(0, c.hit - dt); c.x += c.vx * dt; c.z += c.vz * dt;
    const impact = collideBuildings(c);
    if (c === g.player) damage(g, impact);
  }
  for (const t of g.traffic) {
    if (Math.abs(t.x) > 222) { t.x *= -1; t.x = clamp(t.x, -221, 221); t.near = false; }
    if (Math.abs(t.z) > 222) { t.z *= -1; t.z = clamp(t.z, -221, 221); t.near = false; }
  }
  for (const c of [g.player, ...g.police]) {
    for (const axis of ['x', 'z']) if (Math.abs(c[axis]) > 218) {
      c[axis] = clamp(c[axis], -218, 218);
      if (c === g.player) damage(g, Math.abs(c['v' + axis]));
      c['v' + axis] *= -.35;
    }
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const impact = collideCars(all[i], all[j]);
    if (i === 0) damage(g, impact);
  }
  const p = g.player, speed = Math.hypot(p.vx, p.vz);
  g.distance += speed * dt; g.score += speed * dt * 2;
  for (const t of g.traffic) {
    const d = distance(p, t);
    if (!t.near && d > 3.4 && d < 5.6 && speed > 19 && p.hit === 0) {
      t.near = true; g.nearMisses++; g.score += 150; emit(g, 'Close call  +150', 'reward');
    }
    if (d > 35) t.near = false;
  }
  const checkpoint = CHECKPOINTS[g.checkpoint];
  if (checkpoint && distance(p, checkpoint) < 13) {
    g.checkpoint++; g.time += 15; g.score += 1000; g.health = Math.min(100, g.health + 12);
    g.boost = Math.min(100, g.boost + 35);
    emit(g, g.checkpoint === CHECKPOINTS.length ? 'All gates cleared · lose the police!' : 'Checkpoint  +1,000 · +15 sec', 'checkpoint');
  }
  g.nearestCop = Math.min(...g.police.map(c => distance(c, p)));
  g.busted = g.nearestCop < 7 && speed < 3 ? g.busted + dt : Math.max(0, g.busted - dt * 2);
  if (g.checkpoint === CHECKPOINTS.length) {
    g.escape = g.nearestCop > 48 ? Math.min(5, g.escape + dt) : Math.max(0, g.escape - dt * .75);
    if (g.escape >= 5) { g.status = 'won'; g.score += 2500 + Math.max(0, g.time) * 20; g.outcome = 'You lost the tail. The city is yours.'; }
  }
  if (g.health <= 0 || g.time <= 0 || g.busted >= 5) {
    g.status = 'lost'; g.outcome = g.health <= 0 ? 'Your ride took too much damage.' : g.time <= 0 ? 'The clock ran out.' : 'The police boxed you in.';
  }
}
