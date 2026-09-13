import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,interact,stepGame} from '../src/simulation.js';
import {availableCars,walkingPathClear,separateWalker} from '../src/vehicle-access.js';
import {carPoint,vehicleDimensions} from '../src/boarding.js';
import {atCircuit} from '../src/district.js';

for(const fleet of ['traffic','police'])test(`${fleet} car can be boarded, driven, exited and entered again`,()=>{
 const g=createGame();startGame(g);g.pedestrians=[];g.patrols=[];g.vehicles=[];
 const source=g[fleet][0];g.traffic=fleet==='traffic'?[source]:[];g.police=fleet==='police'?[source]:[];
 Object.assign(source,atCircuit(400,0),{visible:true,type:'sports',vx:0,vz:0});
 Object.assign(g.player,carPoint(source,vehicleDimensions('sports').width/2+.53,-.98));
 assert.equal(interact(g),true);assert.ok(source.claimed);const car=g.vehicles[0];
 assert.ok(availableCars(g).includes(car));assert.ok(!availableCars(g).includes(source));
 for(let i=0;i<1200&&g.transition;i++)stepGame(g,{},1/60);
 assert.equal(g.mode,'driving');const start={x:car.x,z:car.z};
 for(let i=0;i<60;i++)stepGame(g,{forward:true},1/60);
 assert.ok(Math.hypot(car.x-start.x,car.z-start.z)>1);
 g.player.vx=g.player.vz=g.player.speed=0;assert.equal(interact(g),true);
 for(let i=0;i<300&&g.transition;i++)stepGame(g,{},1/60);
 assert.equal(g.mode,'foot');assert.equal(interact(g),true);assert.equal(g.activeVehicleId,car.id);
});

test('walkers cannot cross rotated parked, traffic or police cars and overlaps separate',()=>{
 for(const fleet of ['vehicles','traffic','police'])for(const heading of [0,.7,Math.PI/2]){
  const g=createGame(),car={...atCircuit(400,0),heading,halfW:1.14,halfL:2.65,visible:true};
  g.vehicles=[];g.traffic=[];g.police=[];g[fleet]=[car];
  const from=carPoint(car,-4,0),to=carPoint(car,4,0);
  assert.equal(walkingPathClear(g,from,to),false);
  const p={...carPoint(car,0,0),speed:1.2};separateWalker(g,p);
  assert.equal(walkingPathClear(g,p,p),true);assert.equal(p.speed,1.2);
 }
});
