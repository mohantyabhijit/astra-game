import {createGame,startGame,stepGame,angleDelta,distance} from '../src/simulation.js';
import {projectSegment} from '../src/district.js';
import {writeFileSync} from 'node:fs';
const g=createGame();startGame(g);let lastPhase=g.phase,events=[],route=[],routeId='',index=1;
for(let frame=0;frame<60*300&&g.status==='running'&&!(g.escapes>0&&g.collected.length>3);frame++){
 const destination=g.guidance?.destination;
 if(destination&&destination.id!==routeId){routeId=destination.id;route=g.guidance.points.map(p=>({...p}));index=1;}
 const path=route;while(index<path.length-1){const a=path[index-1],b=path[index],dx=b.x-a.x,dz=b.z-a.z;const passed=(g.player.x-b.x)*dx+(g.player.z-b.z)*dz>0;if(distance(g.player,b)<4||passed)index++;else break;}
 const target=path[Math.max(0,index)]||g.player,next=path[Math.min(index+1,path.length-1)]||target;
 const delta=angleDelta(Math.atan2(target.x-g.player.x,-(target.z-g.player.z)),g.player.heading);
 const turn=Math.abs(angleDelta(Math.atan2(next.x-target.x,-(next.z-target.z)),g.player.heading));
 const speed=g.player.speed,remaining=g.guidance?.distance||0;
 const atEnd=g.phase!=='free'&&g.guidance?.destination&&distance(g.player,g.guidance.destination.inside)<3;
 let wanted=atEnd||g.phase==='cooldown'?0:Math.abs(delta)>.4||turn>.5?10:remaining<50?8:32;
 let preview=distance(g.player,target);for(let j=index;j<path.length-1&&preview<80;j++){const a=path[Math.max(0,j-1)],b=path[j],c=path[j+1];const corner=Math.abs(angleDelta(Math.atan2(b.x-a.x,-(b.z-a.z)),Math.atan2(c.x-b.x,-(c.z-b.z))));if(corner>.25)wanted=Math.min(wanted,Math.sqrt(40*Math.max(0,preview-10)+100));preview+=distance(b,c);}
 stepGame(g,{forward:speed<wanted,reverse:speed>wanted+.3,left:wanted>0&&delta<-.035,right:wanted>0&&delta>.035,handbrake:wanted===0},1/60);
 if(g.phase!==lastPhase){events.push({phase:g.phase,time:g.elapsed,x:g.player.x,z:g.player.z});lastPhase=g.phase;console.log(events.at(-1));}
}
const result={status:g.status,phase:g.phase,collected:g.collected.length,escapes:g.escapes,health:g.health,collisions:g.collisions,elapsed:g.elapsed,player:g.player,destination:g.guidance?.destination?.id,remaining:g.guidance?.distance,events};console.log(JSON.stringify(result,null,2));writeFileSync('artifacts/daylight-gameplay-loop.json',JSON.stringify(result,null,2));if(!(g.escapes>0&&g.collected.length>3))process.exitCode=1;
