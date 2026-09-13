import {bodyHit} from './wobble/original/boxing.js';
import {segmentBlocked} from './collision-world.js';
import {sweptVehicleHit} from './wobble/original/impacts.js';
export function resolvePoliceShot(g,cop,shot){
 const a=shot.origin,b=shot.end;
 const blocked=end=>segmentBlocked(a,end,.02,true)||g.vehicles.some(v=>!v.destroyed&&sweptVehicleHit({heading:-v.heading,width:(v.halfW||1.1)*2,length:(v.halfL||2.5)*2},a,end,v,0));
 let cover=1;
 if(blocked(b)){let lo=0,hi=1;for(let i=0;i<14;i++){const t=(lo+hi)/2,end={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};if(blocked(end))hi=t;else lo=t;}cover=lo;}
 if(b.y<0&&a.y>0)cover=Math.min(cover,a.y/(a.y-b.y));
 let contact=null;
 const targets=[...g.pedestrians,...g.patrols,...(g.mode==='foot'?[g.player]:[])];
 for(const e of targets){if(e===cop||e.dead)continue;const hit=bodyHit(a,b,{root:{position:e},reaction:e.reaction});if(hit&&hit.fraction<cover&&(!contact||hit.fraction<contact.fraction))contact={...hit,entity:e};}
 return {contact,end:contact?.point||{x:a.x+(b.x-a.x)*cover,y:a.y+(b.y-a.y)*cover,z:a.z+(b.z-a.z)*cover}};
}
