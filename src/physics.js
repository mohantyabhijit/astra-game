// Driving and collision core retained from the original Midnight Run.
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const forward = h => ({ x: Math.sin(h), z: -Math.cos(h) });
export const MAX_CAR_SPEED = 150 / 3.6; // Simulation velocities are metres per second.
export function seededRandom(seed = 731) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}


export function drivePlayer(g, input, dt) {
  const p = g.player;
  const f = forward(p.heading), r = { x: -f.z, z: f.x };
  let longitudinal = p.vx * f.x + p.vz * f.z;
  let lateral = p.vx * r.x + p.vz * r.z;
  const throttle = (input.forward ? 1 : 0) - (input.reverse ? 1 : 0);
  const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.steer += (steering - p.steer) * (1 - Math.exp(-5.5 * dt));
  g.boosting = !!(input.boost && input.forward && g.boost > 1 && longitudinal > 3);
  const speedRatio = clamp(Math.abs(longitudinal) / MAX_CAR_SPEED, 0, 1);
  const braking=throttle&&Math.sign(throttle)!==Math.sign(longitudinal)&&Math.abs(longitudinal)>.3;
  const acceleration = braking ? throttle*30 : throttle * (g.boosting ? 16 : 12) * (1 - .65 * speedRatio ** 2);
  longitudinal += acceleration * dt;
  // Engine power tapers as speed builds; boost improves acceleration, not the cap.
  const resistance = (.15 + .001 * longitudinal ** 2) * dt;
  longitudinal = Math.sign(longitudinal) * Math.max(0, Math.abs(longitudinal) - resistance);
  longitudinal *= Math.exp(-(input.handbrake ? 1.35 : throttle ? 0 : .25) * dt);
  longitudinal = clamp(longitudinal, -12, MAX_CAR_SPEED);
  lateral *= Math.exp(-(input.handbrake ? 2.0 : 10) * dt);
  // Wobbleheads bicycle steering: signed speed, actual axle spacing and
  // speed-sensitive wheel angle. Tire grip limits abrupt high-speed yaw.
  const wheelbase=p.type==='sports'?2.84:p.type==='mini'?2.4:2.54;
  p.steeringAngle=p.steer*.45/(1+Math.abs(longitudinal)*.035);
  const yaw=longitudinal/wheelbase*Math.tan(p.steeringAngle);
  const yawLimit=(input.handbrake?15:10)/Math.max(4,Math.abs(longitudinal));
  p.heading+=clamp(yaw,-yawLimit,yawLimit)*dt;
  const nf = forward(p.heading), nr = { x: -nf.z, z: nf.x };
  // Most of the grip follows the steering; handbraking preserves more lateral momentum.
  const grip = input.handbrake ? 0.30 : 0.88;
  p.vx = (nf.x * grip + f.x * (1 - grip)) * longitudinal + nr.x * lateral;
  p.vz = (nf.z * grip + f.z * (1 - grip)) * longitudinal + nr.z * lateral;
  p.speed = longitudinal;
  g.boost = clamp(g.boost + (g.boosting ? -27 : 13) * dt, 0, 100);
}


export function collideCars(a, b) {
  if (distance(a, b) > (a.halfL || 2.4) + (b.halfL || 2.4) + .6) return 0;
  const fa = forward(a.heading), fb = forward(b.heading);
  const ra = { x: -fa.z, z: fa.x }, rb = { x: -fb.z, z: fb.x };
  const dx = a.x - b.x, dz = a.z - b.z;
  let overlap = Infinity, normal;
  for (const n of [fa, ra, fb, rb]) {
    const ap = (a.halfL || 2.4) * Math.abs(fa.x * n.x + fa.z * n.z) + (a.halfW || 1.1) * Math.abs(ra.x * n.x + ra.z * n.z);
    const bp = (b.halfL || 2.4) * Math.abs(fb.x * n.x + fb.z * n.z) + (b.halfW || 1.1) * Math.abs(rb.x * n.x + rb.z * n.z);
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
export function collideBuildings(car, buildings = []) {
  let impact = 0;
  const f = forward(car.heading), radius = (car.halfW || 1.1) + .05;
  for (const b of buildings) {
    if (Math.abs(car.x - b.x) > b.w / 2 + 4 || Math.abs(car.z - b.z) > b.d / 2 + 4) continue;
    for (const offset of [-((car.halfL || 2.4) - 1.2), (car.halfL || 2.4) - 1.2]) {
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
