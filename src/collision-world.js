import { obstacles, inWater, closestRoad, WORLD_BOUNDS } from './district.js';
import { collideBuildings } from './physics.js';

const size=40, cells=new Map();
for(const o of obstacles) {
  const r=Math.hypot(o.w,o.d)/2;
  for(let x=Math.floor((o.x-r)/size);x<=Math.floor((o.x+r)/size);x++)for(let z=Math.floor((o.z-r)/size);z<=Math.floor((o.z+r)/size);z++) {
    const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(o);
  }
}
export function nearbyObstacles(p,r=5) {
  const set=new Set();
  for(let x=Math.floor((p.x-r)/size);x<=Math.floor((p.x+r)/size);x++)for(let z=Math.floor((p.z-r)/size);z<=Math.floor((p.z+r)/size);z++)for(const o of cells.get(`${x},${z}`)||[])set.add(o);
  return [...set];
}
export function resolveWorldCollision(car) {
  const margin=car.halfW||.45;
  const x=Math.max(WORLD_BOUNDS.minX+margin,Math.min(WORLD_BOUNDS.maxX-margin,car.x));
  const z=Math.max(WORLD_BOUNDS.minZ+margin,Math.min(WORLD_BOUNDS.maxZ-margin,car.z));
  if(x!==car.x){car.x=x;car.vx=0;}if(z!==car.z){car.z=z;car.vz=0;}

  let impact=0;
  for(const o of nearbyObstacles(car)) {
    const yaw=o.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=car.x-o.x,dz=car.z-o.z;
    const local={x:dx*c-dz*s,z:dx*s+dz*c,vx:car.vx*c-car.vz*s,vz:car.vx*s+car.vz*c,heading:car.heading+yaw,halfW:car.halfW,halfL:car.halfL};
    impact=Math.max(impact,collideBuildings(local,[{x:0,z:0,w:o.w,d:o.d}]));
    car.x=o.x+local.x*c+local.z*s;car.z=o.z-local.x*s+local.z*c;
    car.vx=local.vx*c+local.vz*s;car.vz=-local.vx*s+local.vz*c;
  }
  return impact;
}
export function segmentBlocked(a,b,padding=0,opaqueOnly=false) {
  const length=Math.hypot(b.x-a.x,b.z-a.z),candidates=new Set();
  const steps=Math.max(1,Math.ceil(length/30));
  for(let i=0;i<=steps;i++)for(const o of nearbyObstacles({x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps},padding+1))candidates.add(o);
  for(const o of candidates) {
    if(opaqueOnly&&o.kind==='barrier')continue;
    const yaw=o.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
    const p={x:(a.x-o.x)*c-(a.z-o.z)*s,z:(a.x-o.x)*s+(a.z-o.z)*c};
    const q={x:(b.x-o.x)*c-(b.z-o.z)*s,z:(b.x-o.x)*s+(b.z-o.z)*c};
    let near=0,far=1;
    for(const [axis,extent]of[['x',o.w/2+padding],['z',o.d/2+padding]]) {
      const delta=q[axis]-p[axis];
      if(Math.abs(delta)<1e-8){if(Math.abs(p[axis])>extent){near=2;break;}}
      else {const t1=(-extent-p[axis])/delta,t2=(extent-p[axis])/delta;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));}
    }
    if(near<=far&&far>0&&near<1)return true;
  }
  return false;
}
export function driveableConnector(a,b,padding=1.5) {
  if(b.x<WORLD_BOUNDS.minX+padding||b.x>WORLD_BOUNDS.maxX-padding||b.z<WORLD_BOUNDS.minZ+padding||b.z>WORLD_BOUNDS.maxZ-padding)return false;

  if(segmentBlocked(a,b,padding))return false;
  const d=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(d/8));
  for(let i=0;i<=steps;i++) {
    const p={x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps};
    if(inWater(p)){const q=closestRoad(p);if(q.distance>q.road.width/2)return false;}
  }
  return true;
}
