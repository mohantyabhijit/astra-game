import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,stepGame,EXPLOSION_SECONDS} from '../src/simulation.js';
import {driveableConnector} from '../src/collision-world.js';

test('Merlion pedestrians keep walking after repeated respawns without changing identity',()=>{
  const g=createGame();startGame(g);g.traffic=[];g.patrols=[];
  const tick=seconds=>{for(let i=0;i<seconds*30;i++)stepGame(g,{},1/30);};
  tick(30); // Allow the crowded spawn paths to meet obstacles before dying.
  const identities=g.pedestrians.map(p=>[p.id,p.appearance]);
  const p=g.pedestrians.find(p=>p.id==='pedestrian-101');
  for(let cycle=0;cycle<2;cycle++){
    g.mode='exploding';g.explosion={elapsed:EXPLOSION_SECONDS};stepGame(g,{},1/30);
    assert.equal(g.mode,'foot');
    let travelled=0;
    for(let i=0;i<300;i++){
      const before={x:p.x,z:p.z};stepGame(g,{},1/30);
      const delta=Math.hypot(p.x-before.x,p.z-before.z);
      assert.ok(delta<.1,'walking resumes without teleporting');
      if(delta>0)assert.ok(driveableConnector(before,p,.4),'walking respects scenery');
      travelled+=delta;
    }
    assert.ok(travelled>1,`pedestrian remained stuck after respawn ${cycle+1}: ${travelled}`);
    assert.deepEqual(g.pedestrians.map(p=>[p.id,p.appearance]),identities);
  }
});
