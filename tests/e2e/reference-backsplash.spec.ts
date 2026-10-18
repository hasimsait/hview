import { expect, test, type Page } from '@playwright/test';
import { offlineDocument } from './workflow-helpers';

const variant = 'ivory_taupe_striped_mosaic_30x30';
let original: string;
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).status).toBe('ready');
}
async function state(page: Page) {
  return page.evaluate(variant => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value;
    const wall = runtime.editor.getDocument().requireWall('wall'), root3d = runtime.scene.getRenderObject('wall');
    let material: any; root3d.traverse((o: any) => { if (o.isMesh && Array.isArray(o.material)) material = o.material[0]; });
    return { status: runtime.scene.getStatus().state, finish: wall.finishSideA, entry: runtime.tiles.getById(variant), roughness: material?.roughness, image: { width: material?.map?.image?.width ?? 0, height: material?.map?.image?.height ?? 0, src: material?.map?.image?.currentSrc ?? '' } };
  }, variant);
}
async function selectWall(page: Page) {
  const point = await page.evaluate(async () => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene, camera = scene.getCamera();
    camera.position.set(.6, .3, 1.3); scene.getControls().target.set(.6, .3, 0); scene.getControls().update(); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    camera.updateMatrixWorld(true); scene.getScene().updateMatrixWorld(true);
    const p = camera.position.clone().set(.6, .3, .11).project(camera), r = scene.getDomElement().getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.getByText('ID: wall', { exact: true })).toBeVisible();
}
async function chooseMosaic(page: Page) {
  await page.getByRole('button', { name: 'Tile & Marble', exact: true }).click();
  await page.getByRole('button', { name: /Ivory & Taupe Striped Mosaic Backsplash/ }).click();
  await expect.poll(async () => (await state(page)).image.width).toBeGreaterThan(0);
  expect((await state(page)).finish).toMatchObject({ type: 'tile', variant, pattern: 'grid', groutWidth: 0 });
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: { plan: { v: 3, total_height: 260, walls: { wall: { p1: { x: 0, y: 0 }, p2: { x: 120, y: 0 }, depth: 20, height: 60, material: 'a_block', holes: {} } }, rooms2: {}, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('reference mosaic applies at sheet scale, saves and remains editable offline on iPad', async ({ page, browser }, info) => {
  await selectWall(page); await chooseMosaic(page);
  expect((await state(page)).entry).toMatchObject({ widthCm: 30, heightCm: 30, roughness: .22 });
  expect((await state(page)).roughness).toBe(.22);
  await page.getByTitle('Close Inspector', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('mosaic-backsplash.png') });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page); expect((await state(page)).finish?.variant).toBe(variant);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('mosaic-backsplash.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'mosaic-backsplash'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); await expect.poll(async () => (await state(tablet)).image.width).toBeGreaterThan(0);
  expect((await state(tablet)).image.src).toMatch(/^blob:/); expect((await state(tablet)).finish?.variant).toBe(variant);
  await selectWall(tablet); await tablet.getByRole('button', { name: 'Paint & Plaster', exact: true }).click(); await tablet.getByTitle('White Dove (#f3f1ea)', { exact: true }).click(); await chooseMosaic(tablet);
  await tablet.getByTitle('Close Inspector', { exact: true }).click(); await tablet.screenshot({ path: info.outputPath('ipad-mosaic-backsplash.png') }); await context.close();
});
