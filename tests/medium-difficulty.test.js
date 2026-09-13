import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,stepGame,triggerPursuit,interact,makeVehicle,POLICE_HEAD_START_SPEED} from '../src/simulation.js';
import {carPoint,boardingRoute} from '../src/boarding.js';
import {distance,forward} from '../src/physics.js';
import {atCircuit} from '../src/district.js';

test('three different starter cars have clear driver-door approaches',()=>{
 const g=createGame(),cars=g.vehicles.filter(v=>v.id.startsWith('starter-'));
 assert.deepEqual(cars.map(v=>v.type),['jeep','sports','mini']);
 for(const c of cars){assert.ok(distance(c,g.player)<25);const door=carPoint(c,2.3,-.98);assert.ok(boardingRoute(door,c,g.vehicles));const game=createGame();startGame(game);Object.assign(game.player,door);assert.equal(interact(game),true);assert.equal(game.activeVehicleId,c.id);}
});
function chase(){const g=createGame();startGame(g);g.mode='driving';g.vehicles=[];g.traffic=[];g.pedestrians=[];g.patrols=[];Object.assign(g.player,makeVehicle(0,0),atCircuit(100),{halfL:2.55,halfW:1.14});triggerPursuit(g);return g;}
const tick=(g,n)=>{for(let i=0;i<n;i++)stepGame(g,{},1/60);};
test('police allow a full five-second head start without attacks or impacts',()=>{
 const g=chase(),positions=g.police.map(c=>({...c}));assert.equal(g.police.filter(c=>c.visible).length,2);assert.equal(g.pursuitDelay,5);assert.ok(positions.every(c=>distance(c,g.player)>=70));
 tick(g,299);assert.ok(g.pursuitDelay>0);assert.ok(g.police.filter(c=>c.visible).every(c=>c.speed<=POLICE_HEAD_START_SPEED+.01));assert.ok(g.police.some((c,i)=>distance(c,positions[i])>1));assert.equal(g.policeHits,0);assert.equal(g.shots.length,0);
 assert.equal(triggerPursuit(g),false);assert.ok(g.pursuitDelay<.1);
 tick(g,60);assert.equal(g.pursuitDelay,0);assert.ok(g.police.some(c=>c.speed>POLICE_HEAD_START_SPEED));
});
test('separate simultaneous police rams cannot consume all three hits',()=>{
 const g=chase();g.pursuitDelay=0;const f=forward(g.player.heading);
 const ram=c=>Object.assign(c,{x:g.player.x-f.x*4.3,z:g.player.z-f.z*4.3,heading:g.player.heading,vx:f.x*16,vz:f.z*16,speed:16,contact:false,visible:true});
 g.police.slice(1).forEach(c=>c.visible=false);ram(g.police[0]);tick(g,1);assert.equal(g.policeHits,1);assert.ok(g.policeImpactGrace>1.9);
 g.police[0].visible=false;ram(g.police[1]);tick(g,1);assert.equal(g.policeHits,1);assert.equal(g.mode,'driving');
});

test('player gains distance while the two police cars follow slowly',()=>{
 const g=chase(),start={...g.player},positions=g.police.map(c=>({...c}));
 for(let i=0;i<240;i++)stepGame(g,{forward:true},1/60);
 assert.ok(distance(g.player,start)>15,'head start must let the player gain distance');
 assert.ok(g.pursuitDelay>.9);
 assert.equal(g.police.filter(c=>c.visible).length,2);
 assert.ok(g.police.filter(c=>c.visible).every((c,i)=>distance(c,positions[i])>1));
 assert.ok(g.police.filter(c=>c.visible).every(c=>c.speed<=POLICE_HEAD_START_SPEED+.01));
 assert.ok(distance(g.player,start)>Math.max(...g.police.map((c,i)=>distance(c,positions[i]))));
 assert.equal(g.policeHits,0);assert.equal(g.shots.length,0);
});
