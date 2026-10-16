import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { workflowPlan, numberField } from './workflow-helpers';
import { LIGHTING_COMPONENTS } from '../../src/domain/catalog/LightingComponents';
import { FLOOR_DRAINS } from '../../src/domain/catalog/FloorDrains';
import type { FurnitureData } from '../../src/domain/model/PlanData';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';

const fixture = () => ({ plan: { ...workflowPlan().plan, items: {} } });
let original: string;
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.scene.getStatus().state === 'ready';
  });
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: fixture() });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => {
  await page.close();
  await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } });
});
async function choose(page: Page, key: string) {
  const a = [...LIGHTING_COMPONENTS, ...FLOOR_DRAINS].find(a => a.key === key)!;
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: a.lightingComponent ? 'Lighting' : 'Bathroom & Accessories', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic');
  await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(a.name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: a.name, exact: true }) }).click();
}
async function state(page: Page): Promise<(FurnitureData & { lightCount: number; visibleLights: number })[]> {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => {
      let lightCount = 0, visibleLights = 0;
      runtime.scene.getRenderObject(item.id)?.traverse((o: any) => { if (o.userData.isFixtureLight) { lightCount++; if (o.visible && o.intensity > 0) visibleLights++; } });
      return { ...item.toData(), lightCount, visibleLights };
    });
  });
}
async function rendered(page: Page) {
  const frame = await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    const frame = runtime.scene.renderer.info.render.frame; runtime.scene.invalidate(); return frame;
  });
  await page.waitForFunction(async before => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.scene.renderer.info.render.frame > before && !runtime.scene.preparing;
  }, frame);
}

test('catalogue adds controllable lighting and thin floor drains with independent finishes', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2, 1.6, 4); runtime.scene.getControls()!.target.set(2, 1.4, 0); runtime.scene.getControls()!.update();
  });
  await choose(page, 'lighting_track_straight');
  expect((await state(page))[0]).toMatchObject({ lightCount: 3, visibleLights: 3, position: { y: 2.75 } });
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  expect((await state(page))[0].visibleLights).toBe(0);
  await page.getByRole('button', { name: 'OFF', exact: true }).click();
  await page.getByRole('button', { name: /4000K/ }).click();
  await choose(page, 'drain_tile_insert');
  await numberField(page, 'Width (X)').fill('100');
  await numberField(page, 'Height (Y)').fill('0.5');
  await page.getByRole('button', { name: 'tile_insert', exact: true }).click();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect((await state(page)).find(i => i.assetKey === 'drain_tile_insert')).toMatchObject({ dimensions: { x: 1, y: .005 }, position: { y: 0 }, sectionFinishes: { tile_insert: { color: '#f3f1ea' } } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page);
  expect((await state(page)).find(i => i.assetKey === 'lighting_track_straight')).toMatchObject({ lightConfig: { enabled: true, color: '#ffffff' }, lightCount: 3, visibleLights: 3 });
  expect((await state(page)).find(i => i.assetKey === 'drain_tile_insert')).toMatchObject({ dimensions: { x: 1, y: .005 }, sectionFinishes: { tile_insert: { color: '#f3f1ea' } } });
});

test('offline editor includes drain covers, pendant lights, task strips and concealed cove output', async ({ page, request, context }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/lighting-components.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url); await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (const key of ['drain_square_steel', 'lighting_pendant_globe', 'lighting_cabinet_strip', 'lighting_cove_channel']) await choose(page, key);
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('lighting-components.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind.startsWith('furniture.')).map((e: any) => e.data);
  expect(items).toHaveLength(4);
  expect(items.at(-1)).toMatchObject({ assetKey: 'lighting_cove_channel', lightConfig: { enabled: false }, dimensions: { x: 1.2, y: .08, z: .12 } });
});

for (const touch of [false, true]) test(`chandeliers and light components illuminate receiving surfaces (${touch ? 'touch device' : 'desktop'})`, async ({ browser, request }, testInfo) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3100', viewport: { width: 1100, height: 800 }, isMobile: touch, hasTouch: touch });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    for (const key of ['chandelier', 'chandelier_cascading', 'lighting_downlight_round', 'lighting_track_straight', 'lighting_cabinet_bar', 'lighting_cove_channel']) {
      const raw = fixture();
      const a = LIGHTING_COMPONENTS.find(a => a.key === key), cove = key === 'lighting_cove_channel';
      const dimensions = a?.defaultDimensions ?? { x: .6, y: .6, z: .6 };
      const elevation = key === 'lighting_cabinet_bar' ? 1.4 : a ? 3 - (a.placement?.ceilingOffset ?? dimensions.y) : 2.4;
      Object.assign(raw.plan.rooms2.room, { floorFinish: { type: 'paint', color: '#bdbdbd' } });
      await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items: { lamp: { name: key, assetKey: key,
        position: { x: 2, y: elevation, z: 2 }, pc: { x: 200, y: 200 }, rotationY: 0, dimensions } } } } });
      await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
      await page.evaluate(async cove => {
        const path = '/src/main.tsx'; const { runtime } = await import(path);
        runtime.scene.updateSettings({ globalLighting: false, showCeiling: cove, foregroundOcclusionMode: 'off' });
        runtime.scene.getCamera().position.set(2, cove ? 1.5 : 2.7, 5.8); runtime.scene.getControls()!.target.set(2, cove ? 2.6 : .7, 1.7); runtime.scene.getControls()!.update();
      }, cove);
      await rendered(page);
      const toggle = async (enabled: boolean) => {
        await page.evaluate(async enabled => {
          const path = '/src/main.tsx', commands = '/src/application/commands/FurnitureCommands.ts';
          const { runtime } = await import(path), { ConfigureLuminaire } = await import(commands);
          runtime.editor.execute(new ConfigureLuminaire('lamp', { enabled }));
        }, enabled);
        await rendered(page);
      };
      const patch = await page.evaluate(async cove => {
        const path = '/src/main.tsx'; const { runtime } = await import(path);
        const camera = runtime.scene.getCamera(); camera.updateMatrixWorld(true);
        const point = camera.position.clone().set(2, cove ? 3 : .002, 2).project(camera); const rect = runtime.scene.getDomElement().getBoundingClientRect();
        return { x: Math.round(rect.left + (point.x + 1) * rect.width / 2 - 20), y: Math.round(rect.top + (1 - point.y) * rect.height / 2 - 20), width: 40, height: 40 };
      }, cove);
      const luminance = async (name: string) => {
        const bytes = await page.screenshot({ clip: patch }); await sharp(bytes).toFile(testInfo.outputPath(`${key}-${name}.png`));
        const { channels } = await sharp(bytes).stats(); return channels.slice(0, 3).reduce((sum, c) => sum + c.mean, 0) / 3;
      };
      await toggle(false); const off = await luminance('off');
      await toggle(true); const on = await luminance('on');
      await page.screenshot({ path: testInfo.outputPath(`${key}-night-room.png`) });
      expect(on - off, `${key} receiving surface luminance ${off.toFixed(1)} → ${on.toFixed(1)}`).toBeGreaterThan(20);
      await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); runtime.scene.updateSettings({ globalLighting: true }); });
      await rendered(page);
      expect((await state(page))[0].visibleLights).toBe(['lighting_track_straight', 'lighting_cabinet_bar'].includes(key) ? 3 : 1);
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('light fittings and drain covers render their geometry without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  const items: Record<string, object> = {};
  LIGHTING_COMPONENTS.forEach((a, i) => { items[a.key] = { name: a.key, assetKey: a.key, dimensions: a.defaultDimensions,
    position: { x: 1 + i % 7 * 1.8, y: 2.3, z: 1 + Math.floor(i / 7) * 2.5 }, pc: { x: 100, y: 100 }, rotationY: 0 }; });
  FLOOR_DRAINS.forEach((a, i) => { items[a.key] = { name: a.key, assetKey: a.key, dimensions: a.defaultDimensions,
    position: { x: 1 + i * 1.2, y: 0, z: 5 }, pc: { x: 100, y: 100 }, rotationY: 0 }; });
  const raw = fixture(); raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 1400, y: 0 }, { x: 1400, y: 650 }, { x: 0, y: 650 }];
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, walls: {}, items } } });
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.updateSettings({ foregroundOcclusionMode: 'off' });
    runtime.scene.getCamera().position.set(13, 7, 12); runtime.scene.getControls()!.target.set(6, 2, 2.5); runtime.scene.getControls()!.update();
  });
  await rendered(page); await page.screenshot({ path: testInfo.outputPath('lighting-fittings-gallery.png') });
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(4, 1.8, 7); runtime.scene.getControls()!.target.set(3.4, 0, 5); runtime.scene.getControls()!.update();
  });
  await rendered(page); await page.screenshot({ path: testInfo.outputPath('floor-drain-gallery.png') });
  expect(await state(page)).toHaveLength(19); expect(errors).toEqual([]);
});
