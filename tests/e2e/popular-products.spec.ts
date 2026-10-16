import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan } from './workflow-helpers';
import { POPULAR_PRODUCTS } from '../../src/domain/catalog/PopularProducts';
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

async function choose(page: Page, code: string) {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Popular Products');
  await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(code);
  const asset = POPULAR_PRODUCTS.find(a => a.source?.productCode === code)!;
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: asset.name, exact: true }) }).click();
}
async function state(page: Page): Promise<FurnitureData[]> {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => item.toData());
  });
}

test('mobile catalogue filters popular products, shows dated popularity and flags conflicting measurements', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Popular Products');
  await expect(page.getByText('83 assets available', { exact: true })).toBeVisible();
  await page.getByLabel('Accessory type', { exact: true }).selectOption('Wardrobes');
  await expect(page.getByText('6 assets available', { exact: true })).toBeVisible();
  const search = page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...');
  await search.fill('23749091');
  const card = page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Metalia Novado Four-Door Two-Drawer Wardrobe — White', exact: true }) });
  await expect(card).toContainText('#1 in Wardrobes · 2026-10-16');
  await expect(card).toContainText('Conflicting product listing specifications');
  await expect(card).toContainText('Approx.');
  await page.screenshot({ path: testInfo.outputPath('popular-products-mobile-catalogue.png') });
  await card.click();
  expect((await state(page))[0]).toMatchObject({ assetKey: 'popular_23749091', position: { y: 0 } });
  await choose(page, '84595046');
  expect((await state(page)).find(i => i.assetKey === 'popular_84595046')).toMatchObject({ position: { y: .15 }, dimensions: { x: .52, y: .39, z: .18 } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await state(page)).map(i => i.assetKey)).toEqual(expect.arrayContaining(['popular_23749091', 'popular_84595046']));
});

test('offline editor adds popular furniture and lamps and exports their identities and settings', async ({ page, context, request }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/popular-products.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await choose(page, '63214012');
  await choose(page, '2090364621');
  await choose(page, '1516436014');
  await choose(page, '2225693697');
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('popular-products.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind.startsWith('furniture.')).map((e: any) => e.data);
  expect(items).toEqual(expect.arrayContaining([
    expect.objectContaining({ assetKey: 'popular_63214012', dimensions: { x: .39, y: 1.6, z: .2 } }),
    expect.objectContaining({ assetKey: 'popular_2090364621', dimensions: { x: 1.12, y: .78, z: .69 } }),
    expect.objectContaining({ assetKey: 'popular_1516436014' }),
    expect.objectContaining({ assetKey: 'popular_2225693697', lightConfig: expect.objectContaining({ enabled: false }) }),
  ]));
});

test('popular furniture families render together without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  const articles = ['49050602', '2090364621', '2481365267', '873387540', '229668286', '1516436014', '2210182939', '747347649', '322079372', '2360973753', '2444190412', '2553797835', '2499665783', '2503594608', '348012422'];
  const items: Record<string, object> = {};
  articles.forEach((code, i) => {
    const asset = POPULAR_PRODUCTS.find(a => a.source?.productCode === code)!;
    items[code] = { name: asset.key, assetKey: asset.key, dimensions: asset.defaultDimensions,
      pc: { x: 150 + i % 5 * 260, y: 150 + Math.floor(i / 5) * 260 }, angle: 180, f0offset: 0 };
  });
  const raw = fixture();
  raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 1350, y: 0 }, { x: 1350, y: 800 }, { x: 0, y: 800 }];
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, walls: {}, items } } });
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Foreground:/ }).click();
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(15, 11, 15);
    runtime.scene.getControls()!.target.set(6.3, .8, 4);
    runtime.scene.getControls()!.update();
  });
  await expect.poll(async () => (await state(page)).length).toBe(articles.length);
  await page.screenshot({ path: testInfo.outputPath('popular-products-furniture-gallery.png') });
  expect(errors).toEqual([]);
});
