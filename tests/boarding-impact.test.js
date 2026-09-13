import {stepPolicePatrols} from '../src/police-patrols.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,interact,stepGame} from '../src/simulation.js';
import {boardingRoute,carPoint,vehicleDimensions} from '../src/boarding.js';
import {atCircuit} from '../src/district.js';
import {distance,drivePlayer} from '../src/physics.js';
import {sweptVehicleHit} from '../src/wobble/original/impacts.js';

test('door approach routes around the body from either end and opposite side',()=>{
 const g=createGame(),car=g.vehicles[0];Object.assign(car,atCircuit(100,0));
 for(const local of [[-3,0],[0,4],[0,-4],[3,0]]){
  const start=carPoint(car,...local),route=boardingRoute(start,car,[car]);assert.ok(route);
  let previous=start;
  for(const next of route){assert.equal(sweptVehicleHit({heading:-car.heading,...vehicleDimensions(car.type)},car,{x:car.x-(next.x-previous.x),z:car.z-(next.z-previous.z)},previous,.25),false);previous=next;}
 }
});
test('boarding walks continuously before opening the door, then enters the seat',()=>{
 const g=createGame();startGame(g);g.traffic=[];g.patrols=[];
 assert.equal(interact(g),true);let previous={...g.player},motion=false;
 for(let i=0;i<1200&&g.transition;i++){
  const phase=g.transition.phase;stepGame(g,{},1/60);
  if(phase==='approach'){assert.ok(distance(previous,g.player)<.04);assert.equal(g.transition.progress,0);}
  if(g.transition?.phase==='motion')motion=true;
  previous={...g.player};
 }
 assert.ok(motion);assert.equal(g.mode,'driving');
});
test('running over a walking officer knocks them down once and starts pursuit',()=>{
 const g=createGame();startGame(g);g.mode='driving';g.activeVehicleId=null;g.vehicles=[];g.traffic=[];g.pedestrians=[];g.patrols=g.patrols.slice(0,1);
 Object.assign(g.player,atCircuit(100,0));const f={x:Math.sin(g.player.heading),z:-Math.cos(g.player.heading)},c=g.patrols[0];
 Object.assign(c,{x:g.player.x+f.x*2,z:g.player.z+f.z*2,y:g.player.y,routeTimer:0});
 Object.assign(g.player,{vx:f.x*12,vz:f.z*12,speed:12,halfL:2.55,halfW:1.14});stepGame(g,{},1/60);
 assert.equal(g.phase,'pursuit');assert.equal(c.reaction.phase,'falling');assert.equal(c.officerActive,false);assert.equal(g.pedestrianImpacts.length,1);
 Object.assign(g.player,{vx:0,vz:0,speed:0});for(let i=0;i<30;i++)stepGame(g,{},1/60);
 assert.equal(g.pedestrianImpacts.length,1);assert.ok(!g.shots.some(s=>s.copId===c.id));
 for(let i=0;i<300;i++)stepPolicePatrols(g,1/60);assert.equal(c.reaction,null);assert.equal(c.hit,false);assert.equal(g.phase,'pursuit');
});
test('steering follows signed speed, stays stationary at rest and limits fast turns',()=>{
 const game=speed=>({player:{heading:0,steer:0,speed,vx:0,vz:-speed,type:'sports'},boost:100});
 const stopped=game(0);drivePlayer(stopped,{right:true},1/60);assert.equal(stopped.player.heading,0);
 const front=game(12),back=game(-6),fast=game(40);
 for(let i=0;i<30;i++){drivePlayer(front,{right:true,forward:true},1/60);drivePlayer(back,{right:true,reverse:true},1/60);drivePlayer(fast,{right:true,forward:true},1/60);}
 assert.ok(front.player.heading>0);assert.ok(back.player.heading<0);assert.ok(fast.player.heading<front.player.heading);
});
