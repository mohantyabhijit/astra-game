import {test,expect} from '@playwright/test';
test('daylight game loads, collects a gem with keyboard, chases, pauses, and expands map',async({page})=>{
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.goto('/');
 await expect(page.locator('#start')).toBeVisible();await page.waitForFunction(()=>window.__gameTest?.world.renderer.info.render.calls>0);
 await page.screenshot({path:'artifacts/daylight-title.png'});await page.locator('#start').click();
 await page.keyboard.down('w');await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.collected.length),{timeout:20000}).toBeGreaterThan(0);await page.keyboard.up('w');
 await page.keyboard.press('h');await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.phase)).toBe('pursuit');
 await expect(page.locator('#destination-name')).toBeVisible();await page.keyboard.press('m');await expect(page.locator('body')).toHaveClass(/map-open/);await page.keyboard.press('m');
 await page.keyboard.press('Escape');await expect(page.locator('#result-title')).toHaveText('PAUSED.');const elapsed=await page.evaluate(()=>window.__gameTest.state.elapsed);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__gameTest.state.elapsed)).toBe(elapsed);await page.locator('#resume').click();
 await page.screenshot({path:'artifacts/daylight-driving.png'});expect(errors).toEqual([]);
 console.log('render',await page.evaluate(()=>({calls:window.__gameTest.world.renderer.info.render.calls,triangles:window.__gameTest.world.renderer.info.render.triangles})));
});
test('mobile touch controls fit screen',async({browser})=>{const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto('/');await page.locator('#start').tap();const before=await page.evaluate(()=>window.__gameTest.state.distance);const button=page.getByRole('button',{name:'Accelerate',exact:true});await button.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.distance),{timeout:10000}).toBeGreaterThan(before+3);await button.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});await page.screenshot({path:'artifacts/daylight-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await context.close();});
test('landmarks and cooldown interface render in daylight',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:960,height:600}); // Software WebGL renders dense foliage slowly; wait for simulation time.
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.goto('/');await page.locator('#start').click();
 await page.evaluate(()=>{const g=window.__gameTest.state;Object.assign(g.player,{x:-620,z:225,y:0,heading:Math.PI,vx:0,vz:0});});await page.waitForTimeout(1300);await page.screenshot({path:'artifacts/daylight-bay.png'});
 await page.evaluate(async()=>{const{garages}=await import('/src/district.js');const g=window.__gameTest.state;Object.assign(g.player,garages[0].inside,{heading:garages[0].heading,vx:0,vz:0});g.phase='pursuit';g.police.forEach(c=>c.visible=false);});
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.phase),{timeout:30000}).toBe('cooldown');await page.screenshot({path:'artifacts/daylight-cooldown.png'});await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.escapes),{timeout:60000}).toBe(1);await expect(page.locator('#cooldown-panel')).toBeHidden();expect(errors).toEqual([]);
});
