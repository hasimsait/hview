import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, numberField } from './workflow-helpers';
import { HOUSEHOLD_DETAILS } from '../../src/domain/catalog/HouseholdDetails';
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
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); const s = runtime.scene;
    s.getCamera().position.set(2, 1.7, 5); s.getControls()!.target.set(2, 1.4, 0); s.getControls()!.update(); s.getCamera().updateMatrixWorld(true); });
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });
async function choose(page: Page, key: string) {
  const asset = HOUSEHOLD_DETAILS.find(a => a.key === `detail_${key}`)!;
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: asset.householdDetail!.practical ? 'Practical Details' : 'Everyday Objects', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic'); await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(asset.name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: asset.name, exact: true }) }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); return runtime.editor.getDocument().furniture.map((item: any) => item.toData()); });
}

test('mobile practical fittings support millimetre edits, component colours and saved placement', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page, 'hose_drain');
  expect((await state(page))[0]).toMatchObject({ assetKey: 'detail_hose_drain', position: { y: 0 } });
  await expect(numberField(page, 'Width (X)')).toHaveAttribute('step', '0.1');
  await expect(numberField(page, 'Y (Elev.)')).toHaveAttribute('step', '0.001');
  await numberField(page, 'Width (X)').fill('72.5'); await numberField(page, 'Y (Elev.)').fill('0.018');
  await page.getByRole('button', { name: 'hose', exact: true }).click(); await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect((await state(page))[0]).toMatchObject({ dimensions: { x: .725 }, position: { y: .018 }, sectionFinishes: { hose: { color: '#f3f1ea' } } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page);
  expect((await state(page))[0]).toMatchObject({ dimensions: { x: .725 }, position: { y: .018 }, sectionFinishes: { hose: { color: '#f3f1ea' } } });
  await choose(page, 'panel_small');
  expect((await state(page)).at(-1)).toMatchObject({ assetKey: 'detail_panel_small', position: { y: .4 }, dimensions: { z: .02 } });
  await page.screenshot({ path: testInfo.outputPath('mobile-practical-fittings.png') });
});

test('offline editor includes everyday objects and practical routes in exported HTML', async ({ page, context, request }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/household-details.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url); await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (const key of ['kettle', 'mug', 'monitor', 'extension_4', 'trap_p']) await choose(page, key);
  await numberField(page, 'Y (Elev.)').fill('.42');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('household-details.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind === 'furniture.standard').map((e: any) => e.data);
  expect(items).toHaveLength(5); expect(items.at(-1)).toMatchObject({ assetKey: 'detail_trap_p', position: { y: .42 } });
  expect(items.find((i: any) => i.assetKey === 'detail_kettle').position.y).toBe(.9);
});

test('all household objects and practical details render with visible bores and no shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|shader|WebGLProgram/.test(m.text())) errors.push(m.text()); });
  const items: Record<string, object> = {};
  HOUSEHOLD_DETAILS.forEach((a, i) => { const x = 1 + i % 8 * 1.5, z = 1 + Math.floor(i / 8) * 1.8;
    items[a.key] = { name: a.key, assetKey: a.key, dimensions: a.defaultDimensions, pc: { x: x * 100, y: z * 100 }, rotationY: 0, position: { x, y: 0, z } }; });
  const raw = fixture(); raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 1400, y: 0 }, { x: 1400, y: 1300 }, { x: 0, y: 1300 }];
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, walls: {}, items } } });
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); const s = runtime.scene;
    s.updateSettings({ foregroundOcclusionMode: 'off' }); s.getCamera().position.set(16, 13, 19); s.getControls()!.target.set(6, .4, 5.5); s.getControls()!.update(); s.getCamera().updateMatrixWorld(true); });
  await expect.poll(async () => (await state(page)).length).toBe(HOUSEHOLD_DETAILS.length);
  await page.screenshot({ path: testInfo.outputPath('household-details-gallery.png') });
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); const s = runtime.scene;
    s.getCamera().position.set(6.5, 3, 13); s.getControls()!.target.set(6.5, .15, 8.5); s.getControls()!.update(); s.getCamera().updateMatrixWorld(true); });
  await page.screenshot({ path: testInfo.outputPath('practical-details-gallery.png') });
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); const s = runtime.scene;
    s.getCamera().position.set(7, 2.5, 6); s.getControls()!.target.set(6, .25, 3); s.getControls()!.update(); s.getCamera().updateMatrixWorld(true); });
  await page.screenshot({ path: testInfo.outputPath('countertop-and-desk-gallery.png') });
  expect(errors).toEqual([]);
});
