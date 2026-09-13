import {populateNearbyPedestrians} from './pedestrian-population.js';
import {resetJump, stepJump} from "./jumping.js";
import {availableCars,walkingPathClear,separateWalker} from './vehicle-access.js';
export {availableCars} from './vehicle-access.js';
import {resolvePoliceShot} from './police-ballistics.js';
import {stepMelee} from './melee.js';
export {punch} from './melee.js';
import {boardingPose} from './wobble/original/motion.js';
import {boardingRoute} from './boarding.js';
import {createPolicePatrols,stepPolicePatrols,beginPoliceEncounter,stepDeployedOfficer} from "./police-patrols.js";
import {beginImpact,stepReaction,advanceImpulse,sweptVehicleHit} from "./wobble/original/impacts.js";
import {makeShot,shotHits,stepBurst} from "./wobble/original/combat.js";
import {
  clamp,
  angleDelta,
  distance,
  forward,
  seededRandom,
  drivePlayer,
  MAX_CAR_SPEED,
  collideCars as physicsCollideCars,
} from "./physics.js";
import {
  roads,
  circuit,
  atCircuit,
  atPublicRoad,
  CIRCUIT_LENGTH,
  SPAWN,
  garages,
  gems,
  closestRoad,
  inWater,
  buildings,
  MISSIONS,
  WORLD_BOUNDS,
  walkingSurfaceHeight,
  vehicleSurfaceHeight,
} from "./district.js";
import { roadGraph, describeRoute } from "./navigation.js";
import {
  resolveWorldCollision,
  segmentBlocked,
  driveableConnector,
} from "./collision-world.js";
export {
  clamp,
  angleDelta,
  distance,
  seededRandom,
  collideBuildings,
} from "./physics.js";
export const BUILDINGS = buildings,
  COOLDOWN_SECONDS = 5,
  TRANSITION_SECONDS = 3.6,
  EXPLOSION_SECONDS = 3,
  POLICE_RESPONSE_SECONDS = 5,
  POLICE_HEAD_START_SPEED = 20 / 3.6,
  POLICE_IMPACT_GRACE_SECONDS = 2;
export const makeVehicle = (x, z, heading = 0) => ({
  x,
  z,
  y: 0,
  heading,
  vx: 0,
  vz: 0,
  speed: 0,
  steer: 0,
  hit: 0,
});
const emit = (g, text, kind = "info") => g.events.push({ text, kind }),
  missionSite = MISSIONS[0];
export function collideCars(a, b) {
  return physicsCollideCars(a, b);
}
const vehicle = (id, type, name, p, extra = {}) => ({
  id,
  type,
  name,
  ...makeVehicle(p.x, p.z, p.heading),
  y: p.y || 0,
  halfL: type === "mini" ? 2.05 : type === "sports" ? 2.55 : 2.65,
  halfW: type === "mini" ? 1 : 1.14,
  destroyed: false,
  visible: true,
  missionVehicle: false,
  ...extra,
});

function overlapsPedestrian(car, person) {
  const f = forward(car.heading),
    dx = person.x - car.x,
    dz = person.z - car.z;
  return (
    Math.abs(dx * f.x + dz * f.z) < (car.halfL || 2.4) + 0.3 &&
    Math.abs(dx * -f.z + dz * f.x) < (car.halfW || 1.1) + 0.35
  );
}
function resolveParkedVehicle(body, parked) {
  if (distance(body, parked) > 7) return;
  const obstacle = { ...parked, vx: 0, vz: 0 };
  const x = body.x,
    z = body.z;
  physicsCollideCars(body, obstacle);
  // collideCars shares separation between two bodies; parked cars remain fixed.
  body.x += body.x - x;
  body.z += body.z - z;
}
function safeExit(g) {
  const car = g.player,
    f = forward(car.heading);
  // +X on the imported (+Z forward) model is the driver's door.
  const candidate = { x: car.x + f.z * 2.3 - f.x, z: car.z - f.x * 2.3 - f.z };
  if (!driveableConnector(car, candidate, 0.45)) return null;
  if (
    availableCars(g).some(
      (v) =>
        v.id !== g.activeVehicleId &&
        !v.destroyed &&
        overlapsPedestrian(v, candidate),
    )
  )
    return null;
  return candidate;
}

export function createGame(saved = []) {
  const collected = [
      ...new Set(saved.filter((id) => gems.some((x) => x.id === id))),
    ],
    starter = SPAWN,
    mini = atCircuit(62, 3.6);
  const vehicles = [
    vehicle("starter-jeep", "jeep", "Marina Jeep", starter),
    vehicle("starter-sports", "sports", "Marina Sports", {...starter,x:starter.x-Math.sin(starter.heading)*10,z:starter.z+Math.cos(starter.heading)*10}),
    vehicle("starter-mini", "mini", "Marina Mini", {...starter,x:starter.x-Math.sin(starter.heading)*20,z:starter.z+Math.cos(starter.heading)*20}),
    vehicle(missionSite.vehicleId, "sports", "Gem Runner", missionSite, {
      missionVehicle: true,
    }),
    vehicle("city-mini", "mini", "City Mini", mini),
  ];
  // Parked, enterable fleet spread across the existing street network.
  for (let i = 0; i < 48 && vehicles.length < 15; i++) {
    const p = atCircuit(220 + i * (CIRCUIT_LENGTH - 300) / 48, i % 2 ? -7 : 7);
    if (closestRoad(p).distance < 6.5) continue;
    const f = forward(p.heading), door = {x:p.x-f.z*4,z:p.z+f.x*4};
    if (!driveableConnector(p,p,1.3) || !driveableConnector(p,door,.45)) continue;
    const type = ["jeep","sports","mini"][i%3];
    vehicles.push(vehicle(`parked-${i}`,type,`${type === "jeep" ? "Jeep" : type === "sports" ? "Sports Car" : "City Mini"} ${i+1}`,p));
  }
  const random = seededRandom(9371);
  for(const car of vehicles)car.y=vehicleSurfaceHeight(car);
  const traffic = Array.from({ length: 28 }, (_, i) => {
    const direction = i % 3 === 0 ? -1 : 1,
      along = 125 + (i * CIRCUIT_LENGTH) / 28,
      p = atCircuit(along, 4.2, direction);
    return {
      ...makeVehicle(p.x, p.z, p.heading),
      id: `traffic-${i}`,
      name: `City ${["Jeep", "Sports Car", "Mini"][i % 3]}`,
      y: p.y,
      along,
      direction,
      cruise: i % 7 === 0 ? 11 : 15 + (i % 5),
      color: i % 6,
      type: ["jeep", "sports", "mini"][i % 3],
      halfL: [2.65, 2.55, 2.05][i % 3],
      halfW: i % 3 === 2 ? 1 : 1.14,
      near: false,
    };
  });
  traffic.slice(-6).forEach((t, i) => {
    t.publicRoad = roads.filter((r) => r.kind === "public")[i % 2];
    t.along = 75 + Math.floor(i / 2) * 130;
    t.direction = 1;
    Object.assign(t, atPublicRoad(t.publicRoad, t.along));
  });
  const pedestrians = Array.from({ length: 120 }, (_, i) => {
    const start = 80 + i * CIRCUIT_LENGTH / 100,
      side = i % 2 === 0 ? 1 : -1,
      p = atCircuit(start, 14 * side);
    return {
      id: `pedestrian-${i}`,
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      along: start,
      home: start,
      direction: side,
      side,
      speed: 0.9 + (i % 3) * 0.18,
      color: i % 5,
      appearance: Math.floor(random() * 800),
      hit: false,
      wanderTimer: random() * 6,
      randomState: i + 731,
      walking: true,
    };
  });
  pedestrians.slice(100).forEach((p, i) => {
    const road = roads.find(r => r.id === "merlion-access");
    const q = road.points[Math.floor(i * (road.points.length - 1) / 20)];
    Object.assign(p, q, { wanderRoad: road, waypoint: i % road.points.length });
  });
  // Several pedestrians cross the live road, making the pursuit rule discoverable in normal play.
  pedestrians.slice(0, 3).forEach((p, i) => {
    const q = atCircuit(150 + i * 1450, (i % 2 ? 1 : -1) * 2.5);
    Object.assign(p, q, {
      along: 150 + i * 1450,
      home: 150 + i * 1450,
      side: (i % 2 ? 1 : -1) * 0.18,
    });
  });
  const sf = forward(starter.heading),
    start = { ...starter, x: starter.x - sf.z * 4, z: starter.z + sf.x * 4 };
  const g = {
    status: "ready",
    phase: "free",
    mode: "foot",
    character: "kai",
    player: {
      ...makeVehicle(start.x, start.z, SPAWN.heading),
      y: walkingSurfaceHeight(start),
      id: null,
      type: "character",
      halfL: 0.45,
      halfW: 0.45,
    },
    vehicles,
    activeVehicleId: null,
    transition: null,
    mission: collected.length === gems.length ? "complete" : "available",
    patrols: createPolicePatrols(),
    encounter: null,
    policeHits: 0,
    pursuitDelay: 0,
    policeImpactGrace: 0,
    explosion: null,
    traffic,
    pedestrians,
    pedestrianImpacts: [],
    shots: [],
    gunHealth: 100,
    police: Array.from({ length: 3 }, (_, i) => ({
      ...makeVehicle(0, 0),
      id: `police-${i}`,
      type: "sports",
      name: "Police Sports Car",
      visible: false,
      path: null,
      pathTimer: 0,
      lastSeen: null,
      contact: false,
    })),
    score: 0,
    elapsed: 0,
    health: 100,
    boost: 100,
    boosting: false,
    escape: 0,
    nearestCop: Infinity,
    busted: 0,
    distance: 0,
    collisions: 0,
    nearMisses: 0,
    collected,
    gemsSinceChase: 0,
    escapes: 0,
    events: [],
    resetCooldown: 0,
    outcome: "",
    cooldownArea: null,
    seen: false,
    unseen: 0,
    lastSafe: { ...SPAWN },
    navigation: null,
    guidance: null,
    navTimer: 0,
    lapProgress: 0,
    lapNext: 1,
    laps: 0,
    lapStart: 0,
    lastLap: 0,
    waterRescue: 0,
  };
  updateGuidance(g);
  return g;
}
export function selectCharacter(g, id) {
  if (!["kai", "rae"].includes(id) || g.status !== "ready") return false;
  g.character = id;
  return true;
}
export function startGame(g) {
  if (g.status === "ready") g.status = "running";
}
export function togglePause(g) {
  if (g.status === "running") g.status = "paused";
  else if (g.status === "paused") g.status = "running";
}
function guidance(target, kind, route) {
  return describeRoute(route?.points[0] || target, route, target, kind);
}
export function updateGuidance(g) {
  const tree = roadGraph.distancesFrom(g.player);
  if (g.phase !== "free") {
    const x = garages
      .map((a) => ({ a, r: roadGraph.routeTo(tree, a.inside) }))
      .filter((x) => x.r)
      .sort((a, b) => a.r.distance - b.r.distance)[0];
    g.guidance = x ? guidance(x.a, "cooldown", x.r) : null;
  } else if (g.mission === "available")
    g.guidance = guidance(
      missionSite,
      "mission",
      roadGraph.routeTo(tree, missionSite),
    );
  else if (g.mission === "active") {
    const x = gems
      .filter((v) => !g.collected.includes(v.id))
      .map((a) => ({ a, r: roadGraph.routeTo(tree, a) }))
      .filter((x) => x.r)
      .sort((a, b) => a.r.distance - b.r.distance)[0];
    g.guidance = x ? guidance(x.a, "gem", x.r) : null;
  } else g.guidance = null;
  g.navTimer = 0.65;
  return g.guidance;
}
const nearestVehicle = (g, max = 7) =>
  availableCars(g)
    .map((v) => ({ v, d: distance(g.player, v) }))
    .filter((x) => !x.v.destroyed && x.d <= max)
    .sort((a, b) => a.d - b.d)[0]?.v || null;
export function interact(g) {
  if (g.status !== "running" || g.transition || g.mode === "encounter" || g.mode === "exploding" || g.player.reaction)
    return false;
  if (g.mode === "foot") {
    if (g.player.grounded === false) return false;
    let v = nearestVehicle(g);
    if (!v) return false;
    const path=boardingRoute(g.player,v,availableCars(g));
    if(!path){emit(g,"The driver’s door is blocked · approach from another side","warning");return false;}
    if (!g.vehicles.includes(v)) {
      const source=v, police=g.police.includes(source);
      v={...source,id:`owned-${source.id}-${g.vehicles.length}`,name:source.name || 'Police Sports Car',type:source.type || 'sports',police,visible:true,destroyed:false,vx:0,vz:0,speed:0};
      source.claimed=true;source.visible=false;source.officerActive=false;source.vx=source.vz=source.speed=0;
      g.vehicles.push(v);
    }
    g.player.vx=g.player.vz=g.player.speed=0;
    g.mode = "boarding";
    g.activeVehicleId = v.id;
    g.transition = {
      progress: 0,
      phase: "approach",
      path,
      duration: 2.8,
      approachSpeed: 0,
      vehicleId: v.id,
    };
    emit(g, `Entering ${v.name}`);
    return true;
  }
  if (g.mode === "driving") {
    if (Math.hypot(g.player.vx, g.player.vz) > 3) {
      emit(g, "Stop the car before exiting", "warning");
      return false;
    }
    const exitPosition = safeExit(g);
    if (!exitPosition) {
      emit(g, "Move the car away from the wall before exiting", "warning");
      return false;
    }
    g.mode = "exiting";
    g.transition = {
      progress: 0,
      duration: TRANSITION_SECONDS,
      vehicleId: g.activeVehicleId,
      exitPosition,
    };
    g.player.vx = g.player.vz = g.player.speed = 0;
    emit(g, "Exiting vehicle");
    return true;
  }
  return false;
}
export function recoverCar(g) {
  if (
    g.status !== "running" ||
    g.resetCooldown > 0 ||
    g.mode === "encounter" ||
    g.mode === "exploding" ||
    g.transition
  )
    return;
  resetJump(g.player);
  const q = closestRoad(g.player),
    target = driveableConnector(g.player, q) ? q : g.lastSafe;
  Object.assign(g.player, {
    x: target.x,
    z: target.z,
    y: target.y || 0,
    heading: target.heading || 0,
    vx: 0,
    vz: 0,
    speed: 0,
    hit: 1,
  });
  if (g.activeVehicleId)
    Object.assign(
      g.vehicles.find((v) => v.id === g.activeVehicleId) || {},
      g.player,
    );
  g.score = Math.max(0, g.score - 250);
  g.resetCooldown = 5;
  g.escape = 0;
  g.waterRescue = 0;
  emit(g, "Recovered to the road · −250", "warning");
  updateGuidance(g);
}
export function triggerPursuit(g) {
  if (g.status !== "running" || g.phase !== "free" || !["driving","foot"].includes(g.mode))
    return false;
  g.phase = "pursuit";
  g.pursuitDelay = POLICE_RESPONSE_SECONDS;
  g.policeImpactGrace = 0;
  g.escape = 0;
  g.unseen = 0;
  g.busted = 0;
  g.policeHits = 0;
  const nearest = closestRoad(g.player, [roads[0]]);
  let along = 0;
  for (let i = 0; i < nearest.index; i++)
    along += distance(circuit[i], circuit[(i + 1) % circuit.length]);
  along += distance(nearest.a, nearest);
  g.police.forEach((c, i) => {
    let p = atCircuit(along - 100 - i * 30, 3.5);
    // Circuit bends must not place an interceptor immediately beside the player.
    for(let back=130+i*30;distance(p,g.player)<70&&back<CIRCUIT_LENGTH;back+=30)p=atCircuit(along-back,3.5);
    Object.assign(c, {
      ...makeVehicle(p.x, p.z, p.heading),
      y: p.y,
      visible: i < 2,
      claimed: false,
      path: null,
      pathTimer: 0,
      lastSeen: { x: g.player.x, z: g.player.z, y: g.player.y },
      contact: false,
      searchUntil: 0,
      halfL: 2.55, halfW: 1.14,
      searchingCourt: false,
    });
  });
  emit(g, `POLICE ALERT · ${POLICE_RESPONSE_SECONDS}-second head start · Follow the amber route`, "warning");
  updateGuidance(g);
  return true;
}
export function hasLineOfSight(a, b) {
  return distance(a, b) < 135 && !segmentBlocked(a, b, 0, true);
}
function pointAhead(path, p, ahead = 11) {
  if (!path || path.length < 2) return p;
  let best = Infinity,
    index = 0;
  for (let i = 0; i < path.length; i++) {
    const d = distance(p, path[i]);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  let left = ahead;
  for (let i = index; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      d = distance(a, b);
    if (d >= left) {
      const t = left / d;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= d;
  }
  return path.at(-1);
}
function steerAI(c, target, cruise, dt) {
  const desired = Math.atan2(target.x - c.x, -(target.z - c.z)),
    turn = angleDelta(desired, c.heading);
  c.heading += clamp(turn, -2.1 * dt, 2.1 * dt);
  const wanted = cruise * clamp(1 - Math.abs(turn) * 0.65, 0.18, 1),
    f = forward(c.heading),
    blend = 1 - Math.exp(-4 * dt);
  c.vx += (f.x * wanted - c.vx) * blend;
  c.vz += (f.z * wanted - c.vz) * blend;
  c.speed = Math.hypot(c.vx, c.vz);
}
function policeStep(g, c, dt) {
  if (!c.visible) {c.officerActive=false;return;}
  c.officerActive=!(g.pursuitDelay>0)&&g.mode==="foot" && (g.meleeAlert || distance(c,g.player)<27) && g.phase!=="free";
  if(c.officerActive){steerAI(c,c,0,dt);if(g.meleeAlert)stepDeployedOfficer(g,c,dt);return;}
  const visible = hasLineOfSight(c, g.player);
  const playerCourt = garages.find(area => area.contains(g.player));
  if (visible || !playerCourt) {
    c.lastSeen = { x: g.player.x, z: g.player.z, y: g.player.y };
    c.searchUntil = 0;
  }
  const court = playerCourt;
  // A lost target in a covered courtyard is uncertain information. Search its
  // approach briefly instead of navigating straight to a hidden player.
  if (!visible && court && !c.searchUntil) c.searchUntil = g.elapsed + 12;
  const searchingCourt = !visible && court && g.elapsed < c.searchUntil;
  if (searchingCourt && distance(c, court.approach) > 12)
    c.searchUntil = Math.max(c.searchUntil, g.elapsed + 12);
  const goal = searchingCourt ? court.approach : c.lastSeen;
  if (c.searchingCourt !== Boolean(searchingCourt)) c.pathTimer = 0;
  c.searchingCourt = Boolean(searchingCourt);
  c.pathTimer -= dt;
  if (c.pathTimer <= 0) {
    c.path = roadGraph.route(c, goal)?.points || null;
    c.pathTimer = .5;
  }
  const direct =
    !searchingCourt && distance(c, g.player) < 100 && driveableConnector(c, g.player);
  const intercept = {
    x: g.player.x + (g.player.vx || 0) * .65,
    z: g.player.z + (g.player.vz || 0) * .65,
    y: g.player.y,
  };
  const target = direct
    ? (driveableConnector(c, intercept) ? intercept : g.player)
    : pointAhead(c.path, c, searchingCourt ? 9 : clamp(c.speed * .65, 12, 28));
  const arrived = searchingCourt && !visible && distance(c, goal) < 12;
  const inServiceApproach = court && distance(c, court.entrance) < 75;
  steerAI(
    c,
    target,
    arrived
      ? 0
      : g.pursuitDelay > 0
        ? POLICE_HEAD_START_SPEED
        : searchingCourt || inServiceApproach
        ? 8
        : MAX_CAR_SPEED * .88,
    dt,
  );
}

function policeShooting(g,dt) {
  if(g.pursuitDelay>0)return;
  for(const c of [...g.police,...g.patrols]) {
    c.recoil=Math.max(0,(c.recoil||0)-dt*7);c.flashTime=Math.max(0,(c.flashTime||0)-dt);
    const side=forward(c.heading),origin={x:c.x+(c.footPatrol?0:side.z*2.2),y:walkingSurfaceHeight(c.footPatrol?c:(c.officerPosition||c))+1.45,z:c.z-(c.footPatrol?0:side.x*2.2)};
    if(!c.reaction&&!c.hurt&&!(g.meleeAlert&&!c.footPatrol))c.officerPosition={x:origin.x,y:walkingSurfaceHeight(origin),z:origin.z};
    const target={x:g.player.x,y:(g.player.y||0)+1.12,z:g.player.z};
    const ready=!(g.meleeAlert&&g.mode==='foot')&&!c.attack&&!(c.hitstun>0)&&!c.reaction&&c.visible&&c.officerActive&&g.phase!=="free"&&(g.mode==="foot"||(c.footPatrol&&g.mode==="driving"))&&!g.player.reaction&& !segmentBlocked(origin,target,.05,true)
      &&!g.vehicles.some(v=>!v.destroyed&&v.id!==g.activeVehicleId&&segmentCrossesCar(origin,target,v));
    if(!stepBurst(c,dt,ready,()=>.5))continue;
    const random=c.shotRandom||(c.shotRandom=seededRandom(143+(c.id?.length||0)));
    const muzzle=c.muzzleOrigin&&Math.hypot(c.muzzleOrigin.x-origin.x,c.muzzleOrigin.z-origin.z)<1?c.muzzleOrigin:origin;
    const barrel=c.muzzleDirection?{x:muzzle.x+c.muzzleDirection.x*30,y:muzzle.y+c.muzzleDirection.y*30,z:muzzle.z+c.muzzleDirection.z*30}:target;
    const shot=makeShot(muzzle,barrel,random,1+(c.recoil||0)*1.2),result=resolvePoliceShot(g,c,shot),hit=result.contact?.entity===g.player;
    if(result.contact&&!hit){const victim=result.contact.entity;victim.health=Math.max(1,(victim.health??100)-18);victim.hitstun=.45;victim.attack=null;victim.fireCooldown=.8;
      g.pedestrianImpacts.push({x:victim.x,y:victim.y||0,z:victim.z,dx:Math.sin(c.heading)*.3,dz:-Math.cos(c.heading)*.3,time:g.elapsed});if(g.pedestrianImpacts.length>16)g.pedestrianImpacts.shift();
      if(victim.health<35){victim.hitCooldown=0;beginImpact(victim,{x:Math.sin(c.heading),z:-Math.cos(c.heading)},2.5,origin);victim.hit=true;if(victim.footPatrol)victim.reaction.startHeading=Math.PI-victim.heading;}
    }
    g.shots.push({from:muzzle,to:result.end,time:g.elapsed,copId:c.id,hit});if(g.shots.length>16)g.shots.shift();
    c.recoil=1;c.flashTime=.07;
    if(hit&&g.mode==="foot"){g.gunHealth=Math.max(0,g.gunHealth-18);emit(g,`Police gunfire · ${g.gunHealth}% health`,"warning");
      g.pedestrianImpacts.push({x:target.x,y:g.player.y||0,z:target.z,dx:Math.sin(c.heading),dz:-Math.cos(c.heading),time:g.elapsed});if(g.pedestrianImpacts.length>16)g.pedestrianImpacts.shift();
      if(g.gunHealth===0){beginImpact(g.player,{x:target.x-origin.x,z:target.z-origin.z},3,origin);g.player.reaction.startHeading=Math.PI-g.player.heading;g.player.dead=true;g.deathTimer=0;}
    }
  }
}
function segmentCrossesCar(a,b,car){
  return sweptVehicleHit({heading:-car.heading,width:(car.halfW||1.14)*2,length:(car.halfL||2.55)*2},a,b,car,0);
}

function explode(g) {
  const v = g.vehicles.find((x) => x.id === g.activeVehicleId);
  g.encounter = null;
  g.mode = "exploding";
  g.explosion = {
    elapsed: 0,
    x: g.player.x,
    y: g.player.y || 0,
    z: g.player.z,
    heading: g.player.heading,
  };
  g.transition = null;
  if (v) Object.assign(v, { vx: 0, vz: 0, speed: 0, destroyed: true });
  g.player.vx = g.player.vz = g.player.speed = 0;
  emit(g, "WOBBLEHEAD WIPEOUT!", "impact");
}
function respawn(g) {
  resetJump(g.player);
  const starterPoint = SPAWN,
    sf = forward(starterPoint.heading),
    p = {
      ...starterPoint,
      x: starterPoint.x - sf.z * 4,
      z: starterPoint.z + sf.x * 4,
    };
  Object.assign(g.player, {
    ...makeVehicle(p.x, p.z, p.heading),
    y: walkingSurfaceHeight(p),
    id: null,
    type: "character",
    halfL: 0.45,
    halfW: 0.45,
  });
  g.encounter=null;
  g.patrols.forEach(c=>{c.officerActive=false;c.burstRemaining=0;});
  g.player.reaction=null;g.player.dead=false;g.gunHealth=100;g.pursuitDelay=0;g.policeImpactGrace=0;g.meleeAlert=false;g.player.attack=null;g.player.health=100;g.player.hitstun=0;g.player.hurt=null;
  g.mode = "foot";
  g.activeVehicleId = null;
  g.transition = null;
  g.explosion = null;
  g.phase = "free";
  g.escape = 0;
  g.seen = false;
  g.unseen = 0;
  g.policeHits = 0;
  g.police.forEach((c) =>
    Object.assign(c, { visible: false, contact: false, vx: 0, vz: 0 }),
  );
  const starter = g.vehicles.find((v) => v.id === "starter-jeep");
  Object.assign(
    starter,
    vehicle("starter-jeep", "jeep", "Marina Jeep", starterPoint),
  );
  emit(g, "Respawned at Merlion Park");
  updateGuidance(g);
}
function transitionStep(g, dt) {
  const t = g.transition;
  const v = g.vehicles.find((x) => x.id === t.vehicleId);
  if(!v||v.destroyed){g.transition=null;g.mode='foot';g.activeVehicleId=null;return;}
  if(g.mode==='boarding'&&t.phase==='approach'){
    const goal=t.path[0],d=distance(g.player,goal);
    // Ease into a brisk walk and brake gently at the handle, without stopping at corners.
    const targetSpeed=t.path.length===1?Math.min(2.15,Math.sqrt(8*d)):2.15;
    t.approachSpeed+=(targetSpeed-t.approachSpeed)*(1-Math.exp(-10*dt));
    const step=Math.min(d,t.approachSpeed*dt);
    if(d>.001){const dx=(goal.x-g.player.x)/d,dz=(goal.z-g.player.z)/d;
      const next={x:g.player.x+dx*step,z:g.player.z+dz*step};
      if(!driveableConnector(g.player,next,.3)){g.transition=null;g.mode='foot';g.activeVehicleId=null;emit(g,'Door approach blocked','warning');return;}
      Object.assign(g.player,next,{y:walkingSurfaceHeight(next),vx:dx*step/dt,vz:dz*step/dt,speed:step/dt});
      g.player.heading+=clamp(angleDelta(Math.atan2(dx,-dz),g.player.heading),-4.5*dt,4.5*dt);
    }
    if(d<=step+.001){t.path.shift();if(!t.path.length){t.phase='align';g.player.vx=g.player.vz=g.player.speed=0;}}
    return;
  }
  if(g.mode==='boarding'&&t.phase==='align'){
    const delta=angleDelta(v.heading+Math.PI/2,g.player.heading);
    g.player.heading+=clamp(delta*(1-Math.exp(-12*dt)),-5*dt,5*dt);
    if(Math.abs(delta)<.015){g.player.heading=v.heading+Math.PI/2;t.phase='motion';t.boardPosition={x:g.player.x,z:g.player.z};}return;
  }
  t.progress = Math.min(1, t.progress + dt / t.duration);
  if(g.mode==='boarding'){
    const pose=boardingPose(t.progress),from=t.boardPosition;
    g.player.x=from.x+(v.x-from.x)*pose.seat;g.player.z=from.z+(v.z-from.z)*pose.seat;
    g.player.y=v.y;g.player.heading=v.heading+Math.PI/2*(1-pose.turn);
  }
  if (t.progress < 1) return;
  if (g.mode === "boarding" && v) {
    g.mode = "driving";
    Object.assign(g.player, v);
    if (v.missionVehicle && g.mission === "available") {
      g.mission = "active";
      emit(g, "MARINA GEM RUN · Collect all 24 gems", "gem");
    }
  } else if (g.mode === "exiting" && v) {
    const exit = t.exitPosition || safeExit(g);
    if (!exit) {
      g.mode = "driving";
      g.transition = null;
      return;
    }
    Object.assign(v, g.player);
    Object.assign(g.player, {
      ...makeVehicle(exit.x, exit.z, v.heading),
      id: null,
      type: "character",
      y: walkingSurfaceHeight(exit),
      halfL: 0.45,
      halfW: 0.45,
    });
    g.mode = "foot";
    g.activeVehicleId = null;
  }
  g.transition = null;
  updateGuidance(g);
}
function footStep(g, input, dt) {
  g.player.heading += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 2.8 * dt;
  const walk = input.boost ? 5.5 : 2.5,
    pace = input.forward ? walk : input.reverse ? -2 : 0,
    f = forward(g.player.heading);
  g.player.halfL = g.player.halfW = 0.45;
  g.player.vx = f.x * pace;
  g.player.vz = f.z * pace;
  g.player.speed = pace;
  g.player.x = clamp(
    g.player.x + g.player.vx * dt,
    WORLD_BOUNDS.minX,
    WORLD_BOUNDS.maxX,
  );
  g.player.z = clamp(
    g.player.z + g.player.vz * dt,
    WORLD_BOUNDS.minZ,
    WORLD_BOUNDS.maxZ,
  );
  resolveWorldCollision(g.player);
  const ground = closestRoad(g.player);
  g.player.y = walkingSurfaceHeight(g.player);
  if (inWater(g.player) && ground.distance > ground.road.width / 2) {
    const v = g.vehicles.find((x) => x.id === "starter-jeep");
    Object.assign(g.player, {
      ...makeVehicle(v.x, v.z, v.heading),
      x: v.x - forward(v.heading).z * 4,
      z: v.z + forward(v.heading).x * 4,
      y: v.y || 0,
      halfL: 0.45,
      halfW: 0.45,
    });
    resetJump(g.player);
    emit(g, "Returned safely to the promenade", "warning");
    g.player.y = walkingSurfaceHeight(g.player);
  }
}
function collect(g) {
  if (g.mission !== "active" || g.phase !== "free" || g.mode !== "driving")
    return;
  for (const gem of gems)
    if (!g.collected.includes(gem.id) && distance(g.player, gem) < 6.8) {
      g.collected.push(gem.id);
      g.score += 500;
      g.boost = Math.min(100, g.boost + 15);
      emit(g, `GEM ${g.collected.length} / ${gems.length} · +500`, "gem");
      if (g.collected.length === gems.length) {
        g.mission = "complete";
        g.score += 3000;
        emit(g, "MARINA GEM RUN COMPLETE · +3,000", "reward");
      }
      updateGuidance(g);
      break;
    }
}
function lapStep(g) {
  if (distance(g.player, circuit[g.lapNext]) < 24) {
    g.lapNext = (g.lapNext + 1) % circuit.length;
    if (g.lapNext === 1) {
      g.laps++;
      g.lastLap = g.elapsed - g.lapStart;
      g.lapStart = g.elapsed;
      g.score += 2000;
      emit(g, "FULL CIRCUIT LAP · +2,000", "reward");
    }
  }
  g.lapProgress = g.lapNext / circuit.length;
}
function pursuit(g, dt) {
  if (g.phase === "free") {
    g.nearestCop = Infinity;
    g.seen = false;
    return;
  }
  g.nearestCop = Math.min(
    ...g.police.filter((c) => c.visible).map((c) => distance(c, g.player)),
  );
  g.seen = g.police.some((c) => c.visible && hasLineOfSight(c, g.player));
  const area = garages.find((a) => a.contains(g.player));
  g.cooldownArea = area?.id || null;
  g.unseen = g.seen ? 0 : g.unseen + dt;
  const parked =
    g.mode === "driving" && Math.hypot(g.player.vx, g.player.vz) < 0.5;
  if (area && parked && !g.seen && g.unseen > 1.25) {
    if (g.phase !== "cooldown") {
      g.phase = "cooldown";
      emit(g, "IN COVER · Hold position while heat clears", "cooldown");
    }
    g.escape += dt;
    if (g.escape >= COOLDOWN_SECONDS) {
      g.phase = "free";
      g.escape = 0;
      g.escapes++;
      g.score += 1500;
      g.boost = 100;
      g.police.forEach((c) =>
        Object.assign(c, { visible: false, contact: false, vx: 0, vz: 0 }),
      );
      g.cooldownArea = null;
      g.seen = false;
      g.unseen = 0;
      g.policeHits = 0;
      emit(g, "HEAT CLEARED · Mission progress preserved", "escape");
      updateGuidance(g);
    }
  } else {
    if (g.phase === "cooldown") {
      emit(
        g,
        g.seen ? "SPOTTED · Cooldown interrupted" : "Stay parked inside cover",
        "warning",
      );
      g.phase = "pursuit";
    }
    g.escape = 0;
  }
}
export function stepGame(g, input = {}, dt) {
  if (g.status !== "running") return;
  dt = clamp(dt, 0, 1 / 30);
  if (g.mode !== "foot" || g.player.reaction) resetJump(g.player);
  g.elapsed += dt;
  g.pursuitDelay=Math.max(0,(g.pursuitDelay||0)-dt);
  g.policeImpactGrace=Math.max(0,(g.policeImpactGrace||0)-dt);
  g.resetCooldown = Math.max(0, g.resetCooldown - dt);
  if (g.mode === "encounter") {
    g.encounter.elapsed+=dt;
    if(g.encounter.elapsed>=g.encounter.duration+.6)explode(g);
    return;
  }
  if (g.mode === "exploding") {
    g.explosion.elapsed += dt;
    if (g.explosion.elapsed >= EXPLOSION_SECONDS) respawn(g);
    return;
  }
  const previousPlayerPosition = {x:g.player.x,z:g.player.z};
  if (g.transition) transitionStep(g, dt);
  else if (g.mode === "driving") drivePlayer(g, input, dt);
  else if(g.player.reaction) {
    stepReaction(g.player,dt);
    if(g.player.dead){g.deathTimer=(g.deathTimer||0)+dt;if(g.deathTimer>3.3)respawn(g);}
  } else footStep(g, g.player.attack || g.player.hitstun>0 ? {} : input, dt);
  stepMelee(g,dt,triggerPursuit);
  stepPolicePatrols(g,dt);
  for (const c of g.police) policeStep(g, c, dt);
  for (const t of g.traffic) {
    if(t.claimed)continue;
    const current = t.publicRoad
      ? atPublicRoad(t.publicRoad, t.along)
      : atCircuit(t.along, 4.2, t.direction);
    t.y = current.y;
    if (distance(t, current) < 14) t.along += t.cruise * t.direction * dt;
    const target = t.publicRoad
        ? atPublicRoad(t.publicRoad, t.along + 8)
        : atCircuit(t.along + 8 * t.direction, 4.2, t.direction),
      ahead = {
        x: t.x + Math.sin(t.heading) * 10,
        z: t.z - Math.cos(t.heading) * 10,
      },
      blocked =
        distance(ahead, g.player) < 5 ||
        (g.phase !== "free" && g.police.some((c) => distance(ahead, c) < 5));
    steerAI(t, target, blocked ? 0 : t.cruise, dt);
  }
  const movers = [
    ...(g.mode === "driving" ? [g.player] : []),
    ...g.police.filter((c) => c.visible),
    ...g.traffic.filter(t=>!t.claimed),
  ];
  for (const c of movers) {
    c.hit = Math.max(0, c.hit - dt);
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    resolveWorldCollision(c);
  }
  for (let i = 0; i < movers.length; i++)
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i],
        b = movers[j],
        impact = collideCars(a, b),
        cop = a.id?.startsWith("police-")
          ? a
          : b.id?.startsWith("police-")
            ? b
            : null,
        other = cop === a ? b : a;
      if (
        g.mode === "driving" &&
        g.phase !== "free" &&
        cop &&
        other === g.player &&
        impact >= 4 &&
        !(g.pursuitDelay>0) && !(g.policeImpactGrace>0) &&
        !cop.contact
      ) {
        cop.contact = true;
        g.policeImpactGrace=POLICE_IMPACT_GRACE_SECONDS;
        g.policeHits = Math.min(3, g.policeHits + 1);
        emit(g, `POLICE IMPACT ${g.policeHits} / 3`, "impact");
        if (g.policeHits === 3) {beginPoliceEncounter(g,cop);return;}
      }
    }
  for (const c of movers) {
    resolveWorldCollision(c);
    for (const parked of g.vehicles) {
      if (parked.id === g.activeVehicleId || parked.destroyed) continue;
      resolveParkedVehicle(c, parked);
    }
  }
  if (g.mode === "foot") {
    for (const parked of g.vehicles) {
      if (!parked.destroyed) resolveParkedVehicle(g.player, parked);
    }
    stepJump(g.player, dt, walkingSurfaceHeight(g.player));
  }
  if (g.mode === "driving" && g.activeVehicleId) {
    const v = g.vehicles.find((x) => x.id === g.activeVehicleId);
    if (v) Object.assign(v, g.player);
  }
  if (g.phase !== "free" && g.mode === "driving")
    for (const cop of g.police.filter((c) => c.visible))
      if (distance(cop, g.player) > 8) cop.contact = false;
  if (g.mode === "driving" && !g.explosion)
    for (const p of [...g.pedestrians,...g.patrols])
      if (
        !p.hit && Math.abs((p.y||0)-(g.player.y||0))<1.8 &&
        Math.hypot(g.player.vx, g.player.vz) > 1 &&
        sweptVehicleHit({heading:-g.player.heading,width:(g.player.halfW||1.14)*2,length:(g.player.halfL||2.55)*2},previousPlayerPosition,g.player,p)
      ) {
        p.hit = true;
        p.walkSpeed ??= p.speed;
        beginImpact(p,{x:g.player.vx,z:g.player.vz},Math.hypot(g.player.vx,g.player.vz),g.player);
        if(p.footPatrol){p.reaction.startHeading=Math.PI-p.heading;p.officerActive=false;p.burstRemaining=0;}
        const speed=Math.hypot(g.player.vx,g.player.vz);
        g.pedestrianImpacts.push({x:p.x,y:p.y||0,z:p.z,dx:g.player.vx/speed*2,dz:g.player.vz/speed*2,time:g.elapsed});
        if(g.pedestrianImpacts.length>16)g.pedestrianImpacts.shift();
        emit(g, p.footPatrol?"Officer hit · police alerted":"Pedestrian hit · police alerted", "warning");
        triggerPursuit(g);
        break;
      }
  // Keep a local population in both travel modes. Only distant, out-of-view
  // people are relocated; their IDs and clothing never change.
  g.populationTimer = (g.populationTimer || 0) - dt;
  if (g.populationTimer <= 0) {
    g.populationTimer = 2;
    populateNearbyPedestrians(g);
  }
  for (const p of g.pedestrians) {
    if(p.hitstun>0&&!p.reaction){p.walking=false;continue;}
    if(p.reaction) {
      const r=stepReaction(p,dt);p.walking=false;
      if(r) {
        const delta={x:0,z:0};
        if(r.phase === "falling" || r.phase === "down")advanceImpulse(r,dt,delta);
        else if(r.phase === "fleeing") {p.heading=Math.atan2(r.dx,-r.dz);delta.x=r.dx*3.7*dt;delta.z=r.dz*3.7*dt;p.walking=true;p.speed=3.7;}
        const next={x:p.x+delta.x,z:p.z+delta.z};
        if(driveableConnector(p,next,.4)&&walkingPathClear(g,p,next)){p.x=next.x;p.z=next.z;}
        if(r.phase==="down"&&!r.groundBlood){r.groundBlood=true;g.pedestrianImpacts.push({x:p.x,y:p.y||0,z:p.z,dx:r.dx*.2,dz:r.dz*.2,time:g.elapsed});if(g.pedestrianImpacts.length>16)g.pedestrianImpacts.shift();}
        continue;
      }
      p.hit=false;p.speed=p.walkSpeed||1.2;p.pause=1;
      // Resume from the recovered position, without snapping back to the old path.
      p.wanderRoad={points:[{x:p.x,z:p.z,y:p.y},{x:p.x+Math.sin(p.heading)*8,z:p.z-Math.cos(p.heading)*8,y:p.y}]};p.waypoint=1;
    }
    if (p.hit) { p.walking = false; continue; }
    const random = () => {
      p.randomState = (Math.imul(p.randomState, 1664525) + 1013904223) >>> 0;
      return p.randomState / 4294967296;
    };
    p.wanderTimer -= dt;
    if (p.wanderTimer <= 0) {
      p.direction = random() < 0.5 ? -1 : 1;
      p.pause = random() < 0.25 ? 1 + random() * 3 : 0;
      p.wanderTimer = 4 + random() * 12;
    }
    p.pause = Math.max(0, (p.pause || 0) - dt);
    p.walking = false;
    if (p.pause > 0) continue;
    let next;
    if (p.wanderRoad) {
      const points = p.wanderRoad.points, target = points[p.waypoint];
      if (distance(p, target) < 1) {
        p.waypoint += p.direction;
        if (p.waypoint < 0 || p.waypoint >= points.length) {
          p.direction *= -1; p.waypoint = Math.max(0, Math.min(points.length - 1, p.waypoint));
        }
        continue;
      }
      const heading = Math.atan2(target.x - p.x, -(target.z - p.z));
      next = {x: p.x + Math.sin(heading) * p.speed * dt, z: p.z - Math.cos(heading) * p.speed * dt, y: target.y, heading};
    } else {
      next = atCircuit(p.along + p.speed * p.direction * dt, 14 * p.side);
      next.heading += p.direction < 0 ? Math.PI : 0;
    }
    const safe = driveableConnector(p, next, 0.4) && walkingPathClear(g,p,next)
      && g.pedestrians.every(other => other === p || other.hit || distance(other, next) > 0.65 || distance(other, next) > distance(other, p));
    if (safe) {
      p.along += p.speed * p.direction * dt;
      Object.assign(p, {x: next.x, z: next.z, y: next.y, heading: next.heading});
      p.walking = true;
      p.blockedTime = 0;
    } else {
      p.blockedTime = (p.blockedTime || 0) + dt;
      if (p.blockedTime >= 1) {
        p.blockedTime = 0;
        // A blocked pair of waypoints must not keep a walker reversing forever.
        // Pick a short clear route from the current position, preserving identity.
        for (const turn of [1,-1,2,-2,3,-3,4,0]) {
          const heading = p.heading + turn * Math.PI / 4;
          const target = {x:p.x+Math.sin(heading)*4,z:p.z-Math.cos(heading)*4,y:p.y};
          if (!driveableConnector(p,target,.4)) continue;
          let clear = true;
          for (let i=1;i<=8;i++) {
            const point={x:p.x+(target.x-p.x)*i/8,z:p.z+(target.z-p.z)*i/8};
            if (!movers.every(c=>distance(c,point)>4) || !g.vehicles.filter(v=>!v.destroyed).every(c=>distance(c,point)>3)
              || !g.pedestrians.every(other=>other===p || other.hit || distance(other,point)>.65 || distance(other,point)>distance(other,p))) {clear=false;break;}
          }
          if (!clear) continue;
          p.wanderRoad={points:[{x:p.x,z:p.z,y:p.y},target]};
          p.waypoint=1;p.direction=1;p.pause=0;p.wanderTimer=5;
          break;
        }
        continue;
      }
      p.direction *= -1;
      if (p.wanderRoad) p.waypoint = Math.max(0, Math.min(p.wanderRoad.points.length - 1, p.waypoint + p.direction));
    }
  }
  for(const p of [...g.pedestrians,...g.patrols])separateWalker(g,p);
  if (!g.explosion) pursuit(g, dt);
  policeShooting(g,dt);
  if (g.mode === "driving" && !g.explosion) {
    const q = closestRoad(g.player);
    g.player.y = vehicleSurfaceHeight(g.player,q);
    if (q.distance < q.road.width / 2 - 2 && !segmentBlocked(g.player, q, 1))
      g.lastSafe = { x: q.x, z: q.z, y: q.y, heading: g.player.heading };
    if (inWater(g.player) && q.distance > q.road.width / 2 + 0.5) {
      g.waterRescue += dt;
      if (g.waterRescue > 0.7) {
        g.resetCooldown = 0;
        recoverCar(g);
      }
    } else g.waterRescue = 0;
    const speed = Math.hypot(g.player.vx, g.player.vz);
    g.distance += speed * dt;
    g.score += speed * dt * 0.3;
    collect(g);
    lapStep(g);
    const active = g.vehicles.find((v) => v.id === g.activeVehicleId);
    if (active) Object.assign(active, g.player);
  }
  g.navTimer -= dt;
  if (g.navTimer <= 0) updateGuidance(g);
}
