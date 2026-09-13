import {test,expect} from '@playwright/test';
test('Meshy models load, natural surfaces render, wind animates, and driving still works',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await page.waitForFunction(()=>window.__gameTest?.world.assets.state.loaded,{},{timeout:20000});
 const state=await page.evaluate(()=>window.__gameTest.world.assets.state);expect(state.error).toBeNull();expect(state.trees).toBeGreaterThan(50);expect(state.grass).toBeGreaterThan(100);
 await page.locator('#start').click();await page.waitForTimeout(800);await page.screenshot({path:'artifacts/natural-driving.png'});
 const initial=await page.evaluate(()=>window.__gameTest.state.distance);await page.keyboard.down('w');await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.distance),{timeout:20000}).toBeGreaterThan(initial+20);await page.keyboard.up('w');
 await page.evaluate(()=>{window.__gameTest.state.status='paused';});
 const wind=await page.evaluate(()=>window.__gameTest.world.assets.state.windTime);
 await page.screenshot({path:'artifacts/natural-wind-a.png'});await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/natural-wind-b.png'});
 expect(await page.evaluate(()=>window.__gameTest.world.assets.state.windTime)).toBeGreaterThan(wind+.5);
 console.log('assets',state,await page.evaluate(()=>window.__gameTest.world.performance()));expect(errors).toEqual([]);
});
