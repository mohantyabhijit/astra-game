import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame} from '../src/simulation.js';
import {stepPolicePatrols} from '../src/police-patrols.js';
import {atCircuit} from '../src/district.js';
import {distance} from '../src/physics.js';

test('police roam peacefully, retain identity, and pursue both travel modes',()=>{
  const g=createGame(),cop=g.patrols[0],id=cop.id,start={...cop};
  for(let i=0;i<120;i++)stepPolicePatrols(g,1/60);
  assert.equal(cop.id,id);assert.ok(distance(cop,start)>.2);assert.equal(cop.officerActive,false);
  for(const mode of ['foot','driving']){
    Object.assign(cop,atCircuit(100,0),{routeTimer:0});
    Object.assign(g.player,atCircuit(120,0));g.mode=mode;g.phase='pursuit';
    const before=distance(cop,g.player);
    for(let i=0;i<120;i++)stepPolicePatrols(g,1/60);
    assert.ok(distance(cop,g.player)<before);assert.equal(cop.officerActive,true);
  }
});
test('patrols shoot during vehicle pursuit without bypassing three car impacts',()=>{
 const g=createGame();g.status='running';g.phase='pursuit';g.mode='driving';g.traffic=[];g.pedestrians=[];
 Object.assign(g.player,atCircuit(120,0));g.patrols=g.patrols.slice(0,1);
 Object.assign(g.patrols[0],atCircuit(105,0));
 for(let i=0;i<100;i++)stepGame(g,{},1/60);
 assert.ok(g.shots.some(s=>s.copId==='patrol-0'));assert.equal(g.policeHits,0);assert.equal(g.gunHealth,100);
});
