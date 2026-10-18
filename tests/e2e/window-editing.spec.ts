import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, offlineDocument } from './workflow-helpers';
import { standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
async function state(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value, wall = runtime.editor.getDocument().requireWall('wall');
    const windows = wall.openings.filter((o: any) => o.type === 'window' || o.type === 'french_window').map((o: any) => {
      const root = runtime.scene.getRenderObject(o.id), track = root?.getObjectByName(`curtain_track_${o.id}`);
      return { ...o.toData(), trackWidth: track?.geometry.parameters.width, trackHeight: track?.position.y, renderX: root?.children[0]?.position.x };
    });
    let bodyGeometry: string | undefined; runtime.scene.getRenderObject('wall')?.traverse((o: any) => { if (o.isMesh && Array.isArray(o.material)) bodyGeometry = o.geometry.uuid; });
    return { status: runtime.scene.getStatus().state, windows, selected: runtime.editor.selection.getSnapshot(), bodyGeometry };
  });
}
async function ready(page: Page) { await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible(); await expect.poll(async () => (await state(page)).status).toBe('ready'); }
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
async function apply(page: Page, width: string, height: string, sill: string, left: string) {
  await page.getByLabel('Window width (cm)', { exact: true }).fill(width);
  await page.getByLabel('Window height (cm)', { exact: true }).fill(height);
  await page.getByLabel('Window sill height (cm)', { exact: true }).fill(sill);
  await page.getByLabel('Window left edge from wall start (cm)', { exact: true }).fill(left);
  await page.getByRole('button', { name: 'Apply window dimensions', exact: true }).click();
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  const raw = workflowPlan(); Object.assign(raw.plan.rooms2.room, { ceilingHeight: 260 });
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('existing windows resize and move, update the wall and curtains, reject invalid drafts and persist', async ({ page }, info) => {
  await selectWall(page); await page.getByRole('button', { name: /^Window 1/ }).click();
  await expect(page.getByLabel('Window width (cm)', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Hide curtains', exact: true }).click();
  const before = await state(page); await apply(page, '150', '100', '70', '200');
  const resized = await state(page); expect(resized.windows[0]).toMatchObject({ id: 'window', width: 1.5, height: 1, floorHeight: .7, distanceAlongWall: 2.75, position: { x: 2.75, y: 0 }, curtainState: 'hidden', trackWidth: 1.8, renderX: 2.75 });
  expect(resized.windows[0].trackHeight).toBeCloseTo(2.5875); expect(resized.bodyGeometry).not.toBe(before.bodyGeometry);
  await apply(page, '500', '100', '70', '200'); await expect(page.getByRole('alert')).toHaveText('The window must fit between the wall ends.');
  expect((await state(page)).windows[0].width).toBe(1.5);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByLabel('Window width (cm)', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByLabel('Window left edge from wall start (cm)', { exact: true })).toHaveValue('200');
  await page.screenshot({ path: info.outputPath('window-dimensions.png') });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden(); await page.reload(); await ready(page);
  expect((await state(page)).windows[0]).toMatchObject({ width: 1.5, height: 1, floorHeight: .7, distanceAlongWall: 2.75, curtainState: 'hidden' });
});

test('adds a window on the selected wall and adds, resizes, deletes and exports offline on iPad', async ({ page, browser }, info) => {
  await selectWall(page); await page.getByRole('button', { name: 'Add window', exact: true }).click();
  const added = (await state(page)).windows.find((w: any) => w.id !== 'window')!;
  expect(added.curtainState).toBe('visible'); expect((await state(page)).selected?.id).toBe(added.id);
  await apply(page, '80', '110', '100', '150');
  expect((await state(page)).windows.find((w: any) => w.id === added.id)).toMatchObject({ width: .8, height: 1.1, floorHeight: 1, distanceAlongWall: 1.9, trackWidth: 1.1 });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('windows.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'windows'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); expect((await state(tablet)).windows).toHaveLength(2);
  await selectWall(tablet); await tablet.getByRole('button', { name: /^Window 1/ }).click(); expect((await state(tablet)).selected?.id).toBe(added.id);
  await apply(tablet, '80', '130', '100', '160');
  expect((await state(tablet)).windows.find((w: any) => w.id === added.id)).toMatchObject({ height: 1.3, distanceAlongWall: 2 });
  await tablet.getByRole('button', { name: 'Delete window', exact: true }).click(); expect((await state(tablet)).windows).toHaveLength(1);
  await tablet.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await state(tablet)).windows).toHaveLength(2);
  await tablet.getByRole('button', { name: 'Add window', exact: true }).click(); expect((await state(tablet)).windows).toHaveLength(3);
  await tablet.screenshot({ path: info.outputPath('ipad-window-editing.png') });
  const offlineDownload = tablet.waitForEvent('download'); await tablet.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const savedPath = info.outputPath('edited-windows.html'); await (await offlineDownload).saveAs(savedPath);
  const saved = JSON.parse(standaloneBlockText(readFileSync(savedPath, 'utf8'), 'plan-data'));
  const windows = saved.document.elements.find((e: any) => e.kind === 'wall').data.openings.filter((o: any) => o.type === 'window');
  expect(windows).toHaveLength(3); expect(windows.find((w: any) => w.id === added.id)).toMatchObject({ height: 1.3, distanceAlongWall: 2 }); await context.close();
});
