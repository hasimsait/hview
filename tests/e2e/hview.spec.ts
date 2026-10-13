import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('renders the real plan and switches views and visibility controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__drawCalls = 0;
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const method of ['drawElements', 'drawArrays'] as const) {
        const original = context.prototype[method];
        (context.prototype as any)[method] = function (...args: any[]) {
          (window as any).__drawCalls++;
          return original.apply(this, args as any);
        };
      }
    }
  });
  const response = await page.goto('/');
  expect(response!.status()).toBe(200);
  await expect(page.getByText('50 Walls')).toBeVisible();
  await expect(page.getByText('10 Rooms')).toBeVisible();
  await expect(page.getByText('119 Objects')).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForFunction(() => (window as any).__drawCalls > 100);

  const top = page.getByRole('button', { name: /2D Plan/ });
  const orbit = page.getByRole('button', { name: '3D Orbit', exact: true });
  await top.click();
  await expect(top).toHaveClass(/bg-sky-500/);
  await expect(orbit).not.toHaveClass(/bg-sky-500/);
  await orbit.click();
  await expect(orbit).toHaveClass(/bg-sky-500/);

  for (const control of ['Ceilings', 'Wall Cutaway']) {
    await page.getByRole('button', { name: `${control}: OFF`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${control}: ON`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: `${control}: ON`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${control}: OFF`, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('asset search handles no matches and cancellation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('119 Objects')).toBeVisible();
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Asset / Accessory' })).toBeVisible();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('no-such-asset-123456');
  await expect(page.getByText('0 assets available')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Asset / Accessory' })).toHaveCount(0);
  await expect(page.getByText('119 Objects')).toBeVisible();
});

test('real save endpoint persists JSON and rejects invalid payloads without data loss', async ({ request }) => {
  const original = await (await request.get('/sample.plan')).text();
  try {
    const edited = JSON.parse(original);
    edited.coverageMarker = 'real disk persistence test';
    const save = await request.post('/api/save-plan', { data: edited });
    expect(save.status()).toBe(200);
    expect((await save.json()).success).toBe(true);
    expect(await (await request.get('/sample.plan')).json()).toEqual(edited);

    const invalid = await request.post('/api/save-plan', { data: Buffer.from('{invalid'), headers: { 'Content-Type': 'application/json' } });
    expect(invalid.status()).toBe(500);
    expect(await (await request.get('/sample.plan')).json()).toEqual(edited);
  } finally {
    expect((await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } })).status()).toBe(200);
    expect(await (await request.get('/sample.plan')).text()).toBe(original);
  }
});

test('real reset endpoint restores the root template', async ({ request }) => {
  const original = await (await request.get('/sample.plan')).text();
  const template = readFileSync('sample.plan', 'utf8');
  try {
    const reset = await request.post('/api/reset-plan');
    expect(reset.status()).toBe(200);
    const result = await reset.json();
    expect(result.success).toBe(true);
    expect(result.plan).toBe(template);
    expect(await (await request.get('/sample.plan')).text()).toBe(template);
  } finally {
    expect((await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } })).status()).toBe(200);
    expect(await (await request.get('/sample.plan')).text()).toBe(original);
  }
});
