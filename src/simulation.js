import { clamp, angleDelta, distance, forward, drivePlayer, collideCars } from './physics.js';
import { roads, circuit, atCircuit, atPublicRoad, CIRCUIT_LENGTH, SPAWN, garages, gems, closestRoad, inWater, buildings } from './district.js';
import { roadGraph, Guidance } from './navigation.js';
import { resolveWorldCollision, segmentBlocked, driveableConnector } from './collision-world.js';
export { clamp, angleDelta, distance, seededRandom, collideCars, collideBuildings } from './physics.js';
export const BUILDINGS=buildings;
export const COOLDOWN_SECONDS=8;
export const makeVehicle=(x,z,heading=0)=>({x,z,y:0,heading,vx:0,vz:0,speed:0,steer:0,hit:0});
export function createGame(saved=[]) {
  const collected=[...new Set(saved.filter(id=>gems.some(g=>g.id===id)))];
  const traffic=Array.from({length:28},(_,i)=> {
    const direction=i%3===0?-1:1,along=125+i*CIRCUIT_LENGTH/28,p=atCircuit(along,4.2,direction);
    return {...makeVehicle(p.x,p.z,p.heading),y:p.y,along,direction,cruise:i%7===0?11:15+i%5,color:i%6,kind:i%7===0?'bus':i%4===0?'taxi':'car',halfL:i%7===0?3.6:2.4,halfW:i%7===0?1.3:1.1,near:false};
  });
  traffic.slice(-6).forEach((t,i)=>{t.publicRoad=roads.filter(r=>r.kind==='public')[i%2];t.along=75+Math.floor(i/2)*130;t.direction=1;Object.assign(t,atPublicRoad(t.publicRoad,t.along));});
  const pedestrians=Array.from({length:40},(_,i)=> {
    const start=80+i*119,side=i%2===0?1:-1,p=atCircuit(start,14*side);
    return {x:p.x,z:p.z,y:p.y,heading:p.heading,along:start,home:start,direction:side,side,speed:.9+(i%3)*.18,color:i%5};
  });
  const g={status:'ready',phase:'free',player:{...makeVehicle(SPAWN.x,SPAWN.z,SPAWN.heading)},traffic,pedestrians,
    police:Array.from({length:3},()=>({...makeVehicle(0,0),visible:false,path:null,pathTimer:0,lastSeen:null})),
    score:0,elapsed:0,health:100,boost:100,boosting:false,escape:0,nearestCop:Infinity,busted:0,distance:0,collisions:0,nearMisses:0,
    collected,gemsSinceChase:0,escapes:0,events:[],resetCooldown:0,outcome:'',cooldownArea:null,seen:false,unseen:0,lastSafe:{...SPAWN},
    navigation:new Guidance(),guidance:null,navTimer:0,lapProgress:0,lapNext:1,laps:0,lapStart:0,lastLap:0,waterRescue:0};
  updateGuidance(g,true);return g;
}
const emit=(g,text,kind='info')=>g.events.push({text,kind});
export function startGame(g){if(g.status==='ready')g.status='running';}
export function togglePause(g){if(g.status==='running')g.status='paused';else if(g.status==='paused')g.status='running';}
export function updateGuidance(g,force=false){g.guidance=g.navigation.update(g.player,g.phase,g.collected,force);g.navTimer=.65;}
export function recoverCar(g) {
  if(g.status!=='running'||g.resetCooldown>0)return;
  const q=closestRoad(g.player);const target=driveableConnector(g.player,q)?q:g.lastSafe;
  Object.assign(g.player,{x:target.x,z:target.z,y:target.y||0,heading:target.heading||0,vx:0,vz:0,speed:0,hit:1});
  g.score=Math.max(0,g.score-250);g.resetCooldown=5;g.escape=0;g.waterRescue=0;
  emit(g,'Recovered to the road · −250','warning');updateGuidance(g,true);
}
export function triggerPursuit(g) {
  if(g.status!=='running'||g.phase!=='free')return;
  g.phase='pursuit';g.escape=0;g.unseen=0;g.busted=0;
  const nearest=closestRoad(g.player,[roads[0]]);
  let along=0;for(let i=0;i<nearest.index;i++)along+=distance(circuit[i],circuit[(i+1)%circuit.length]);
  along+=distance(nearest.a,nearest);
  g.police.forEach((c,i)=> {
    const spawn=atCircuit(along-80-i*22,3.5);
    Object.assign(c,{...makeVehicle(spawn.x,spawn.z,spawn.heading),y:spawn.y,visible:true,path:null,pathTimer:0,lastSeen:{x:g.player.x,z:g.player.z,y:g.player.y}});
  });
  emit(g,'POLICE ALERT · Follow the amber route to cover','warning');updateGuidance(g,true);
}
export function hasLineOfSight(a,b){return distance(a,b)<135&&!segmentBlocked(a,b,0,true);}
function pointAhead(path,position,ahead=11) {
  if(!path||path.length<2)return position;
  let best=Infinity,index=0;
  for(let i=0;i<path.length;i++){const d=distance(position,path[i]);if(d<best){best=d;index=i;}}
  let remaining=ahead;
  for(let i=index;i<path.length-1;i++) {const a=path[i],b=path[i+1],d=distance(a,b);if(d>=remaining){const t=remaining/d;return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};}remaining-=d;}
  return path.at(-1);
}
function steerAI(c,target,cruise,dt) {
  const desired=Math.atan2(target.x-c.x,-(target.z-c.z)),turn=angleDelta(desired,c.heading);
  c.heading+=clamp(turn,-2.1*dt,2.1*dt);
  const desiredSpeed=cruise*clamp(1-Math.abs(turn)*.65,.18,1),f=forward(c.heading),blend=1-Math.exp(-4*dt);
  c.vx+=(f.x*desiredSpeed-c.vx)*blend;c.vz+=(f.z*desiredSpeed-c.vz)*blend;c.speed=Math.hypot(c.vx,c.vz);
}
function policeStep(g,c,dt) {
  if(!c.visible)return;
  const visible=hasLineOfSight(c,g.player);
  if(visible)c.lastSeen={x:g.player.x,z:g.player.z,y:g.player.y};
  c.pathTimer-=dt;
  if(c.pathTimer<=0){c.path=roadGraph.route(c,c.lastSeen)?.points||null;c.pathTimer=1.4;}
  const direct=visible&&distance(c,g.player)<30&&driveableConnector(c,g.player);
  const target=direct?g.player:pointAhead(c.path,c,9);
  const searching=!visible&&distance(c,c.lastSeen)<12;
  steerAI(c,target,searching?0:26+Math.min(g.escapes,3),dt);
}
function damage(g,impact) {
  if(impact<4||g.player.hit>0)return;
  g.health=Math.max(0,g.health-clamp(impact*.50,2,19));g.player.hit=.65;g.collisions++;emit(g,'Collision · watch your line','impact');
}
function collectGems(g) {
  if(g.phase!=='free')return;
  for(const gem of gems)if(!g.collected.includes(gem.id)&&distance(g.player,gem)<6.8) {
    g.collected.push(gem.id);g.score+=500;g.gemsSinceChase++;g.boost=Math.min(100,g.boost+15);
    emit(g,`GEM ${g.collected.length} / ${gems.length} · +500`,'gem');
    if(g.collected.length===gems.length){g.status='won';g.outcome='Every gem collected. Marina Bay is yours.';g.score+=3000;}
    else if(g.gemsSinceChase>=3){g.gemsSinceChase=0;triggerPursuit(g);}
    updateGuidance(g,true);break;
  }
}
function pursuitStep(g,dt) {
  if(g.phase==='free'){g.nearestCop=Infinity;g.seen=false;return;}
  g.nearestCop=Math.min(...g.police.filter(c=>c.visible).map(c=>distance(c,g.player)));
  g.seen=g.police.some(c=>c.visible&&hasLineOfSight(c,g.player));
  const area=garages.find(a=>a.contains(g.player));g.cooldownArea=area?.id||null;
  g.unseen=g.seen?0:g.unseen+dt;
  const parked=Math.hypot(g.player.vx,g.player.vz)<2.5;
  if(area&&parked&&!g.seen&&g.unseen>1.25) {
    if(g.phase!=='cooldown'){g.phase='cooldown';emit(g,'IN COVER · Hold position while heat clears','cooldown');}
    g.escape+=dt;
    if(g.escape>=COOLDOWN_SECONDS) {
      g.phase='free';g.escape=0;g.escapes++;g.score+=1500;g.health=Math.min(100,g.health+35);g.boost=100;
      g.police.forEach(c=>{c.visible=false;c.vx=c.vz=0;});g.cooldownArea=null;g.seen=false;g.unseen=0;
      emit(g,'HEAT CLEARED · +1,500 · Gem collection resumed','escape');updateGuidance(g,true);
    }
  } else {
    if(g.phase==='cooldown'){emit(g,g.seen?'SPOTTED · Cooldown interrupted':'Stay parked inside the cover area','warning');g.phase='pursuit';}
    g.escape=0;
  }
  g.busted=g.seen&&g.nearestCop<6.5&&Math.hypot(g.player.vx,g.player.vz)<2?g.busted+dt:Math.max(0,g.busted-dt*2);
  if(g.busted>=5){g.status='lost';g.outcome='The police boxed you in. Your collected gems are saved.';}
}
export function stepGame(g,input,dt) {
  if(g.status!=='running')return;dt=clamp(dt,0,1/30);g.elapsed+=dt;g.resetCooldown=Math.max(0,g.resetCooldown-dt);
  drivePlayer(g,input,dt);
  for(const c of g.police)policeStep(g,c,dt);
  for(const t of g.traffic) {
    const current=t.publicRoad?atPublicRoad(t.publicRoad,t.along):atCircuit(t.along,4.2,t.direction);t.y=current.y;
    if(distance(t,current)<14)t.along+=t.cruise*t.direction*dt;
    const target=t.publicRoad?atPublicRoad(t.publicRoad,t.along+8):atCircuit(t.along+8*t.direction,4.2,t.direction);
    const ahead={x:t.x+Math.sin(t.heading)*10,z:t.z-Math.cos(t.heading)*10};
    const blocked=distance(ahead,g.player)<5||(g.phase!=='free'&&g.police.some(c=>distance(ahead,c)<5));
    steerAI(t,target,blocked?0:t.cruise,dt);
  }
  const all=[g.player,...g.police.filter(c=>c.visible),...g.traffic];
  for(const c of all) {c.hit=Math.max(0,c.hit-dt);c.x+=c.vx*dt;c.z+=c.vz*dt;const impact=resolveWorldCollision(c);if(c===g.player)damage(g,impact);}
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const impact=collideCars(all[i],all[j]);if(i===0)damage(g,impact);}
  // Vehicle separation can push a body into a nearby wall; resolve that displacement too.
  for(const c of all)resolveWorldCollision(c);
  const q=closestRoad(g.player);g.player.y=q.distance<q.road.width/2+1?q.y:0;
  if(q.distance<q.road.width/2-2&&!segmentBlocked(g.player,q,1))g.lastSafe={x:q.x,z:q.z,y:q.y,heading:g.player.heading};
  if(inWater(g.player)&&q.distance>q.road.width/2+.5) {
    g.waterRescue+=dt;g.player.y=-Math.min(2,g.waterRescue*3);g.player.vx*=.94;g.player.vz*=.94;
    if(g.waterRescue>.7){g.resetCooldown=0;recoverCar(g);g.health=Math.max(0,g.health-12);emit(g,'Water rescue · back to the last safe road','warning');}
  }else g.waterRescue=0;
  for(const c of g.police)if(c.visible!==false)c.y=closestRoad(c).y;
  for(const pedestrian of g.pedestrians) {
    const next=atCircuit(pedestrian.along+pedestrian.speed*pedestrian.direction*dt,14*pedestrian.side);
    const safe=all.every(c=>distance(c,next)>4);
    if(safe){pedestrian.along+=pedestrian.speed*pedestrian.direction*dt;Object.assign(pedestrian,{x:next.x,z:next.z,y:next.y,heading:next.heading+(pedestrian.direction<0?Math.PI:0)});}
    if(Math.abs(pedestrian.along-pedestrian.home)>45)pedestrian.direction*=-1;
  }
  const speed=Math.hypot(g.player.vx,g.player.vz);g.distance+=speed*dt;g.score+=speed*dt*.3;
  for(const t of g.traffic){const d=distance(g.player,t);if(!t.near&&d>3.8&&d<5.8&&speed>19&&g.player.hit===0){t.near=true;g.nearMisses++;g.score+=150;emit(g,'Close call · +150','reward');}if(d>35)t.near=false;}
  collectGems(g);pursuitStep(g,dt);
  if(distance(g.player,circuit[g.lapNext])<24){g.lapNext=(g.lapNext+1)%circuit.length;if(g.lapNext===1){g.laps++;g.lastLap=g.elapsed-g.lapStart;g.lapStart=g.elapsed;g.score+=2000;emit(g,'FULL CIRCUIT LAP · +2,000','reward');}}
  g.lapProgress=g.lapNext/circuit.length;
  if(g.health<=0){g.status='lost';g.outcome='Your car took too much damage. Collected gems are saved.';}
  g.navTimer-=dt;if(g.navTimer<=0)updateGuidance(g);
}
