import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan } from './workflow-helpers';
import { ELECTRICAL_ASSETS } from '../../src/domain/catalog/ElectricalAssets';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';

function fixture() {
  return { plan: { ...workflowPlan().plan, items: {
    robot: { name: 'robot-cleaner', assetKey: 'robot-cleaner', dimensions: { x: .35, y: .6, z: .46 }, pc: { x: 140, y: 100 }, angle: 180 },
    purifier: { name: 'bactericidal_air_recirculator', assetKey: 'bactericidal_air_recirculator', dimensions: { x: .29, y: .6, z: .31 }, pc: { x: 240, y: 100 }, angle: 180 },
  } } };
}
let original: string;
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
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2, 1.7, 5);
    runtime.scene.getControls()!.target.set(2, 1.4, 0);
    runtime.scene.getControls()!.update();
  });
});
test.afterEach(async ({ page, request }) => {
  await page.close();
  await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } });
});
async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Sockets & Switches', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => {
      const object = runtime.scene.getRenderObject(item.id);
      let visible = true;
      for (let parent = object; parent; parent = parent.parent) visible &&= parent.visible;
      return { ...item.toData(), visible, dock: !!object?.getObjectByName(`dock_${item.id}`), intake: !!object?.getObjectByName(`air_intake_${item.id}`) };
    }) as (import('../../src/domain/model/PlanData').FurnitureData & { visible: boolean; dock: boolean; intake: boolean })[];
  });
}

test('new switches and sockets are visible, replaceable, paintable and persist with upgraded appliances', async ({ page }) => {
  expect(await state(page)).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'robot', assetKey: 'robot_vacuum', dimensions: { x: .35, y: .15, z: .46 }, dock: true }),
    expect.objectContaining({ id: 'purifier', assetKey: 'air_purifier', intake: true }),
  ]));
  await choose(page, 'VRC Bubble Double Rocker Switch — Burgundy');
  expect((await state(page)).find(item => item.assetKey === 'vrc_bubble_double_switch_burgundy')).toMatchObject({ visible: true, position: { y: 1.1 } });
  await page.getByRole('button', { name: 'Sockets', exact: true }).click();
  expect((await state(page)).find(item => item.assetKey === 'vrc_bubble_double_switch_burgundy')?.visible).toBe(false);
  await choose(page, 'VIKO Karre Double Earthed Socket — White');
  const socket = (await state(page)).find(item => item.assetKey === 'viko_karre_double_socket_white')!;
  expect(socket).toMatchObject({ visible: true, position: { y: .3 }, category: 'fixture' });
  await page.getByRole('button', { name: 'Replace Asset', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('VRC Bubble Earthed Socket — Cream / Khaki');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'VRC Bubble Earthed Socket — Cream / Khaki', exact: true }) }).click();
  await page.getByRole('button', { name: 'frame', exact: true }).click();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect((await state(page)).find(item => item.id === socket.id)).toMatchObject({ assetKey: 'vrc_bubble_socket_cream_khaki', sectionFinishes: { frame: { color: '#f3f1ea' } } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await state(page)).find(item => item.id === socket.id)).toMatchObject({ assetKey: 'vrc_bubble_socket_cream_khaki', sectionFinishes: { frame: { color: '#f3f1ea' } } });
});

test('offline exports contain the new fittings and automatically upgraded vacuum and purifier', async ({ page, context, request }, testInfo) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/electrical-appliances.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await choose(page, 'VRC Bubble Single Rocker Switch — Burgundy');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('electrical-appliances.html');
  await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const items = saved.document.elements.filter((e: any) => e.kind === 'furniture.standard').map((e: any) => e.data);
  expect(items).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'robot', assetKey: 'robot_vacuum', dimensions: { x: .35, y: .15, z: .46 } }),
    expect.objectContaining({ id: 'purifier', assetKey: 'air_purifier' }),
    expect.objectContaining({ assetKey: 'vrc_bubble_single_switch_burgundy', displayName: 'VRC Bubble Single Rocker Switch — Burgundy' }),
  ]));
});

test('electrical reference gallery and household appliances render without shader errors', async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
  const items: Record<string, object> = { ...fixture().plan.items };
  ELECTRICAL_ASSETS.forEach((asset, index) => {
    const x = index < 4 ? 1.65 + index * .23 : 1.8 + (index - 4) * .23;
    items[asset.key] = { name: asset.key, assetKey: asset.key, dimensions: asset.defaultDimensions,
      position: { x, y: index < 4 ? 1.35 : 1.1, z: .101 + asset.defaultDimensions.z / 2 }, pc: { x: x * 100, y: 10 }, rotationY: 0 };
  });
  await request.post('/api/save-plan', { data: { plan: { ...workflowPlan().plan, items } } });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sockets', exact: true }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^Foreground:/ }).click();
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2.05, 1.45, 1.18);
    runtime.scene.getControls()!.target.set(2, 1.25, .11); runtime.scene.getControls()!.update();
  });
  await expect.poll(async () => (await state(page)).length).toBe(9);
  await page.screenshot({ path: testInfo.outputPath('electrical-reference-gallery.png') });
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    runtime.scene.getCamera().position.set(2.7, 1.1, 2.3);
    runtime.scene.getControls()!.target.set(1.95, .2, 1); runtime.scene.getControls()!.update();
  });
  await page.screenshot({ path: testInfo.outputPath('robot-vacuum-and-purifier.png') });
  expect(errors).toEqual([]);
});
