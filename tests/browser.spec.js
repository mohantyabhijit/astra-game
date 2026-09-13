import { test, expect } from "@playwright/test";

async function load(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#start")).toBeVisible();
  await page.waitForFunction(
    () => window.__gameTest?.world?.renderer.info.render.calls > 0,
  );
  return errors;
}

test("both characters select, enter the world, board, drive, exit and keep map visible", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await load(page);
  await page.locator("#select-rae").click();
  await expect(page.locator("#select-rae")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.screenshot({ path: "artifacts/integrated-selection.png" });
  await page.locator("#start").click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.character))
    .toBe("rae");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {timeout:20000})
    .toBe("foot");
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.mission)).toBe("available");
  await expect(page.locator("#objective")).toHaveText("Explore Marina Bay");
  await page.screenshot({ path: "artifacts/integrated-merlion-start.png" });
  await expect(page.locator("#minimap")).toBeVisible();
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 20000,
    })
    .toBe("driving");
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.distance), {
      timeout: 20000,
    })
    .toBeGreaterThan(12);
  await page.keyboard.up("w");
  await page.keyboard.down("Space");
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Math.hypot(
            window.__gameTest.state.player.vx,
            window.__gameTest.state.player.vz,
          ),
        ),
      { timeout: 20000 },
    )
    .toBeLessThan(0.8);
  await page.keyboard.up("Space");
  await page.screenshot({ path: "artifacts/integrated-driving.png" });
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 20000,
    })
    .toBe("foot");
  await page.keyboard.press("m");
  await expect(page.locator("body")).toHaveClass(/map-open/);
  await page.screenshot({ path: "artifacts/integrated-map.png" });
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");
  await expect(page.locator("#result-title")).toHaveText("PAUSED.");
  const elapsed = await page.evaluate(() => window.__gameTest.state.elapsed);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__gameTest.state.elapsed)).toBe(
    elapsed,
  );
  await page.locator("#resume").click();
  expect(errors).toEqual([]);
});

test("mission interaction and cooldown preserve mission progress", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await load(page);
  await page.locator("#start").click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");
  // Deterministic scene setup at the mission bay; enter through the real E action.
  await page.evaluate(() => {
    const g = window.__gameTest.state,
      v = g.vehicles.find((v) => v.id === "mission-sports");
    Object.assign(g.player, {
      x: v.x + 2,
      z: v.z,
      y: v.y,
      heading: v.heading,
      vx: 0,
      vz: 0,
    });
  });
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 20000,
    })
    .toBe("driving");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mission))
    .toBe("active");
  await page.keyboard.down("w");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.collected.length), {
      timeout: 20000,
    })
    .toBeGreaterThan(0);
  await page.keyboard.up("w");
  const collected = await page.evaluate(
    () => window.__gameTest.state.collected.length,
  );
  await page.evaluate(async () => {
    const { garages } = await import("/src/district.js");
    const { triggerPursuit } = await import("/src/simulation.js");
    const g = window.__gameTest.state;
    Object.assign(g.player, garages[0].inside, {
      heading: garages[0].heading,
      vx: 0,
      vz: 0,
      speed: 0,
    });
    triggerPursuit(g);
    g.police.forEach((c) => (c.visible = false));
  });
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.phase), {
      timeout: 30000,
    })
    .toBe("cooldown");
  await expect(page.locator("#minimap")).toBeVisible();
  await expect(page.locator("#cooldown-count")).toBeVisible();
  const remaining = Number(await page.locator("#cooldown-count").textContent());
  expect(remaining).toBeGreaterThan(0);
  expect(remaining).toBeLessThanOrEqual(5);
  await expect.poll(async () => Number(await page.locator("#cooldown-count").textContent())).toBeLessThan(remaining);
  await page.screenshot({ path: "artifacts/integrated-cooldown.png" });
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.escapes), {
      timeout: 60000,
    })
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => window.__gameTest.state.collected.length),
  ).toBeGreaterThanOrEqual(collected);
  expect(await page.evaluate(() => window.__gameTest.state.mission)).toBe(
    "active",
  );
  expect(errors).toEqual([]);
});

test('mobile visitors see the desktop requirement without loading game assets',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 const page=await context.newPage(),models=[];page.on('request',r=>{if(r.url().includes('.glb'))models.push(r.url());});await page.goto('/');
 await expect(page.locator('#desktop-required')).toBeVisible();await expect(page.locator('#touch-controls')).toHaveCount(0);expect(models).toEqual([]);await context.close();
});

test("three real collision impulses render the flying head and respawn the selected character", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = await load(page);
  await page.locator("#select-rae").click();
  await page.locator("#start").click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 20000,
    })
    .toBe("driving");
  // Isolated collision scene. Damage is generated by physics, never by assigning hit counters.
  await page.evaluate(async () => {
    const { triggerPursuit, stepGame } = await import("/src/simulation.js");
    const g = window.__gameTest.state;
    g.traffic = [];
    triggerPursuit(g);
    g.police.slice(1).forEach((c) => (c.visible = false));
    const cop = g.police[0];
    for (let hit = 0; hit < 3; hit++) {
      if (hit) {
        Object.assign(cop, {
          x: g.player.x + 30,
          z: g.player.z,
          vx: 0,
          vz: 0,
          pathTimer: 100,
        });
        stepGame(g, {}, 1 / 60);
      }
      const f = {
        x: Math.sin(g.player.heading),
        z: -Math.cos(g.player.heading),
      };
      Object.assign(cop, {
        x: g.player.x - f.x * 4.3,
        z: g.player.z - f.z * 4.3,
        vx: f.x * 40,
        vz: f.z * 40,
        heading: g.player.heading,
        pathTimer: 100,
        lastSeen: { ...g.player },
      });
      g.player.vx = g.player.vz = 0;
      stepGame(g, {}, 1 / 60);
    }
  });
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {timeout:20000})
    .toBe("exploding");
  await page.waitForFunction(() =>
    window.__gameTest.world.scene.children.some(
      (o) =>
        o.isGroup &&
        o.userData.velocity &&
        o.children.some(
          (c) => c.isMesh && c.geometry.attributes.position.count > 100,
        ),
    ),
  );
  await page.screenshot({ path: "artifacts/integrated-explosion.png" });
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 15000,
    })
    .toBe("foot");
  expect(await page.evaluate(() => window.__gameTest.state.character)).toBe(
    "rae",
  );
  expect(await page.evaluate(() => window.__gameTest.state.policeHits)).toBe(0);
  await page.screenshot({ path: "artifacts/integrated-respawn.png" });
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__gameTest.state.mode), {
      timeout: 20000,
    })
    .toBe("driving");
  expect(errors).toEqual([]);
});


test("loading screen covers asset assembly and reveals a close driving camera", async ({page}) => {
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/characters/kai.glb',async route=>{await gate;await route.continue();});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#loading-screen')).toBeVisible();
  await expect(page.locator('#start')).toBeDisabled();
  release();
  await expect(page.locator('#loading-screen')).toBeHidden({timeout:30000});
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click(); await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe("running");await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.mode),{timeout:20000}).toBe('driving');
  await expect.poll(()=>page.evaluate(()=>{const {world,state:g}=window.__gameTest;return world.camera.position.y-(g.player.y||0);})).toBeLessThan(3.5);
  const gap=await page.evaluate(()=>{const {world,state:g}=window.__gameTest;return Math.hypot(world.camera.position.x-g.player.x,world.camera.position.z-g.player.z);});
  expect(gap).toBeLessThan(9);
  await page.screenshot({path:'artifacts/integrated-close-chase-camera.png'});
});

test("Merlion introduction orbits then releases controls behind the dark-blue character",async({page})=>{
  await load(page);await page.locator('#start').click();
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status)).toBe('intro');
  const initial=await page.evaluate(()=>({player:{...window.__gameTest.state.player},camera:window.__gameTest.world.camera.position.toArray()}));
  await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
  const during=await page.evaluate(()=>({player:{...window.__gameTest.state.player},camera:window.__gameTest.world.camera.position.toArray(),monument:!!window.__gameTest.world.scene.getObjectByName('Merlion monument')}));
  expect(during.monument).toBe(true);expect(during.player.x).toBe(initial.player.x);expect(during.player.z).toBe(initial.player.z);expect(during.camera).not.toEqual(initial.camera);
  await page.screenshot({path:'artifacts/integrated-merlion-intro.png'});
  await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:15000}).toBe('running');
  const suit=await page.evaluate(()=>{const mats=[];window.__gameTest.world.scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.name==='Wolf3D_Outfit_Top')mats.push(m.color.getHexString());});return mats;});
  expect(suit).toContain('102d59');
  await page.screenshot({path:'artifacts/integrated-dark-blue-start.png'});
});

test('natural boarding, corrected wheel steering and officer knockdown render in gameplay',async({page})=>{
 const errors=await load(page);await page.locator('#start').click();
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.status),{timeout:20000}).toBe('running');
 await page.keyboard.press('e');
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.transition?.phase)).toBe('approach');
 await page.waitForTimeout(900);await page.screenshot({path:'artifacts/natural-car-approach.png'});
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.transition?.phase),{timeout:15000}).toBe('motion');
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.world.scene.children.find(o=>o.userData.active)?.userData.vehicle.doorOpen)).toBeGreaterThan(.8);
 await page.screenshot({path:'artifacts/natural-car-door.png'});
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.mode),{timeout:10000}).toBe('driving');
 await page.keyboard.down('w');await page.keyboard.down('d');await page.waitForTimeout(500);
 const wheel=await page.evaluate(()=>{const w=window.__gameTest.world.scene.children.find(o=>o.userData.active).userData.vehicle;return {front:w.wheels.find(o=>o.userData.front).userData.steer.rotation.y,spin:w.wheels[0].rotation.x};});
 expect(wheel.front).toBeLessThan(0);expect(wheel.spin).toBeGreaterThan(0);
 await page.keyboard.up('d');await page.keyboard.up('w');
 await page.evaluate(async()=>{
  const {stepGame}=await import('/src/simulation.js');const g=window.__gameTest.state;g.traffic=[];g.pedestrians=[];
  const p=g.player,f={x:Math.sin(p.heading),z:-Math.cos(p.heading)},c=g.patrols[0];g.patrols=[c];
  Object.assign(c,{x:p.x+f.x*2,z:p.z+f.z*2,y:p.y,hit:false,reaction:null,hitCooldown:0});
  Object.assign(p,{vx:f.x*10,vz:f.z*10,speed:10});stepGame(g,{},1/60);p.vx=p.vz=p.speed=0;
 });
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.state.phase)).toBe('pursuit');
 await expect.poll(()=>page.evaluate(()=>window.__gameTest.world.scene.children.find(o=>o.userData.patrolId==='patrol-0').userData.rig.reaction?.phase)).toBe('falling');
 await page.waitForTimeout(400);await page.screenshot({path:'artifacts/officer-knockdown.png'});
 expect(errors).toEqual([]);
});
