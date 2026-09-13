import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame} from '../src/simulation.js';
import {populateNearbyPedestrians} from '../src/pedestrian-population.js';
import {distance} from '../src/physics.js';
import {driveableConnector} from '../src/collision-world.js';

function populate(mode,heading=0){
  const g=createGame();startGame(g);g.mode=mode;
  Object.assign(g.player,{x:100,z:-300,heading});
  populateNearbyPedestrians(g);
  return g;
}
test('crowds use city routes independent of the car heading and keep their routes when it moves',()=>{
  const a=populate('driving',0),b=populate('driving',Math.PI);
  assert.deepEqual(a.pedestrians.map(p=>[p.x,p.z,p.wanderRoad]),b.pedestrians.map(p=>[p.x,p.z,p.wanderRoad]));
  const nearby=a.pedestrians.filter(p=>distance(p,a.player)<130);
  assert.ok(nearby.length>=20);
  const routes=nearby.map(p=>p.wanderRoad);
  a.player.x+=5;populateNearbyPedestrians(a);
  assert.deepEqual(nearby.map(p=>p.wanderRoad),routes,'people must not circle or follow the car');
});
test('walking and driving populate newly visited areas without putting people beside the car',()=>{
  for(const mode of ['foot','driving']){
    const g=populate(mode),identities=g.pedestrians.map(p=>[p.id,p.appearance]);
    for(const point of [{x:-1500,z:100},{x:160,z:673},{x:100,z:-300}]){
      Object.assign(g.player,point);
      const before=new Map(g.pedestrians.map(p=>[p.id,{x:p.x,z:p.z}]));
      populateNearbyPedestrians(g);
      assert.ok(g.pedestrians.filter(p=>distance(p,g.player)<130).length>=18);
      for(const p of g.pedestrians.filter(p=>distance(p,before.get(p.id))>1)){
        assert.ok(distance(p,g.player)>=35);
        assert.ok(distance(...p.wanderRoad.points)>=16);
        assert.ok(driveableConnector(...p.wanderRoad.points,.6));
      }
    }
    assert.deepEqual(g.pedestrians.map(p=>[p.id,p.appearance]),identities);
  }
});
