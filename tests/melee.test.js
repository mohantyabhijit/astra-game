import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,triggerPursuit} from '../src/simulation.js';
import {punch,stepMelee} from '../src/melee.js';
import {atCircuit,walkingSurfaceHeight} from '../src/district.js';
import {beginPoliceEncounter,stepPolicePatrols,stepDeployedOfficer} from '../src/police-patrols.js';
function setup(kind='civilian'){
 const g=createGame();g.status='running';g.mode='foot';g.vehicles=[];g.police=[];g.patrols=[];
 const p=atCircuit(100,0);Object.assign(g.player,p,{heading:0,attack:null});
 const victim={x:p.x,z:p.z-.8,y:p.y,heading:Math.PI,speed:1,walking:true,id:'victim',visible:true};
 g.pedestrians=kind==='civilian'?[victim]:[];if(kind==='police'){victim.footPatrol=true;g.patrols=[victim];}return {g,victim};
}
function swing(g){assert.equal(punch(g),true);for(let i=0;i<45;i++)stepMelee(g,1/60,triggerPursuit);}
for(const kind of ['civilian','police'])test(`punch contact damages ${kind}, recoils once, and alerts police`,()=>{
 const {g,victim}=setup(kind);swing(g);assert.ok(victim.health>=74&&victim.health<=86);assert.equal(g.phase,'pursuit');assert.equal(g.meleeAlert,true);assert.ok(victim.z<g.player.z-.8);assert.equal(g.player.attack,null);
});
test('punch misses behind the player and cannot start while driving',()=>{const {g,victim}=setup();victim.z=g.player.z+1;swing(g);assert.equal(victim.health,undefined);assert.equal(g.phase,'free');g.mode='driving';assert.equal(punch(g),false);});
test('alerted foot patrols run into punching range instead of stopping seven metres away',()=>{const {g,victim}=setup('police');victim.z-=3;g.phase='pursuit';g.meleeAlert=true;victim.along=100;victim.routeTimer=0;g.pedestrians=[];const before=Math.hypot(victim.x-g.player.x,victim.z-g.player.z);for(let i=0;i<50;i++)stepPolicePatrols(g,1/60);assert.ok(Math.hypot(victim.x-g.player.x,victim.z-g.player.z)<before-1);assert.equal(victim.officerActive,false);});
test('final encounter anchors the officer to the walking surface rather than car elevation',()=>{const g=createGame();g.mode='driving';const cop=g.police[0];Object.assign(cop,atCircuit(100),{y:20});beginPoliceEncounter(g,cop);assert.equal(cop.officerPosition.y,walkingSurfaceHeight(cop.officerPosition));assert.ok(cop.officerPosition.y<20);assert.ok(Math.hypot(cop.officerPosition.x-cop.x,cop.officerPosition.z-cop.z)>3);});
test('repeated punches knock civilians down and cancel their walking',()=>{const {g,victim}=setup();for(let n=0;n<3&&!victim.reaction;n++){victim.x=g.player.x;victim.z=g.player.z-.8;swing(g);}assert.equal(victim.reaction.phase,'falling');assert.equal(victim.hit,true);assert.ok(victim.reaction.vz<0);});
test('punches cannot pass through a parked car',()=>{const {g,victim}=setup();g.vehicles=[{x:g.player.x,z:g.player.z-.4,heading:0,halfW:1,halfL:2}];swing(g);assert.equal(victim.health,undefined);assert.equal(g.phase,'free');});
test('a pursuing officer can punch the player at close range',()=>{const {g}=setup('police');g.phase='pursuit';g.meleeAlert=true;for(let i=0;i<45;i++)stepMelee(g,1/60,triggerPursuit);assert.ok(g.gunHealth<100);});

test('deployed interceptor officer runs on foot without moving the parked car',()=>{const {g}=setup();const c={...g.player,x:g.player.x+4,heading:0,officerPosition:{x:g.player.x,y:g.player.y,z:g.player.z-8}};const carX=c.x;for(let i=0;i<60;i++)stepDeployedOfficer(g,c,1/60);assert.equal(c.x,carX);assert.ok(c.officerPosition.z>g.player.z-5);assert.equal(c.officerPosition.y,walkingSurfaceHeight(c.officerPosition));});
