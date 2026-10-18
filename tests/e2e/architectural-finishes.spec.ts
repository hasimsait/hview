import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, numberField } from './workflow-helpers';
import { ARCHITECTURAL_FINISHES } from '../../src/domain/catalog/ArchitecturalFinishes';
import type { FurnitureData } from '../../src/domain/model/PlanData';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
const fixture = () => ({ plan: { ...workflowPlan().plan, items: {} } });
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: fixture() });
  await page.route(/^https:\/\/fonts\./, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.scene.getStatus().state === 'ready';
  });
});
test.afterEach(async ({ page, request }) => {
  await page.close();
  await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } });
});
async function aimAtWall(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2, 1.5, 4);
    runtime.scene.getControls()!.target.set(2, 1.4, 0); runtime.scene.getControls()!.update();
  });
}
async function choose(page: Page, key: string) {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Architectural Finishes', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic');
  await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  const asset = ARCHITECTURAL_FINISHES.find(a => a.key === `finish_${key}`)!;
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(asset.name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: asset.name, exact: true }) }).click();
}
async function state(page: Page): Promise<FurnitureData[]> {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => item.toData());
  });
}

test('mobile category discovers finishes, edits a board, and places cornices flush at ceiling height', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await aimAtWall(page);
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Architectural Finishes', exact: true }).click();
  await expect(page.getByText('25 assets available', { exact: true })).toBeVisible();
  await page.getByLabel('Accessory type', { exact: true }).selectOption('Skirting boards');
  await expect(page.getByText('4 assets available', { exact: true })).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Chamfered Skirting Board', exact: true }) }).click();
  const board = (await state(page))[0];
  expect(board).toMatchObject({ category: 'architecture', position: { y: 0 } });
  expect(board.position.z).toBeCloseTo(.11);
  await numberField(page, 'Width (X)').fill('320');
  await numberField(page, 'Height (Y)').fill('12');
  await page.getByRole('button', { name: 'board', exact: true }).click();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect((await state(page))[0]).toMatchObject({ dimensions: { x: 3.2, y: .12, z: .018 }, sectionFinishes: { board: { color: '#f3f1ea' } } });
  await aimAtWall(page); await choose(page, 'cornice_cove');
  const cornice = (await state(page)).find(i => i.assetKey === 'finish_cornice_cove')!;
  expect(cornice.position.y).toBeCloseTo(2.88);
  // Wall face at 10 cm; cornice back at 10.1 cm (no 9 cm floating gap).
  expect(cornice.position.z - cornice.dimensions.z / 2).toBeCloseTo(.101);
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await state(page)).find(i => i.assetKey === 'finish_skirting_chamfered')).toMatchObject({ category: 'architecture', dimensions: { x: 3.2, y: .12 }, sectionFinishes: { board: { color: '#f3f1ea' } } });
  await page.screenshot({ path: testInfo.outputPath('architectural-finishes-mobile.png') });
});

test('offline editor adds finishes from all eight families and exports resized pieces', async ({ page, context, request }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/architectural-finishes.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  const pieces = ['skirting_ogee', 'architrave_fluted', 'sill_stone', 'threshold_metal', 'cornice_ogee', 'pelmet_returned', 'panelling_slatted', 'moulding_frame'];
  for (const key of pieces) await choose(page, key);
  await numberField(page, 'Width (X)').fill('90');
  await numberField(page, 'Height (Y)').fill('120');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('architectural-finishes.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind === 'furniture.standard').map((e: any) => e.data);
  expect(items).toHaveLength(8);
  expect(items.map((i: FurnitureData) => i.assetKey)).toEqual(pieces.map(key => `finish_${key}`));
  expect(items.at(-1)).toMatchObject({ category: 'architecture', dimensions: { x: .9, y: 1.2, z: .018 } });
});

test('finish profiles render in a furnished wall elevation without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  const items: Record<string, object> = {};
  const add = (key: string, x: number, y: number, z: number, width?: number) => {
    const a = ARCHITECTURAL_FINISHES.find(a => a.key === `finish_${key}`)!;
    items[key] = { name: a.key, assetKey: a.key, dimensions: { ...a.defaultDimensions, x: width ?? a.defaultDimensions.x },
      position: { x, y, z }, pc: { x: x * 100, y: z * 100 }, rotationY: 0 };
  };
  add('skirting_ogee', 2, 0, .112, 1.06);
  add('architrave_stepped', 1, 0, .1135);
  add('sill_stone', 3, .87, .226);
  add('threshold_oak', 1, 0, 0);
  add('cornice_cove', 2, 2.88, .161, 4);
  add('pelmet_returned', 3, 2.85, .231, 1.4);
  add('panelling_shaker', 2, 0, .114, 1.0);
  add('moulding_frame', 2, 1.3, .11);
  add('moulding_chair_rail', 2, 1.0, .127, 1.0);
  const raw = fixture();
  // Hide automatic finishes where the custom pieces take their place.
  Object.assign(raw.plan.walls.wall, { finishBaseboard: { type: 'invisible' } });
  Object.assign(raw.plan.walls.wall.holes.window, { pelmetState: 'hidden' });
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items } } });
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Foreground:/ }).click();
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(4.6, 2.4, 6.8);
    runtime.scene.getControls()!.target.set(2, 1.45, .2); runtime.scene.getControls()!.update();
  });
  await expect.poll(async () => (await state(page)).length).toBe(9);
  await page.screenshot({ path: testInfo.outputPath('architectural-wall-elevation.png') });
  expect(errors).toEqual([]);
});
