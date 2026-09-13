import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const character of ['kai','rae']){
  await page.goto('http://localhost:5187');await page.locator(`#select-${character}`).click();await page.locator('#start').click();await page.waitForFunction(()=>window.__gameTest.state.status==='running',{},{timeout:25000});
  await page.evaluate(async()=>{const {atCircuit}=await import('/src/district.js');const g=window.__gameTest.state,p=atCircuit(100);g.vehicles=[];g.traffic=[];g.patrols=[];g.police.forEach(c=>c.visible=false);Object.assign(g.player,p,{heading:0});g.pedestrians=g.pedestrians.slice(0,1);Object.assign(g.pedestrians[0],{x:p.x,z:p.z-.8,y:p.y,hit:false,reaction:null,walking:false,pause:10});});
  await page.keyboard.press('f');await page.waitForFunction(()=>window.__gameTest.state.phase==='pursuit');
  const result=await page.evaluate(character=>({health:window.__gameTest.state.pedestrians[0].health,phase:window.__gameTest.state.phase,attack:window.__gameTest.world.scene.getObjectByName(`character-${character}`).userData.rig.attack?.kind}),character);
  assert.ok(result.health<100);assert.ok(result.attack);console.log(character,result);await page.screenshot({path:`/tmp/astra-punch-${character}.png`});
 }
 await page.evaluate(async()=>{const {atCircuit}=await import('/src/district.js');const {beginPoliceEncounter}=await import('/src/police-patrols.js');const g=window.__gameTest.state,c=g.police[0];Object.assign(c,atCircuit(100),{y:20,visible:true,heading:0});g.mode='driving';g.player.dead=false;g.player.reaction=null;beginPoliceEncounter(g,c);});
 await page.waitForTimeout(150);
 const grounded=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js');const w=window.__gameTest.world,g=window.__gameTest.state,m=w.scene.children.find(o=>o.userData.officer&&o.visible),rig=m?.userData.rig;return {root:m?.position.y,ground:g.police[0].officerPosition.y,feet:rig?['LeftFoot','RightFoot'].map(n=>rig.bones[n].getWorldPosition(new T.Vector3()).y):[]};});
 console.log('encounter',grounded);assert.equal(grounded.feet.length,2);assert.ok(Math.min(...grounded.feet)<grounded.ground+.3);assert.ok(Math.min(...grounded.feet)>grounded.ground-.1);await page.screenshot({path:'/tmp/astra-grounded-officer.png'});assert.deepEqual(errors,[]);
}finally{await browser.close()}
