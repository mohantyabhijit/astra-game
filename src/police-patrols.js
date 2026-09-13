import {walkingPathClear} from './vehicle-access.js';
import {stepReaction,advanceImpulse} from './wobble/original/impacts.js';
import {atCircuit,CIRCUIT_LENGTH,walkingSurfaceHeight} from './district.js';
import {driveableConnector,resolveWorldCollision} from './collision-world.js';
import {roadGraph} from './navigation.js';
import {distance,angleDelta} from './physics.js';

export function createPolicePatrols() {
  return Array.from({length:10},(_,i)=>{
    const along=80+i*CIRCUIT_LENGTH/10;
    let p=atCircuit(along,10);
    if(!driveableConnector(p,p,.45))p=atCircuit(along,0);
    return {...p,id:`patrol-${i}`,footPatrol:true,visible:true,officerActive:false,
      along,speed:0,vx:0,vz:0,halfW:.4,halfL:.4,routeTimer:0};
  });
}
export function stepPolicePatrols(g,dt) {
  for(const c of g.patrols) {
    if(c.reaction){
      const r=stepReaction(c,dt);c.officerActive=false;c.speed=c.vx=c.vz=0;
      if(r&&r.phase!=='fleeing'){
        if(r.phase==='falling'||r.phase==='down'){
          const delta=advanceImpulse(r,dt,{x:0,z:0}),next={x:c.x+delta.x,z:c.z+delta.z};
          if(driveableConnector(c,next,.4)){c.x=next.x;c.z=next.z;}
        }
        if(r.phase==='down'&&!r.groundBlood){r.groundBlood=true;g.pedestrianImpacts.push({x:c.x,y:c.y||0,z:c.z,dx:r.dx*.2,dz:r.dz*.2,time:g.elapsed});if(g.pedestrianImpacts.length>16)g.pedestrianImpacts.shift();}
        continue;
      }
      c.reaction=null;c.hit=false;c.path=null;c.routeTimer=0;
    }
    if(c.hitstun>0||c.attack){c.speed=0;c.officerActive=false;continue;}
    const wanted=g.phase!=='free'&&!(g.pursuitDelay>0),range=distance(c,g.player);
    let goal=wanted?g.player:atCircuit(c.along+16,10);
    if(!wanted&&!driveableConnector(goal,goal,.45))goal=atCircuit(c.along+16,0);
    const destination=goal;
    c.officerActive=wanted&&range<26&&!(g.meleeAlert&&g.mode==='foot');
    c.routeTimer-=dt;
    if(!driveableConnector(c,goal,.45)) {
      if(c.routeTimer<=0){c.path=roadGraph.route(c,goal)?.points.slice(1)||[];c.routeTimer=1.5;}
      while(c.path?.length&&distance(c,c.path[0])<1)c.path.shift();
      goal=c.path?.[0]||c;
    } else c.path=null;
    if(!wanted&&distance(c,destination)<1.5)c.along+=16;
    const desired=Math.atan2(goal.x-c.x,-(goal.z-c.z));
    c.heading+=angleDelta(desired,c.heading)*Math.min(1,dt*7);
    const speed=wanted?(range<(g.meleeAlert&&g.mode==='foot'?1.05:7)?0:4.5):1.3;
    const step=Math.min(speed*dt,distance(c,goal));
    const next={x:c.x+Math.sin(c.heading)*step,z:c.z-Math.cos(c.heading)*step};
    const parked=g.vehicles.some(v=>!v.destroyed&&distance(next,v)<(v.halfL||2.5)+.4);
    const moving=g.mode==='driving'&&distance(next,g.player)<3;
    c.speed=driveableConnector(c,next,.4)&&!parked&&!moving&&walkingPathClear(g,c,next)?speed:0;
    c.vx=Math.sin(c.heading)*c.speed;c.vz=-Math.cos(c.heading)*c.speed;
    c.x+=c.vx*dt;c.z+=c.vz*dt;resolveWorldCollision(c);c.y=walkingSurfaceHeight(c);
  }
}
export function beginPoliceEncounter(g,cop) {
  if(g.encounter||g.mode!=='driving')return;
  g.mode='encounter';g.transition=null;
  g.player.vx=g.player.vz=g.player.speed=0;
  cop.officerActive=true;
  const side={x:cop.x+Math.cos(cop.heading)*3.4,z:cop.z+Math.sin(cop.heading)*3.4,y:cop.y||0};
  const candidates=[side,...[-1,1].flatMap(sign=>[3.4,4.6,6].map(d=>({x:cop.x+Math.cos(cop.heading)*d*sign,z:cop.z+Math.sin(cop.heading)*d*sign})))];
  cop.officerPosition=candidates.find(p=>driveableConnector(p,p,.4)&&g.vehicles.concat(g.police).every(v=>v.destroyed||Math.hypot(v.x-p.x,v.z-p.z)>(v.halfL||2.55)+.65))||side;
  cop.officerPosition.y=walkingSurfaceHeight(cop.officerPosition);
  g.encounter={copId:cop.id,elapsed:0,duration:3.6};
}

export function stepDeployedOfficer(g,c,dt){
 if(!c.officerPosition){const p={x:c.x+Math.cos(c.heading)*3.4,z:c.z+Math.sin(c.heading)*3.4};c.officerPosition={...p,y:walkingSurfaceHeight(p)};}
 const p=c.officerPosition,range=distance(p,g.player);let goal=g.player;
 c.footRouteTimer=(c.footRouteTimer||0)-dt;
 if(!driveableConnector(p,goal,.4)){
  if(c.footRouteTimer<=0){c.footPath=roadGraph.route(p,goal)?.points.slice(1)||[];c.footRouteTimer=1;}
  while(c.footPath?.length&&distance(p,c.footPath[0])<1)c.footPath.shift();goal=c.footPath?.[0]||p;
 }
 c.officerHeading=Math.atan2(goal.x-p.x,-(goal.z-p.z));
 c.officerSpeed=range>1.05&&!c.reaction&&!c.attack&&!(c.hitstun>0)?4.5:0;
 const step=Math.min(c.officerSpeed*dt,distance(p,goal)),next={x:p.x+Math.sin(c.officerHeading)*step,z:p.z-Math.cos(c.officerHeading)*step};
 if(driveableConnector(p,next,.4)&&walkingPathClear(g,p,next))Object.assign(p,next,{y:walkingSurfaceHeight(next)});else c.officerSpeed=0;
}
