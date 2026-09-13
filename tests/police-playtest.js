import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:"chrome",args:['--use-gl=angle','--use-angle=metal','--enable-webgl']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5187/');await page.locator('#start').click();
 await page.waitForFunction(()=>window.__gameTest.state.status==='running',null,{timeout:30000});
 await page.waitForFunction(()=>window.__gameTest.world.scene.children.filter(o=>o.userData.patrolId&&o.userData.rig).length===10);
 await page.evaluate(async()=>{
  const {state:g}=window.__gameTest;
  const {beginPoliceEncounter}=await import('/src/police-patrols.js');
  g.mode='driving';g.activeVehicleId='starter-jeep';g.phase='pursuit';g.policeHits=3;
  Object.assign(g.police[0],{x:g.player.x+5,z:g.player.z,visible:true});
  beginPoliceEncounter(g,g.police[0]);
 });
 await page.locator('.police-intro').waitFor({state:'visible'});
 await page.waitForTimeout(1100);
 await page.screenshot({path:'artifacts/police-encounter.png'});
 await page.getByRole('button',{name:'Skip police introduction'}).click();
 await page.waitForFunction(()=>window.__gameTest.state.mode==='exploding');
 await page.waitForFunction(()=>window.__gameTest.state.mode==='foot');
 assert.deepEqual(errors,[]);console.log('PASS: ten loaded patrols, encounter overlay, skip, explosion, respawn; no browser errors');
}finally{await browser.close();}
