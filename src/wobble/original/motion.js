export const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
export const smooth = v => { const t=clamp(v); return t*t*(3-2*t); };
export const ramp = (t,a,b) => smooth((t-a)/(b-a));
export const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));

// One cycle covers 4 * stride metres. During the first half, the foot is
// planted: dz/dcycle = -4 * stride exactly cancels body travel in either direction.
export function gaitSample(cycle,stride=.30){
 const u=((cycle%1)+1)%1;
 if(u<.5)return {z:stride*(1-4*u),lift:0,stance:true,contact:Math.floor(cycle)};
 const swing=(u-.5)*2;
 return {z:stride*(2*smooth(swing)-1),lift:Math.sin(swing*Math.PI)*.13,stance:false,contact:Math.floor(cycle)};
}

// Integrate at a bounded step so lag and damping do not depend on render rate.
export function stepHead(s, dt, speed, {mass=2.8,hz=1.6,amp=3.8}={}) {
  const moving = speed > .035;
  s.still = moving ? 0 : (s.still || 0) + dt;
  const n=Math.max(1,Math.ceil(dt/(1/120))), h=dt/n;
  const omega=moving ? 15*clamp(speed/1.35,1,2.8)/Math.sqrt(mass) : 25;
  for(let i=0;i<n;i++){
    if(moving)s.phase += h*Math.PI*2*hz*clamp(speed/1.35,.25,2.8);
    const strength=clamp(speed/1.35,0,1.55)*amp*.065;
    const tx=moving ? Math.sin(s.phase*2)*strength*.85 : 0;
    const tz=moving ? Math.sin(s.phase)*strength : 0;
    s.vx += ((tx-s.x)*omega*omega-2*(moving?.48:1)*omega*s.vx)*h;
    s.vz += ((tz-s.z)*omega*omega-2*(moving?.48:1)*omega*s.vz)*h;
    s.x=clamp(s.x+s.vx*h,-.48,.48); s.z=clamp(s.z+s.vz*h,-.48,.48);
  }
  if(s.still>=.45){s.x=s.z=s.vx=s.vz=0;}
  return s;
}

// Reverse this timeline for exit: door stays fully open while limbs cross the sill.
export function boardingPose(u){
  return {
    door:ramp(u,.08,.25)*(1-ramp(u,.87,1)),
    reach:ramp(u,0,.13)*(1-ramp(u,.78,.97)),
    seat:ramp(u,.34,.74),
    turn:ramp(u,.48,.83),
    lead:ramp(u,.27,.52),
    trail:ramp(u,.58,.82),
    duck:Math.sin(ramp(u,.26,.83)*Math.PI),
    label:u<.08?'Reach for handle':u<.25?'Open door':u<.48?'Step into footwell':u<.74?'Lower into seat':u<.87?'Bring feet in':'Close door'
  };
}

export function trafficGap(angle, otherAngle, radius){
  return ((otherAngle-angle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)*radius;
}

// Time-based loss of balance: long sprints and sharp turns build instability.
export function stepSprint(actor,dt,speed,turn){
 actor.tripCooldown=Math.max(0,(actor.tripCooldown||0)-dt);
 if(speed<2.5||actor.tripCooldown>0){actor.sprintTime=0;return false;}
 actor.sprintTime=(actor.sprintTime||0)+dt*(1+Math.abs(turn)*.8);
 if(actor.sprintTime<7.5)return false;
 actor.sprintTime=0;actor.tripCooldown=12;return true;
}
