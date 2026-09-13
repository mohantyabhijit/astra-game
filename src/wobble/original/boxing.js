// Swept contact queries, not frame-based proximity damage. Shared hand path
// drives both the rendered IK pose and collision queries.
export const PUNCH={jab:{duration:.46,windup:.09,contact:.24,cost:12,damage:14,stagger:.27},cross:{duration:.68,windup:.17,contact:.37,cost:25,damage:26,stagger:.48}};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function sphereEntry(from,to,center,radius){
 const d={x:to.x-from.x,y:to.y-from.y,z:to.z-from.z},m={x:from.x-center.x,y:from.y-center.y,z:from.z-center.z};
 const a=d.x*d.x+d.y*d.y+d.z*d.z,c=m.x*m.x+m.y*m.y+m.z*m.z-radius*radius;if(c<=0)return 0;if(a<1e-12)return null;
 const b=m.x*d.x+m.y*d.y+m.z*d.z,disc=b*b-a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:null;
}
export function startPunch(actor,kind='jab'){
 const spec=PUNCH[kind];if(!spec||actor.dead||actor.attack||actor.vehicle||actor.board||actor.reaction||actor.hitstun>0||(actor.stamina??100)<spec.cost)return false;
 actor.stamina=(actor.stamina??100)-spec.cost;actor.punchSide=actor.punchSide==='Left'?'Right':'Left';
 actor.attack={kind,side:kind==='cross'?'Right':actor.punchSide,time:0,heading:actor.heading||0,landed:false};actor.guard=false;actor.poseDirty=true;return true;
}
export function fistPoint(actor,time,attack=actor.attack){
 const s=PUNCH[attack.kind],t=clamp(time/s.duration),peak=s.contact/s.duration;
 const extension=t<peak?Math.pow(t/peak,1.3):Math.pow((1-t)/(1-peak),1.7),side=attack.side==='Left'?.19:-.19;
 const forward=.26+extension*(attack.kind==='cross'?.65:.57),lateral=side*(1-extension*.68),heading=attack.heading,p=actor.root.position;
 return {x:p.x+Math.sin(heading)*forward+Math.cos(heading)*lateral,y:p.y+1.23+Math.sin(t*Math.PI)*.035,z:p.z+Math.cos(heading)*forward-Math.sin(heading)*lateral};
}
export function bodyHit(from,to,actor,padding=0){
 const p=actor.root.position,low=actor.reaction&&actor.reaction.phase!=='fleeing';
 const spheres=low?[[.3,.36]]:[[.75,.29],[1.05,.32],[1.35,.26],[1.65,.23]];let result=null;
 for(const [height,radius] of spheres){const t=sphereEntry(from,to,{x:p.x,y:p.y+height,z:p.z},radius+padding);if(t!==null&&(!result||t<result.fraction))result={fraction:t,point:{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t}};}
 return result;
}
export function sweepPunch(actor,previous,time,targets,cover=()=>1){
 const attack=actor.attack,s=PUNCH[attack.kind];if(attack.landed||time<s.windup||previous>s.contact+.04)return null;
 let best=null;const start=Math.max(previous,s.windup),end=Math.min(time,s.contact+.04),steps=Math.max(1,Math.ceil((end-start)/.012));
 for(let i=0;i<steps&&!best;i++){
  const from=fistPoint(actor,start+(end-start)*i/steps),to=fistPoint(actor,start+(end-start)*(i+1)/steps);
  for(const target of targets){if(target===actor||target.dead||target.vehicle||target.board||target.reaction&&target.reaction.phase!=='fleeing')continue;
   const hit=bodyHit(from,to,target,.10);if(hit&&hit.fraction<cover(from,to)&&(!best||hit.fraction<best.fraction))best={...hit,target};
  }
 }
 if(best)attack.landed=true;return best;
}
export function receivePunch(target,attacker,kind){
 const s=PUNCH[kind],dx=attacker.root.position.x-target.root.position.x,dz=attacker.root.position.z-target.root.position.z,len=Math.hypot(dx,dz)||1;
 const guarded=target.guard&&(Math.sin(target.heading||0)*dx+Math.cos(target.heading||0)*dz)/len>.3&&(target.stamina??100)>=10;
 if(guarded)target.stamina=Math.max(0,(target.stamina??100)-10);
 const damage=guarded?Math.round(s.damage*.2):s.damage;target.health=Math.max(target.player?0:1,(target.health??100)-damage);
 target.poise=(target.poise||0)+(guarded?.1:kind==='cross'?1.4:.72);target.hitstun=guarded?.1:s.stagger;target.attack=null;target.aiming=false;target.fireCooldown=Math.max(target.fireCooldown||0,.75);
 target.hurt={x:-dx/len,z:-dz/len,time:.35};target.poseDirty=true;
 return {damage,guarded,knockdown:target.poise>=2||target.health<=1,dx:-dx/len,dz:-dz/len};
}

export function startRandomPunch(actor,random=Math.random){
 const kind=random()<.5?'jab':'cross';
 if(!startPunch(actor,kind))return false;
 actor.attack.side=random()<.5?'Left':'Right';return true;
}

export function punchDrive(attack,time){
 const spec=PUNCH[attack.kind],t=Math.max(0,Math.min(spec.duration,time));
 const drive=t<spec.windup?-.18*Math.sin(t/spec.windup*Math.PI):t<spec.contact?Math.sin((t-spec.windup)/(spec.contact-spec.windup)*Math.PI/2):Math.cos((t-spec.contact)/(spec.duration-spec.contact)*Math.PI/2)**2;
 const sign=attack.side==='Left'?1:-1,power=attack.kind==='cross'?1:.7;
 return {turn:-sign*drive*.38*power,shoulder:-sign*drive*.18*power,shift:Math.max(0,drive)*.055*power,lean:drive*.08*power};
}
