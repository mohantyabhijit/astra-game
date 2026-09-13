import {test,expect} from '@playwright/test';
test('normal gameplay uses imported traffic and animated Wobblehead crowd', async ({page}) => {
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await page.locator('#start').click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.world.scene.children.filter(o=>o.userData.npc&&o.visible&&o.userData.rig).length)).toBeGreaterThan(4);
  const state=await page.evaluate(()=>{
    const {world,state:g}=window.__gameTest;
    const cars=world.scene.children.filter(o=>o.userData.traffic);
    return {cars:cars.length,original:cars.every(o=>!!o.userData.vehicle?.animateWheels),population:g.pedestrians.length};
  });
  expect(state).toEqual({cars:28,original:true,population:120});
  const interceptors = await page.evaluate(()=>window.__gameTest.world.scene.children.filter(o=>o.userData.police).map(o=>o.userData.type));
  expect(interceptors).toEqual(['sports','sports','sports']);
  const people = await page.evaluate(() => window.__gameTest.world.scene.children.filter(o=>o.userData.npc).map(o=>({id:o.userData.personId,uuid:o.uuid,type:o.userData.type,appearance:o.userData.appearance})));
  expect(people.every(p=>['casual','hoodie'].includes(p.type))).toBe(true);
  expect(new Set(people.map(p=>p.appearance%8)).size).toBeGreaterThan(3);
  await page.waitForTimeout(2000);
  const later = await page.evaluate(() => window.__gameTest.world.scene.children.filter(o=>o.userData.npc).map(o=>({id:o.userData.personId,uuid:o.uuid,type:o.userData.type,appearance:o.userData.appearance})));
  for (const person of people) expect(later.find(p=>p.id===person.id)).toEqual(person);
  await page.screenshot({path:'artifacts/integrated-wobble-crowd.png'});
  const shirtColors = await page.evaluate(()=>window.__gameTest.world.scene.children.filter(o=>o.userData.npc).flatMap(o=>{
    const colors=[];o.traverse(n=>{if(n.isMesh)for(const m of [n.material].flat())if(['LightBrown','Purple'].includes(m.name))colors.push(m.color.getHexString());});return colors;
  }));
  expect(new Set(shirtColors).size).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('vehicle-pedestrian contact triggers one pooled blood burst and pursuit',async({page})=>{
  await page.goto('/');await page.locator('#start').click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.mode),{timeout:20000}).toBe('driving');
  await page.evaluate(async()=>{
    const {stepGame}=await import('/src/simulation.js');
    const g=window.__gameTest.state, p=g.pedestrians[0],f={x:Math.sin(g.player.heading),z:-Math.cos(g.player.heading)};
    g.traffic=[];
    Object.assign(p,{x:g.player.x-f.z*1.2,z:g.player.z+f.x*1.2,y:g.player.y,hit:false});
    Object.assign(g.player,{vx:f.x*5,vz:f.z*5,speed:5});
    stepGame(g,{},1/60);
    g.player.vx=g.player.vz=g.player.speed=0;
  });
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.world.scene.getObjectByName('pooled-blood-drops')?.visible)).toBe(true);
  expect(await page.evaluate(()=>window.__gameTest.state.pedestrianImpacts.length)).toBe(1);
  expect(await page.evaluate(()=>window.__gameTest.state.phase)).toBe('pursuit');
  await page.screenshot({path:'artifacts/integrated-blood-impact.png'});
});
