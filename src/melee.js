import {PUNCH,startRandomPunch,sweepPunch,receivePunch} from './wobble/original/boxing.js';
import {beginImpact,stepReaction,sweptVehicleHit} from './wobble/original/impacts.js';
import {driveableConnector,segmentBlocked} from './collision-world.js';

// The upstream rigs face +Z; the game movement heading faces -Z.
function actor(entity,position=entity,player=false){return {...entity,player,heading:Math.PI-(entity.officerHeading??entity.heading??0),root:{position:{x:position.x,y:position.y||0,z:position.z}},entity,position};}
export function punch(g){
 if(g.status!=='running'||g.mode!=='foot'||g.transition)return false;
 const a=actor(g.player,g.player,true);
 if(!startRandomPunch(a))return false;
 Object.assign(g.player,{attack:a.attack,stamina:a.stamina,punchSide:a.punchSide});return true;
}
export function stepMelee(g,dt,alert){
 if(g.phase==='free')g.meleeAlert=false;
 const people=[...g.pedestrians,...g.patrols],player=actor(g.player,g.player,true),actors=[player,...people.map(p=>actor(p))];
 for(const c of g.police)if(c.visible&&c.officerActive&&c.officerPosition){
  if(c.reaction){stepReaction(c,dt);if(c.reaction?.phase==='fleeing')c.reaction=null;}
  actors.push(actor(c,c.officerPosition));
 }
 for(const a of actors){
  const e=a.entity;e.hitstun=Math.max(0,(e.hitstun||0)-dt);e.stamina=Math.min(100,(e.stamina??100)+dt*20);e.meleeCooldown=Math.max(0,(e.meleeCooldown||0)-dt);
  if(e.hurt){
   const step=Math.min(dt,e.hurt.time),next={x:a.position.x+e.hurt.x*step*1.5,z:a.position.z+e.hurt.z*step*1.5};
   if(driveableConnector(a.position,next,.4)&&!g.vehicles.some(v=>!v.destroyed&&Math.hypot(next.x-v.x,next.z-v.z)<(v.halfL||2.5)+.4))Object.assign(a.position,next);
   e.hurt.time-=dt;if(e.hurt.time<=0)e.hurt=null;
  }
  if(!(g.pursuitDelay>0)&&g.meleeAlert&&g.phase!=='free'&&g.mode==='foot'&&(e.footPatrol||e.officerActive)&&!e.reaction&&!e.meleeCooldown&&Math.hypot(a.position.x-g.player.x,a.position.z-g.player.z)<1.35){
   if(startRandomPunch(a)){e.attack=a.attack;e.stamina=a.stamina;e.meleeCooldown=1.1;}
  }
  a.attack=e.attack;if(!a.attack)continue;
  const previous=a.attack.time;a.attack.time+=dt;
  const targets=a.player?actors.filter(t=>!t.player):[player];
  const hit=sweepPunch(a,previous,a.attack.time,targets,(from,to)=>{
   // Reject contact through scenery or parked vehicles, including cover before the fist starts.
   return segmentBlocked(a.root.position,to,.08)||!driveableConnector(a.root.position,{x:to.x,z:to.z},.08)||g.vehicles.some(v=>!v.destroyed&&sweptVehicleHit({heading:-v.heading,width:(v.halfW||1.1)*2,length:(v.halfL||2.5)*2},a.root.position,to,v,0))?0:1;
  });
  if(hit){
   const t=hit.target,r=receivePunch(t,a,a.attack.kind),victim=t.entity;
   Object.assign(victim,{health:t.health,poise:t.poise,hitstun:t.hitstun,hurt:t.hurt,attack:null,fireCooldown:t.fireCooldown});
   if(a.player){g.meleeAlert=true;alert(g);}
   if(r.knockdown){
    victim.hitCooldown=0;victim.walkSpeed=victim.walkSpeed||victim.speed||1.2;
    if(beginImpact(victim,{x:r.dx,z:r.dz},3.5,a.root.position)){
     victim.reaction.startHeading=Math.PI-(victim.heading||0);victim.poise=0;victim.walkSpeed=victim.walkSpeed||victim.speed||1.2;victim.hit=true;
    }
   }
   if(t.player){g.gunHealth=Math.max(0,g.gunHealth-r.damage);if(g.gunHealth===0){victim.hitCooldown=0;beginImpact(victim,{x:r.dx,z:r.dz},3.5,a.root.position);victim.dead=true;g.deathTimer=0;}}
  }
  if(e.attack&&e.attack.time>=PUNCH[e.attack.kind].duration)e.attack=null;
 }
}
