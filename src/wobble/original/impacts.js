import {clamp} from './motion.js';

// A swept, expanded rectangle includes the pedestrian radius. Simulation substeps
// keep rotation small; straight high-speed crossings cannot tunnel between frames.
export function sweptVehicleHit(car,from,to,point,radius=.28){
 const s=Math.sin(car.heading),c=Math.cos(car.heading);
 const ax=point.x-from.x,az=point.z-from.z,bx=point.x-to.x,bz=point.z-to.z;
 const start=[ax*c-az*s,ax*s+az*c],end=[bx*c-bz*s,bx*s+bz*c];
 const extent=[car.width/2+radius,car.length/2+radius];let lo=0,hi=1;
 for(let i=0;i<2;i++){
  const d=end[i]-start[i];if(Math.abs(d)<1e-8){if(Math.abs(start[i])>extent[i])return false;continue;}
  let a=(-extent[i]-start[i])/d,b=(extent[i]-start[i])/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;
 }
 return true;
}
export function beginImpact(actor,direction,speed,source){
 if(actor.dead||speed<.9||actor.vehicle||actor.board||actor.reaction&&actor.reaction.phase!=='fleeing'||actor.hitCooldown>0)return false;
 const length=Math.hypot(direction.x,direction.z)||1,dx=direction.x/length,dz=direction.z/length;
 actor.reaction={phase:'falling',time:0,startHeading:actor.heading||0,height:0,vy:clamp(speed*.20,.3,1.8),roll:Math.sin((source.x||0)*7+(source.z||0)*3)*.24,fallTime:.7+clamp(speed/14)*.2,dx,dz,vx:dx*clamp(speed*.65,1,5.5),vz:dz*clamp(speed*.65,1,5.5),sourceX:source.x,sourceZ:source.z,severity:clamp(speed/8,.2,1),groundBlood:false};
 actor.hitCooldown=3;actor.attack=null;actor.waypoint=null;actor.speed=0;actor.mode='falling';actor.poseDirty=true;return true;
}
export function stepReaction(actor,dt){
 actor.hitCooldown=Math.max(0,(actor.hitCooldown||0)-dt);
 const r=actor.reaction;if(!r)return null;
 r.time+=dt;
 if(actor.dead&&r.phase!=='falling'){r.phase='down';r.time=0;actor.mode='dead';return r;}
 const duration={falling:r.fallTime,down:1.15,gettingUp:1.45,fleeing:6};
 while(r.time>=duration[r.phase]){
  r.time-=duration[r.phase];
  if(actor.dead&&r.phase==='falling'){r.phase='down';r.time=0;actor.mode='dead';return r;}
  if(r.phase==='gettingUp'&&actor.player&&r.trip){actor.reaction=null;actor.mode='idle';actor.poseDirty=true;return null;}
  r.phase={falling:'down',down:'gettingUp',gettingUp:'fleeing',fleeing:null}[r.phase];
  if(!r.phase){actor.reaction=null;actor.mode='idle';actor.poseDirty=true;return null;}
 }
 actor.mode=r.phase;return r;
}
export function advanceImpulse(r,dt,out){
 const friction=r.height>0||r.vy>0?1.2:5.5,decay=Math.exp(-friction*dt),distance=(1-decay)/friction;
 r.height=Math.max(0,(r.height||0)+(r.vy||0)*dt-4.9*dt*dt);r.vy=r.height>0?(r.vy||0)-9.8*dt:0;
 out.x=r.vx*distance;out.z=r.vz*distance;r.vx*=decay;r.vz*=decay;return out;
}
