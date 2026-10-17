import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, numberField } from './workflow-helpers';
import { SOFT_FURNISHINGS } from '../../src/domain/catalog/SoftFurnishings';
import type { FurnitureData } from '../../src/domain/model/PlanData';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
const fixture = () => ({ plan: { ...workflowPlan().plan, items: {} } });
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); return runtime.scene.getStatus().state === 'ready'; });
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text(); await request.post('/api/save-plan', { data: fixture() });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2, 1.7, 5); runtime.scene.getControls()!.target.set(2, 1.4, 0); runtime.scene.getControls()!.update(); });
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });
async function choose(page: Page, key: string) {
  const asset = SOFT_FURNISHINGS.find(a => a.key === `textile_${key}`)!;
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Soft Furnishings', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic'); await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(asset.name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: asset.name, exact: true }) }).click();
}
async function state(page: Page): Promise<(FurnitureData & { sheer: number[]; opaque: number[] })[]> {
  return page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => {
      const sheer: number[] = [], opaque: number[] = [];
      runtime.scene.getRenderObject(item.id)?.traverse((o: any) => { if (o.isMesh && o.userData.section === 'Sheer Fabric') sheer.push(o.material.opacity); if (o.isMesh && o.userData.section === 'Blackout Fabric') opaque.push(o.material.opacity); });
      return { ...item.toData(), sheer, opaque };
    });
  });
}
async function windowState(page: Page) {
  return page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    const window = runtime.editor.getDocument().get('window') as import('../../src/domain/elements/Opening').WindowOpening;
    const root = runtime.scene.getRenderObject('window')?.getObjectByName('curtains_window');
    const sheer: number[] = []; let slats = 0;
    root?.traverse((o: any) => { if (o.userData.isSheer && o.material) sheer.push(o.material.opacity); if (o.userData.section === 'Slats') slats++; });
    return { config: window.windowDressing, visibility: window.curtainState, sheer, slats, present: !!root };
  });
}
async function selectWindow(page: Page) {
  const point = await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    const mesh = runtime.scene.getRenderObject('window')!.getObjectByName('curtain_left_window')!;
    runtime.scene.getCamera().updateMatrixWorld(true);
    const point = mesh.getWorldPosition(runtime.scene.getCamera().position.clone()).project(runtime.scene.getCamera()), rect = runtime.scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.getByLabel('Window dressing', { exact: true })).toBeVisible();
}

test('mobile catalogue adds layered curtains with room-height drop, editable transparency and opening controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Soft Furnishings', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic');
  await expect(page.getByText('34 assets available', { exact: true })).toBeVisible();
  await page.getByLabel('Accessory type', { exact: true }).selectOption('Layered curtains');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Layered Sheer and Blackout Curtains', exact: true }) }).click();
  const curtain = (await state(page))[0];
  expect(curtain.dimensions.y).toBeCloseTo(2.975); expect(curtain.position.y).toBeCloseTo(.025);
  expect(curtain.sheer).toEqual([.28, .28]); expect(curtain.opaque).toEqual([1, 1]);
  await page.getByLabel('Window covering opening', { exact: true }).press('Home');
  await numberField(page, 'Width (X)').fill('210');
  await page.getByRole('button', { name: 'sheer_fabric', exact: true }).click();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect((await state(page))[0]).toMatchObject({ windowCoveringOpen: 0, dimensions: { x: 2.1 }, sheer: [.28, .28], sectionFinishes: { sheer_fabric: { color: '#f3f1ea' } } });
  await page.getByRole('button', { name: 'Velvet & Fabric', exact: true }).click();
  await page.getByRole('button', { name: /Natural Woven Linen/ }).click();
  expect((await state(page))[0]).toMatchObject({ sheer: [.28, .28], sectionFinishes: { sheer_fabric: { type: 'fabric', variant: 'linen_weave' } } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page);
  expect((await state(page))[0]).toMatchObject({ windowCoveringOpen: 0, dimensions: { x: 2.1 }, sheer: [.28, .28] });
  expect(errors).toEqual([]);
});

test('windows switch between sheer, blackout, layered and blind styles with persistent colour and opening', async ({ page }, testInfo) => {
  await selectWindow(page);
  await page.getByLabel('Window dressing', { exact: true }).selectOption('sheer');
  await page.getByLabel('Window dressing opening', { exact: true }).press('Home');
  await page.getByLabel('Window dressing colour', { exact: true }).fill('#c2b093');
  expect(await windowState(page)).toMatchObject({ config: { style: 'sheer', openness: 0, color: '#c2b093' }, sheer: [.28, .28] });
  await page.getByLabel('Window dressing', { exact: true }).selectOption('blackout');
  expect((await windowState(page)).sheer).toEqual([]);
  await page.getByLabel('Window dressing', { exact: true }).selectOption('layered');
  await page.getByLabel('Sheer curtain colour', { exact: true }).fill('#e2d7bf');
  await page.getByLabel('Window dressing', { exact: true }).selectOption('venetian');
  await page.getByLabel('Window dressing opening', { exact: true }).press('End');
  expect(await windowState(page)).toMatchObject({ config: { style: 'venetian', openness: 1 }, slats: 26 });
  await page.getByRole('button', { name: 'Hide curtains', exact: true }).click();
  expect((await windowState(page)).visibility).toBe('hidden');
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click(); expect((await windowState(page)).present).toBe(false);
  await page.getByLabel('Window dressing', { exact: true }).selectOption('roller');
  expect(await windowState(page)).toMatchObject({ visibility: 'removed', present: false });
  await page.getByRole('button', { name: 'Add curtains', exact: true }).click();
  await page.getByLabel('Window dressing', { exact: true }).selectOption('roman');
  await page.getByLabel('Window dressing opening', { exact: true }).press('Home');
  await page.getByLabel('Window dressing colour', { exact: true }).fill('#a6b6ac');
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page);
  expect(await windowState(page)).toMatchObject({ config: { style: 'roman', openness: 0, color: '#a6b6ac' }, visibility: 'visible' });
  await page.screenshot({ path: testInfo.outputPath('roman-window-blind.png') });
});

test('offline editor adds textile families and saves window dressings in exported HTML', async ({ page, context, request }, testInfo) => {
  const raw = fixture(); Object.assign(raw.plan.walls.wall.holes.window, { windowDressing: { style: 'layered', openness: .4, color: '#64786e', liningColor: '#ede4d4' } });
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(raw))));
  const url = 'http://127.0.0.1:3100/__offline__/soft-furnishings.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url); await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (const key of ['rug_border', 'cushion_velvet', 'throw_folded', 'bedding_set', 'towel_diamond', 'towel_chevron', 'towel_checker', 'towel_grid', 'blind_roller']) await choose(page, key);
  await page.getByLabel('Window covering opening', { exact: true }).press('End');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('soft-furnishings.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind === 'furniture.standard').map((e: any) => e.data);
  expect(items).toHaveLength(9); expect(items.at(-1)).toMatchObject({ assetKey: 'textile_blind_roller', windowCoveringOpen: 1 });
  expect(items.filter((item: FurnitureData) => item.assetKey.startsWith('textile_towel_'))).toHaveLength(4);
  const wall = saved.document.elements.find((e: any) => e.kind === 'wall').data;
  expect(wall.openings.find((o: any) => o.id === 'window').windowDressing).toMatchObject({ style: 'layered', openness: .4, liningColor: '#ede4d4' });
});

test('soft furnishing catalogue renders textile geometry without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGLProgram/.test(m.text())) errors.push(m.text()); });
  const items: Record<string, object> = {};
  SOFT_FURNISHINGS.forEach((a, i) => { items[a.key] = { name: a.key, assetKey: a.key, dimensions: a.defaultDimensions,
    pc: { x: 220 + i % 6 * 330, y: 220 + Math.floor(i / 6) * 350 }, rotationY: 0, position: { x: 2.2 + i % 6 * 3.3, y: 0, z: 2.2 + Math.floor(i / 6) * 3.5 } }; });
  const raw = fixture(); raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 2100, y: 0 }, { x: 2100, y: 1900 }, { x: 0, y: 1900 }];
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, walls: {}, items } } });
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.updateSettings({ foregroundOcclusionMode: 'off' }); runtime.scene.getCamera().position.set(24, 19, 28); runtime.scene.getControls()!.target.set(10, .5, 9); runtime.scene.getControls()!.update(); });
  await expect.poll(async () => (await state(page)).length).toBe(SOFT_FURNISHINGS.length);
  await page.screenshot({ path: testInfo.outputPath('soft-furnishings-gallery.png') });
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(13, 5, 21); runtime.scene.getControls()!.target.set(11, 1.2, 16); runtime.scene.getControls()!.update(); });
  await page.screenshot({ path: testInfo.outputPath('curtains-and-blinds-gallery.png') });
  expect(errors).toEqual([]);
});

test('bedding, rug, cushions, a draped throw and window layers render as a furnished room', async ({ page, request }, testInfo) => {
  const raw = fixture(), items: Record<string, object> = {
    bed: { name: 'bed_double', assetKey: 'bed_double', dimensions: { x: 1.8, y: .85, z: 2 }, position: { x: 1.3, y: 0, z: 2 }, pc: { x: 130, y: 200 }, rotationY: 0 },
  };
  const add = (key: string, x: number, y: number, z: number, rotationY = 0) => { const a = SOFT_FURNISHINGS.find(a => a.key === `textile_${key}`)!;
    items[key] = { name: a.key, assetKey: a.key, dimensions: a.defaultDimensions, position: { x, y, z }, pc: { x: x * 100, y: z * 100 }, rotationY }; };
  add('rug_border', 1.5, 0, 2.4); add('bedding_set', 1.3, .49, 2); add('cushion_velvet', 1.6, .55, 1.4); add('throw_fringe', .7, .03, 2.7);
  Object.assign(raw.plan.walls.wall.holes.window, { windowDressing: { style: 'layered', openness: .8, color: '#64786e', liningColor: '#efe9dc' } });
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items } } }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.updateSettings({ foregroundOcclusionMode: 'off' }); runtime.scene.getCamera().position.set(5.5, 3.2, 6.2); runtime.scene.getControls()!.target.set(1.8, .9, 1.7); runtime.scene.getControls()!.update(); });
  await page.screenshot({ path: testInfo.outputPath('soft-furnished-bedroom.png') });
});
