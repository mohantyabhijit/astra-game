import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,stepGame,interact} from '../src/simulation.js';
import {walkingSurfaceHeight,vehicleSurfaceHeight,MERLION_PLAZA,circuit,garages} from '../src/district.js';

test('parked and occupied starter car stay above the raised plaza',()=>{
  const g=createGame(),car=g.vehicles.find(v=>v.id==='starter-jeep');
  assert.equal(car.y,MERLION_PLAZA.height);
  startGame(g);interact(g);
  for(let i=0;i<1200&&g.transition;i++)stepGame(g,{},1/60);
  assert.equal(g.mode,'driving');
  for(let i=0;i<60;i++){
    stepGame(g,{forward:true},1/60);
    assert.equal(g.player.y,vehicleSurfaceHeight(g.player));
    assert.equal(car.y,g.player.y);
  }
  const edge={x:MERLION_PLAZA.x,z:MERLION_PLAZA.z-MERLION_PLAZA.d/2-1,heading:0,halfL:2.65,halfW:1.14};
  assert.equal(vehicleSurfaceHeight(edge),MERLION_PLAZA.height,'front wheels must clear the terrace even before the car center reaches it');
});

test('spawn and walking stay on top of the Merlion terrace',()=>{
  const g=createGame();
  assert.equal(g.player.y,MERLION_PLAZA.height);
  startGame(g);
  for(let i=0;i<90;i++){
    stepGame(g,{forward:true},1/60);
    assert.equal(g.player.y,walkingSurfaceHeight(g.player));
    assert.equal(g.player.y,MERLION_PLAZA.height);
  }
});

test('walking uses elevated road height and still collides with walls',()=>{
  const g=createGame();startGame(g);
  const bridge=circuit.find(p=>p.y>2);
  Object.assign(g.player,bridge);
  stepGame(g,{},1/60);
  assert.ok(g.player.y>2);
  assert.equal(g.player.y,walkingSurfaceHeight(g.player));
  const wall=garages[0].local(-17,-10);
  Object.assign(g.player,wall);
  stepGame(g,{},1/60);
  assert.ok(Math.hypot(g.player.x-wall.x,g.player.z-wall.z)>.4);
});
