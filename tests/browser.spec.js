import { test, expect } from '@playwright/test';

test('loads textured city, drives with keyboard, boosts, pauses and resumes', async ({ page }) => {
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'START YOUR ENGINE' })).toBeVisible();
  await page.waitForFunction(() => window.__gameTest?.world?.renderer.info.render.calls > 0);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__gameTest.world.renderer.info.render.calls)).toBeLessThan(450);
  await page.screenshot({ path: 'artifacts/title-screen.png' });
  await page.getByRole('button', { name: 'START YOUR ENGINE' }).click();
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.elapsed), { timeout: 10000 }).toBeGreaterThan(2.2);
  await page.keyboard.up('w');
  const driven = await page.evaluate(() => ({ z: window.__gameTest.state.player.z, speed: window.__gameTest.state.player.speed }));
  expect(driven.z).toBeLessThan(127); expect(driven.speed).toBeGreaterThan(20);
  const boostStart = await page.evaluate(() => window.__gameTest.state.elapsed);
  await page.keyboard.down('w'); await page.keyboard.down('Shift');
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.elapsed)).toBeGreaterThan(boostStart + .9);
  await page.keyboard.up('Shift'); await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__gameTest.state.boost)).toBeLessThan(90);
  await page.keyboard.down('d');
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.player.heading)).toBeGreaterThan(.15);
  await page.keyboard.up('d');
  expect(await page.evaluate(() => window.__gameTest.state.player.heading)).toBeGreaterThan(.1);
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'PAUSED.' })).toBeVisible();
  const paused = await page.evaluate(() => window.__gameTest.state.time); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__gameTest.state.time)).toBe(paused);
  await page.getByRole('button', { name: 'BACK TO THE CHASE' }).click();
  await expect(page.getByRole('heading', { name: 'PAUSED.' })).toBeHidden();
  await page.screenshot({ path: 'artifacts/driving.png' });
  await page.getByRole('button', { name: 'Show controls' }).click();
  await expect(page.getByRole('heading', { name: 'STREET SMARTS.' })).toBeVisible();
  expect(await page.evaluate(() => window.__gameTest.state.status)).toBe('paused');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__gameTest.state.status)).toBe('running');
  expect(errors).toEqual([]); expect(failed).toEqual([]);
});

test('real keyboard reaches first checkpoint and pursuers actually follow', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'START YOUR ENGINE' }).click();
  const initialCop = await page.evaluate(() => window.__gameTest.state.police[0].z);
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.checkpoint), { timeout: 12000 }).toBe(1);
  await page.keyboard.up('w');
  expect(await page.evaluate(() => window.__gameTest.state.police[0].z)).toBeLessThan(initialCop - 20);
  await expect(page.locator('#progress')).toHaveText('1 / 5');
  expect(await page.evaluate(() => window.__gameTest.state.score)).toBeGreaterThan(1000);
});

test('collision, complete escape, failure and restart scenario UI', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'START YOUR ENGINE' }).click();
  await page.evaluate(() => {
    const g = window.__gameTest.state;
    Object.assign(g.player, { x: 14, z: 29, heading: Math.PI / 2, vx: 30, vz: 0 });
  });
  await expect.poll(() => page.evaluate(() => window.__gameTest.state.health)).toBeLessThan(100);
  await page.evaluate(() => {
    const g = window.__gameTest.state;
    Object.assign(g.player, { x: 4, z: 148, vx: 0, vz: 0, speed: 0, heading: 0 });
    g.police.forEach((c, i) => Object.assign(c, { x: -180, z: -180 + i * 15, vx: 0, vz: 0, target: null }));
    g.checkpoint = 5; g.escape = 4.8;
  });
  await expect(page.getByRole('heading', { name: 'YOU VANISHED.' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/escape.png' });
  await page.getByRole('button', { name: 'RESTART RUN' }).click();
  expect(await page.evaluate(() => window.__gameTest.state.checkpoint)).toBe(0);
  await page.evaluate(() => { window.__gameTest.state.time = .01; });
  await expect(page.getByRole('heading', { name: 'RUN OVER.' })).toBeVisible();
  await page.getByRole('button', { name: 'RESTART RUN' }).click();
  await expect(page.locator('#result')).toBeHidden();
  expect(await page.evaluate(() => window.__gameTest.state.health)).toBe(100);
});

test('mobile layout and touch driving', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await page.goto('/');
  await page.screenshot({ path: 'artifacts/mobile-title.png' });
  await page.getByRole('button', { name: 'START YOUR ENGINE' }).tap();
  await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accelerate', exact: true }).dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Accelerate', exact: true }).dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  expect(await page.evaluate(() => window.__gameTest.state.player.z)).toBeLessThan(142);
  await page.screenshot({ path: 'artifacts/mobile-driving.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});
