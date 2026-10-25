import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { defaultCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../../src/services/export/StandaloneHtml';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog);
const runtimeScript = `const root=document.getElementById('root'),key=Object.keys(root).find(k=>k.startsWith('__reactContainer$'));return root[key].stateNode.current.memoizedState.element.props.value;`;
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    const r = key && root[key].stateNode.current.memoizedState.element?.props.value;
    return r && r.scene.getStatus().state === 'ready' && !r.scene.preparing && !r.scene.needsPreparation;
  }, undefined, { timeout: 120000 });
}
async function cabinetData(page: Page) {
  return page.evaluate(script => new Function(script)().editor.getDocument().requireFurniture('cabinet').toData(), runtimeScript);
}
async function openCabinet(page: Page) {
  const point = await page.evaluate(async script => {
    const r = new Function(script)(), s = r.scene, camera = s.getCamera(), controls = s.getControls();
    camera.position.set(0, .85, 3.8); controls.target.set(0, .8, 0); controls.update(); s.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    camera.updateMatrixWorld(true);
    const p = camera.position.clone().set(.12, .8, .33).project(camera), rect = s.getDomElement().getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  }, runtimeScript);
  await page.mouse.click(point.x, point.y);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cabinet layout editor' })).toBeVisible();
}

test('IKEA kitchenware can be placed and stacked in cabinets, exported and reopened offline on touch', async ({ page, request, context, browser }, info) => {
  const errors: string[] = [], network: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const dimensions = { x: 1, y: 1.6, z: .65 };
  const cabinet = defaultCabinet({ dimensions, assetKey: 'cabinet_tall_single' }, 1);
  const item = codec.factory.furniture({ id: 'cabinet', name: 'cabinet_tall_single', assetKey: 'cabinet_tall_single', displayName: 'Single-Door Tall Cabinet', category: 'storage', dimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet });
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(codec.encode(new PlanDocument([item])))));
  const url = 'http://127.0.0.1:3100/__offline__/ikea-kitchen.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: html }) : (network.push(route.request().url()), route.abort()));
  await page.goto(url); await ready(page); await openCabinet(page);
  async function place(code: string) {
    await page.getByRole('button', { name: 'Place object', exact: true }).click();
    await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(code);
    await expect(page.getByRole('region', { name: 'Catalogue results' })).toContainText(`IKEA ${code}`);
    await page.getByRole('button').filter({ has: page.getByRole('heading', { name: catalog.get(`ikea_${code}`)!.name, exact: true }) }).click();
  }
  await page.getByRole('button', { name: 'Shelf 1', exact: true }).click();
  await place('10597103');
  await page.getByLabel('Copies to stack', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Stack copies above', exact: true }).click();
  await page.getByRole('button', { name: 'Shelf 2', exact: true }).click();
  await place('00545218');
  await page.getByLabel('Supporting shelf', { exact: true }).selectOption('base');
  await place('10460020');
  await page.getByLabel('Supporting shelf', { exact: true }).selectOption('base');
  // Move the organizer clear of the pan, using the actual interior editor controls.
  const xLabel = page.getByText('X (Horiz.)', { exact: true }).locator('..').locator('input');
  await xLabel.fill('.5');
  await expect(page.getByRole('dialog', { name: 'Cabinet layout editor' }).getByRole('status')).toContainText('No collisions or unsupported objects');
  await page.screenshot({ path: info.outputPath('kitchen-cabinet-contents.png') });
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await ready(page);
  const saved = await cabinetData(page);
  expect(saved.cabinet.contents).toHaveLength(5);
  expect(saved.cabinet.contents.filter((o: any) => o.assetKey === 'ikea_10597103')).toHaveLength(3);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('kitchen-editor.html'); await (await download).saveAs(path);
  const exported = readFileSync(path, 'utf8');
  const touch = await browser.newContext({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true });
  await touch.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: exported }) : (network.push(route.request().url()), route.abort()));
  const tablet = await touch.newPage(); tablet.on('pageerror', error => errors.push(error.message));
  await tablet.goto(url); await ready(tablet);
  expect(await cabinetData(tablet)).toEqual(saved);
  await openCabinet(tablet);
  await expect(tablet.getByRole('dialog', { name: 'Cabinet layout editor' }).getByRole('status')).toContainText('No collisions or unsupported objects');
  await tablet.screenshot({ path: info.outputPath('kitchen-cabinet-touch.png') });
  expect(errors).toEqual([]); expect(network).toEqual([]);
  await touch.close();
});

test('representative kitchenware renders offline with open vessels, handles and organizers', async ({ page, request, context }, info) => {
  const codes = ['00545218', '80580905', '30580903', '70554515', '80258915', '30258913', '10279723', '80309302', '10270478', '00291928', '60359152', '10597103', '70359199', '50279721', '90150071', '60241389', '10099053', '70256993', '30256990', '30512810', '40393086', '00521934', '76113785', '10460020', '60136623', '90322360', '70154800', '60604714', '10387261', '10283517'];
  const items = codes.map((code, i) => {
    const asset = catalog.get(`ikea_${code}`)!;
    return codec.factory.furniture({ id: code, name: asset.key, assetKey: asset.key, displayName: asset.name, category: 'kitchen', dimensions: asset.defaultDimensions, position: { x: (i % 4) * .8, y: 0, z: Math.floor(i / 4) * .75 }, rotationY: 0 });
  });
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(codec.encode(new PlanDocument(items)))));
  const url = 'http://127.0.0.1:3100/__offline__/kitchen-gallery.html', network: string[] = [], errors: string[] = [];
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: html }) : (network.push(route.request().url()), route.abort()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await ready(page);
  for (const [group, z] of [0, 1.5, 3, 4.5].entries()) {
    await page.evaluate(({ script, z }) => {
      const r = new Function(script)(), s = r.scene, camera = s.getCamera(), controls = s.getControls();
      s.updateSettings({ showFloor: false, foregroundOcclusionMode: 'off' });
      controls.target.set(1.2, .05, z + .37); camera.position.set(1.5, 1.9, z + 2.5); camera.zoom = 1.45; camera.updateProjectionMatrix(); controls.update(); s.invalidate();
    }, { script: runtimeScript, z });
    await ready(page); await page.waitForTimeout(100);
    await page.screenshot({ path: info.outputPath(`kitchen-gallery-${group}.png`) });
  }
  expect(errors).toEqual([]); expect(network).toEqual([]);
});
