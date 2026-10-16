import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, offlineDocument } from './workflow-helpers';
import { standaloneBlockText } from '../../src/services/export/StandaloneHtml';

let original: string;
async function state(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value, scene = runtime.scene, plan = runtime.editor.getDocument();
    const ceiling = scene.getScene().getObjectByName('ceiling_room'), track = scene.getScene().getObjectByName('curtain_track_window');
    if (ceiling) ceiling.geometry.computeBoundingBox();
    return { status: scene.getStatus().state, room: plan.requireRoom('room').toData(), maximum: plan.totalHeight,
      walls: plan.walls.map((w: any) => w.height), ceiling: ceiling ? { height: ceiling.position.y, drop: ceiling.userData.drop, top: ceiling.position.y + ceiling.geometry.boundingBox.max.z } : null,
      track: track?.position.y };
  });
}
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await expect.poll(async () => (await state(page)).status).toBe('ready');
}
async function selectRoom(page: Page) {
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await page.evaluate(async () => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    scene.getScene().updateMatrixWorld(true); scene.getCamera().updateMatrixWorld(true);
    const p = scene.getCamera().position.clone().set(1.5, .01, 2).project(scene.getCamera()), r = scene.getDomElement().getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('heading', { name: 'Room & Floor Finish' })).toBeVisible();
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: { plan: { ...workflowPlan().plan, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('room ceiling drops, curtain mounts, undo and saved heights follow the finished elevation', async ({ page }) => {
  await selectRoom(page); await page.getByRole('button', { name: 'Clip-In 60x60', exact: true }).click();
  const height = page.getByLabel('Finished ceiling height (m)', { exact: true });
  await expect(height).toHaveValue('2.85'); await expect(page.getByText('Shared maximum: 3.00 m · Ceiling drop: 15 cm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ceilings: OFF', exact: true }).click();
  await expect.poll(async () => (await state(page)).ceiling?.height).toBeCloseTo(2.85);
  await height.fill('2.6');
  const dropped = await state(page); expect(dropped.ceiling!.height).toBe(2.6); expect(dropped.ceiling!.top).toBeCloseTo(3); expect(dropped.ceiling!.drop).toBeCloseTo(.4);
  expect(dropped.track).toBeCloseTo(2.5875); expect(dropped.maximum).toBe(3); expect(dropped.walls).toEqual([3]);
  await height.fill('3.1'); await expect(height).toHaveValue('2.6');
  await height.fill('0'); await expect(height).toHaveValue('2.6');
  await height.blur(); await page.keyboard.press('Control+z'); await expect(height).toHaveValue('2.85');
  await page.keyboard.press('Control+Shift+z'); await expect(height).toHaveValue('2.6');
  await page.getByRole('button', { name: 'None', exact: true }).click(); expect((await state(page)).ceiling).toBeNull();
  await page.getByRole('button', { name: 'Clip-In 60x60', exact: true }).click(); await expect(height).toHaveValue('2.6');
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page); await selectRoom(page); await expect(height).toHaveValue('2.6');
  await page.getByRole('button', { name: 'Reset ceiling height', exact: true }).click(); await expect(height).toHaveValue('2.85');
});

test('exported full editor preserves and edits the dropped ceiling offline on iPad', async ({ page, browser }, info) => {
  await selectRoom(page); await page.getByRole('button', { name: 'Clip-In 60x60', exact: true }).click();
  await page.getByLabel('Finished ceiling height (m)', { exact: true }).fill('2.65');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('dropped-ceiling.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  expect(saved.document.elements.find((e: any) => e.kind === 'room').data.ceilingHeight).toBe(2.65);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const url = await offlineDocument(context, path, 'dropped-ceiling'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); await selectRoom(tablet);
  const height = tablet.getByLabel('Finished ceiling height (m)', { exact: true }); await expect(height).toHaveValue('2.65');
  await height.fill('2.55'); await tablet.getByRole('button', { name: 'Ceilings: OFF', exact: true }).tap();
  await expect.poll(async () => (await state(tablet)).ceiling?.height).toBe(2.55); expect((await state(tablet)).track).toBeCloseTo(2.5375);
  await tablet.screenshot({ path: info.outputPath('ipad-dropped-ceiling.png') }); await context.close();
});
