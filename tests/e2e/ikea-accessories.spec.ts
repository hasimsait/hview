import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan } from './workflow-helpers';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';
import { IKEA_ACCESSORIES } from '../../src/domain/catalog/IkeaAccessories';

let original: string;
const source = () => {
  const raw = workflowPlan();
  raw.plan.total_height = 270;
  raw.plan.walls.wall.height = 270;
  return { plan: { ...raw.plan, items: {} } };
};
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: source() });
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

async function choose(page: Page, article: string) {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('IKEA');
  await page.getByLabel('Accessory type', { exact: true }).selectOption('all');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(article);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: IKEA_ACCESSORIES.find(a => a.source?.productCode === article)!.name, exact: true }) }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => {
      const lights: boolean[] = [];
      runtime.scene.getRenderObject(item.id)?.traverse((child: any) => { if (child.isPointLight) lights.push(child.visible); });
      return { ...item.toData(), lights };
    }) as (import('../../src/domain/model/PlanData').FurnitureData & { lights: boolean[] })[];
  });
}

test('mobile catalogue filters 136 IKEA accessories and searches names without accents', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('IKEA');
  await expect(page.getByText(`${IKEA_ACCESSORIES.length + 5} assets available`, { exact: true })).toBeVisible();
  await page.getByLabel('Accessory type', { exact: true }).selectOption('Trolleys');
  await expect(page.getByText('12 assets available', { exact: true })).toBeVisible();
  const search = page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...');
  await search.fill('raskog');
  await expect(page.getByText('8 assets available', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ikea-mobile-catalogue.png') });
  await page.getByLabel('Accessory type', { exact: true }).selectOption('Vases');
  await search.fill('padrag');
  await expect(page.getByText('1 assets available', { exact: true })).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'IKEA PÅDRAG Vase — Clear Glass, 17 cm', exact: true }) }).click();
  expect((await state(page))[0]).toMatchObject({ assetKey: 'ikea_10470991', position: { y: .75 }, dimensions: { x: .12, y: .17, z: .12 } });
});

test('IKEA lamps switch off, undo, and save; pendant cords meet a 2.7 m ceiling', async ({ page }) => {
  await choose(page, '60358015');
  expect((await state(page))[0]).toMatchObject({ assetKey: 'ikea_60358015', position: { y: .75 }, lights: [true] });
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  expect((await state(page))[0]).toMatchObject({ lightConfig: { enabled: false }, lights: [false] });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page))[0].lights).toEqual([true]);
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  await choose(page, '20390951');
  const pendant = (await state(page)).find(item => item.assetKey === 'ikea_20390951')!;
  expect(pendant.position.y).toBeCloseTo(2, 5);
  expect(pendant.position.y + pendant.dimensions.y).toBeCloseTo(2.7, 5);
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await state(page)).find(item => item.assetKey === 'ikea_60358015')).toMatchObject({ lightConfig: { enabled: false }, lights: [false] });
});

test('offline editor places IKEA accessories and exports their sizes and lamp settings', async ({ page, context, request }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(source()))));
  const url = 'http://127.0.0.1:3100/__offline__/ikea-accessories.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await choose(page, '30586783');
  await choose(page, '10321618');
  await choose(page, '60358015');
  await page.getByRole('button', { name: '💡 ON', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('ikea-accessories.html');
  await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind.startsWith('furniture.')).map((e: any) => e.data);
  expect(items).toEqual(expect.arrayContaining([
    expect.objectContaining({ assetKey: 'ikea_30586783', dimensions: { x: .35, y: .77, z: .45 }, position: expect.objectContaining({ y: 0 }) }),
    expect.objectContaining({ assetKey: 'ikea_10321618', dimensions: { x: .76, y: .56, z: .025 } }),
    expect.objectContaining({ assetKey: 'ikea_60358015', lightConfig: expect.objectContaining({ enabled: false }) }),
  ]));
});

test('different IKEA accessory families render together without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  const articles = ['10470991', '30454891', '40452368', '10156109', '30586783', '00527634', '70590448', '10321618', '90331388', '40342134', '60322173', '50213546'];
  const items: Record<string, object> = {};
  articles.forEach((article, index) => {
    const asset = IKEA_ACCESSORIES.find(a => a.source?.productCode === article)!;
    const x = 1 + index % 4 * 1.3, z = 1 + Math.floor(index / 4) * 1.3;
    const raised = !['30586783', '60322173'].includes(article);
    items[article] = { name: asset.key, assetKey: asset.key, pc: { x: x * 100, y: z * 100 }, angle: 180,
      dimensions: asset.defaultDimensions, f0offset: raised ? 70 : 0 };
    if (raised) items[`stand_${article}`] = { name: 'kitchen_box', pc: { x: x * 100, y: z * 100 }, angle: 180,
      width: 70, height: 70, self_height: 70, f0offset: 0 };
  });
  const raw = workflowPlan();
  raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 620, y: 0 }, { x: 620, y: 500 }, { x: 0, y: 500 }];
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, walls: {}, items } } });
  // Load the new gallery fixture instead of the browser's previous plan snapshot.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Foreground:/ }).click();
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(7.5, 5.8, 9);
    runtime.scene.getControls()!.target.set(3, .5, 2.3);
    runtime.scene.getControls()!.update();
  });
  await expect.poll(async () => (await state(page)).length).toBe(Object.keys(items).length);
  await page.screenshot({ path: testInfo.outputPath('ikea-accessory-gallery.png') });
  expect(errors).toEqual([]);
});
