import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, offlineDocument } from './workflow-helpers';
import { standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
async function state(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value, wall = runtime.editor.getDocument().requireWall('wall'), render = runtime.scene.getRenderObject('wall');
    const cornices: any[] = [], boards: any[] = [], bodies: any[] = [];
    render?.traverse((o: any) => {
      if (!o.isMesh) return;
      if (o.userData.section === 'cornice') { o.geometry.computeBoundingBox(); cornices.push({ name: o.name, height: o.position.y + wall.cornice.height, width: o.geometry.boundingBox.max.x - o.geometry.boundingBox.min.x, color: o.material.color.getHexString(), visible: o.parent.visible }); }
      if (o.userData.section === 'baseboard') boards.push({ color: o.material.color.getHexString(), x: o.position.x, width: o.geometry.parameters.width });
      if (Array.isArray(o.material)) bodies.push(o.material.map((m: any) => m.color.getHexString()));
    });
    return { status: runtime.scene.getStatus().state, wall: wall.toData(), cornices, boards, bodies, selected: runtime.editor.selection.getSnapshot() };
  });
}
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).status).toBe('ready');
}
async function selectWall(page: Page) {
  const point = await page.evaluate(async () => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene, camera = scene.getCamera();
    camera.position.set(2, 1.5, 5); scene.getControls().target.set(2, 1.5, 0); scene.getControls().update(); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    scene.getScene().updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const p = camera.position.clone().set(.25, 1.3, .11).project(camera), r = scene.getDomElement().getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.getByText('ID: wall', { exact: true })).toBeVisible();
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: { plan: { ...workflowPlan().plan, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('wall targets create skirting immediately and keep top, sill, ends and cornice finishes independent', async ({ page }) => {
  await selectWall(page); await page.getByRole('button', { name: 'Skirting board (bottom)', exact: true }).click();
  await expect(page.getByLabel('Skirting boards enabled', { exact: true })).not.toBeChecked();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  await expect(page.getByLabel('Skirting boards enabled', { exact: true })).toBeChecked(); expect((await state(page)).boards.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Wall top edge', exact: true }).click(); await page.getByTitle('Simply White (#f7f6ef)', { exact: true }).click();
  await page.getByRole('button', { name: 'Window sills', exact: true }).click(); await page.getByTitle('Chantilly Lace (#fbfbf9)', { exact: true }).click();
  await page.getByRole('button', { name: 'Start End Cap (p1)', exact: true }).click(); await page.getByTitle('Alabaster (#f0ece2)', { exact: true }).click();
  await page.getByRole('button', { name: 'Top corner / cornice', exact: true }).click();
  await page.getByLabel('Cornice profile', { exact: true }).selectOption('ogee'); await page.getByTitle('Swiss Coffee (#f1ede3)', { exact: true }).click();
  const current = await state(page);
  expect(current.wall).toMatchObject({ finishBaseboard: { color: '#f3f1ea' }, finishEdgeTop: { color: '#f7f6ef' }, finishSill: { color: '#fbfbf9' }, finishEdgeStart: { color: '#f0ece2' }, cornice: { profile: 'ogee', finish: { color: '#f1ede3' } } });
  expect(current.cornices[0].width).toBeCloseTo(4); expect(current.cornices[0].color).toBe('f1ede3');
  expect(current.boards.every(b => b.color === 'f3f1ea')).toBe(true);
  expect(current.bodies.every(m => m[4] === 'f7f6ef' && m[6] === 'fbfbf9' && m[2] === 'f0ece2')).toBe(true);
  await page.getByRole('button', { name: 'Skirting board (bottom)', exact: true }).click(); await page.getByLabel('Skirting boards enabled', { exact: true }).uncheck();
  expect((await state(page)).boards).toEqual([]); await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await state(page)).boards.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden(); await page.reload(); await ready(page);
  expect((await state(page)).wall).toMatchObject({ finishSill: { color: '#fbfbf9' }, finishBaseboard: { color: '#f3f1ea' }, cornice: { profile: 'ogee' } });
});

test('old window cornices become one full-wall profile, follow a lowered ceiling and edit offline on iPad', async ({ page, request, browser }, info) => {
  const raw = workflowPlan();
  Object.assign(raw.plan.walls.wall.holes, { second_window: { ...raw.plan.walls.wall.holes.window, pc: { x: 200, y: 0 }, width: 60 } });
  Object.assign(raw.plan.rooms2.room, { ceilingHeight: 260 });
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items: {} } } }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await selectWall(page);
  expect((await state(page)).cornices).toHaveLength(1); expect((await state(page)).cornices[0]).toMatchObject({ height: 2.6 });
  await page.getByRole('button', { name: 'Top corner / cornice', exact: true }).click();
  for (const profile of ['plain', 'cove', 'stepped', 'ogee']) { await page.getByLabel('Cornice profile', { exact: true }).selectOption(profile); expect((await state(page)).cornices).toHaveLength(1); }
  await page.getByLabel('Cornice height (cm)', { exact: true }).fill('10'); await page.getByLabel('Cornice projection (cm)', { exact: true }).fill('14');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('wall-trims.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  expect(saved.document.elements.find((e: any) => e.kind === 'wall').data.cornice).toMatchObject({ profile: 'ogee', height: .1, depth: .14 });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'wall-trims'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); await selectWall(tablet);
  await tablet.getByRole('button', { name: 'Top corner / cornice', exact: true }).tap(); await expect(tablet.getByLabel('Cornice profile', { exact: true })).toHaveValue('ogee');
  await tablet.getByLabel('Cornice profile', { exact: true }).selectOption('stepped'); expect((await state(tablet)).cornices[0].height).toBe(2.6);
  await tablet.getByRole('button', { name: 'Skirting board (bottom)', exact: true }).tap(); await tablet.getByLabel('Skirting boards enabled', { exact: true }).check(); expect((await state(tablet)).boards.length).toBeGreaterThan(0);
  await tablet.screenshot({ path: info.outputPath('ipad-wall-trims.png') }); await context.close();
});

test('Momento Silan wall paints are searchable, paginated and preserved in offline touch exports', async ({ page, browser }, info) => {
  await selectWall(page);
  await page.getByTitle('Side A', { exact: true }).click();
  await page.getByRole('button', { name: 'Filli Boya Momento Silan (1284)', exact: true }).click();
  const swatches = page.getByRole('region', { name: 'Paint colors', exact: true });
  await expect(swatches.getByRole('button')).toHaveCount(120);
  await page.getByRole('button', { name: 'Show more colors (120 of 1284)', exact: true }).click();
  await expect(swatches.getByRole('button')).toHaveCount(240);
  await page.getByRole('textbox', { name: 'Search wall colors', exact: true }).fill('andezit 10');
  const andesite = page.getByTitle('ANDEZİT 10 (#eef2f3)', { exact: true });
  await expect(andesite.locator('div').first()).toHaveCSS('background-color', 'rgb(238, 242, 243)');
  const search = page.getByRole('textbox', { name: 'Search wall colors', exact: true });
  for (const query of ['andezit 10', 'ANDEZİT 10']) {
    await search.fill(query); await expect(andesite).toBeVisible();
  }
  for (const query of ['sis bulutu', 'SİS BULUTU']) {
    await search.fill(query); await expect(page.getByTitle('SİS BULUTU (#ece6db)', { exact: true })).toBeVisible();
  }
  for (const query of ['kum beyazı', 'kum beyazi']) {
    await search.fill(query); await expect(page.getByTitle('KUM BEYAZI (#eeedeb)', { exact: true })).toBeVisible();
  }
  await search.fill('Andesite 10');
  await expect(page.getByText('No wall colors matching "Andesite 10"', { exact: true })).toBeVisible();
  await search.fill('andezit 10');
  await andesite.click();
  expect((await state(page)).wall.finishSideA).toMatchObject({ type: 'paint', color: '#eef2f3', roughness: .85 });
  await page.getByRole('textbox', { name: 'Search wall colors', exact: true }).fill('#eef2f3');
  await expect(andesite).toBeVisible();
  await page.screenshot({ path: info.outputPath('momento-silan-wall.png') });
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('momento-silan-editor.html'); await (await downloading).saveAs(path);
  const html = readFileSync(path, 'utf8');
  const saved = JSON.parse(standaloneBlockText(html, 'plan-data'));
  expect(saved.document.elements.find((e: any) => e.kind === 'wall').data.finishSideA).toMatchObject({ color: '#eef2f3' });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const url = 'http://127.0.0.1:3100/__offline__/momento-silan.html', network: string[] = [], errors: string[] = [];
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: html }) : (network.push(route.request().url()), route.abort()));
  const tablet = await context.newPage(); tablet.on('pageerror', error => errors.push(error.message));
  await tablet.goto(url); await ready(tablet);
  expect((await state(tablet)).wall.finishSideA).toMatchObject({ color: '#eef2f3' });
  await selectWall(tablet); await tablet.getByTitle('Side A', { exact: true }).tap();
  await tablet.getByRole('textbox', { name: 'Search wall colors', exact: true }).fill('kozmik 190');
  await tablet.getByTitle('KOZMİK 190 (#c7e7f8)', { exact: true }).tap();
  expect((await state(tablet)).wall.finishSideA).toMatchObject({ color: '#c7e7f8' });
  expect(network).toEqual([]); expect(errors).toEqual([]);
  await context.close();
});
