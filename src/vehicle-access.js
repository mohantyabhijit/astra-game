import {driveableConnector} from './collision-world.js';
import {sweptVehicleHit} from './wobble/original/impacts.js';

export function availableCars(g) {
  return [...g.vehicles, ...g.traffic.filter(c=>!c.claimed), ...g.police.filter(c=>!c.claimed)]
    .filter(c=>!c.destroyed && c.visible!==false);
}
export function walkingPathClear(g, from, to) {
  return availableCars(g).every(c=>Math.abs((c.y||0)-(from.y||0))>1.8 || !sweptVehicleHit(
    {heading:-c.heading,width:(c.halfW||1.14)*2,length:(c.halfL||2.55)*2},
    c,{x:c.x-(to.x-from.x),z:c.z-(to.z-from.z)},from,.35));
}
// Moving cars can reach an idle walker between route updates. Separate their bodies.
export function separateWalker(g,p) {
  if((p.hit && p.reaction?.phase!=='fleeing') || (p.reaction && p.reaction.phase!=='fleeing'))return;
  for(const c of availableCars(g)) {
    if(Math.abs((c.y||0)-(p.y||0))>1.8)continue;
    const cos=Math.cos(c.heading),sin=Math.sin(c.heading),dx=p.x-c.x,dz=p.z-c.z;
    const x=cos*dx+sin*dz,z=-sin*dx+cos*dz,w=(c.halfW||1.14)+.36,l=(c.halfL||2.55)+.36;
    if(Math.abs(x)>=w || Math.abs(z)>=l)continue;
    const candidates=[{x:Math.sign(x||1)*w,z},{x,z:Math.sign(z||1)*l}]
      .sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z));
    for(const q of candidates){const next={x:c.x+cos*q.x-sin*q.z,z:c.z+sin*q.x+cos*q.z};
      if(driveableConnector(p,next,.35)){Object.assign(p,next);p.walking=false;break;}}
  }
}
