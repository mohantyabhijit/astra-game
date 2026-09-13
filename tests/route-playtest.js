import {createGame,startGame,stepGame,angleDelta,distance} from '../src/simulation.js';
import {circuit,gems,projectSegment,atCircuit} from '../src/district.js';
import {writeFileSync} from 'node:fs';
import {carPoint} from '../src/boarding.js';
import {boardNearby} from './driving-helper.js';
// Input-only lap on a profile whose gems are already collected. Traffic and damage stay enabled.
const game=createGame(gems.map(g=>g.id));
// Isolated circuit regression fixture; the normal player spawn is Merlion Park.
Object.assign(game.vehicles[0],atCircuit(3,3.6));Object.assign(game.player,carPoint(game.vehicles[0],2.3,-.98));
startGame(game);if(!boardNearby(game))throw new Error('Could not board the starting car');let index=1;
for(let frame=0;frame<60*1000&&game.status==='running'&&game.laps<1;frame++){
 while(index<circuit.length+1){const a=circuit[(index-1)%circuit.length],b=circuit[index%circuit.length],passed=(game.player.x-b.x)*(b.x-a.x)+(game.player.z-b.z)*(b.z-a.z)>0;if(distance(game.player,b)<4||passed)index++;else break;}
 const target=circuit[index%circuit.length],next=circuit[(index+1)%circuit.length];
 const delta=angleDelta(Math.atan2(target.x-game.player.x,-(target.z-game.player.z)),game.player.heading);
 const turn=Math.abs(angleDelta(Math.atan2(next.x-target.x,-(next.z-target.z)),game.player.heading));
 const speed=Math.hypot(game.player.vx,game.player.vz),wanted=Math.abs(delta)>.45||turn>.6?4:12;
 stepGame(game,{forward:speed<wanted,reverse:speed>wanted+1,left:delta<-.035,right:delta>.035},1/60);
}
const result={status:game.status,laps:game.laps,seconds:game.elapsed,health:game.health,collisions:game.collisions,index,lapNext:game.lapNext,position:game.player};console.log(JSON.stringify(result,null,2));writeFileSync('artifacts/integrated-lap.json',JSON.stringify(result,null,2));if(game.laps<1)process.exitCode=1;
