import { expect, test, type Page } from '@playwright/test';
import { workflowPlan, offlineDocument } from './workflow-helpers';

function balconyPlan(sides = true) {
  const raw = workflowPlan();
  Object.assign(raw.plan.rooms2.room, { title: 'Living room', ceilingHeight: 260 });
  Object.assign(raw.plan.rooms2, { balcony: { title: 'Balcony', area: 8, ceilingType: 'none', polygon: [{ x: 0, y: -200 }, { x: 400, y: -200 }, { x: 400, y: 0 }, { x: 0, y: 0 }] } });
  if (sides) Object.assign(raw.plan.walls, {
    left: { p1: { x: 0, y: -200 }, p2: { x: 0, y: 0 }, depth: 20, height: 300, holes: {} },
    right: { p1: { x: 400, y: -200 }, p2: { x: 400, y: 0 }, depth: 20, height: 300, holes: {} },
  });
  return { plan: { ...raw.plan, items: {} } };
}
async function state(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root') as any, key = root && Object.keys(root).find(key => key.startsWith('__reactContainer$'));
    const runtime = key && root[key].stateNode.current.memoizedState.element.props.value, plan = runtime?.editor.getSnapshot();
    if (!plan?.rooms.some((room: any) => room.id === 'balcony')) return null;
    const wall = plan.requireWall('wall'), room = plan.requireRoom('balcony'), cornices: any[] = [], railings: any[] = [];
    runtime.scene.getRenderObject('wall')?.traverse((mesh: any) => { if (mesh.isMesh && mesh.userData.section === 'cornice') cornices.push({ side: mesh.userData.wallSide, visible: mesh.parent.visible, height: mesh.position.y + wall.cornice.height }); });
    runtime.scene.getRenderObject('balcony')?.traverse((mesh: any) => {
      if (!mesh.isMesh || mesh.userData.section !== 'Railing') return;
      mesh.geometry.computeBoundingBox(); railings.push({ color: mesh.material.color.getHexString(), top: mesh.geometry.boundingBox.max.y, runs: mesh.userData.railingRuns, posts: mesh.userData.postCount });
    });
    return { status: runtime.scene.getStatus().state, cornice: wall.cornice, cornices, railing: room.railing, railings, room: room.toData(), wall: wall.toData() };
  });
}
async function ready(page: Page) { await expect.poll(async () => (await state(page))?.status).toBe('ready'); }
async function select(page: Page, target: 'floor' | 'window') {
  const point = await page.evaluate(async target => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(key => key.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene, camera = scene.getCamera();
    scene.updateSettings({ foregroundOcclusionMode: 'off' });
    if (target === 'floor') { camera.position.set(2, 3, -5); scene.getControls().target.set(2, .6, -.8); }
    else { camera.position.set(2, 1.7, 5); scene.getControls().target.set(2, 1.4, 0); }
    scene.getControls().update(); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    scene.getScene().updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const point = camera.position.clone().set(target === 'floor' ? 2 : 2.52, target === 'floor' ? .002 : 1.5, target === 'floor' ? -1 : .11).project(camera), rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }, target);
  await page.mouse.click(point.x, point.y);
  await expect(target === 'floor' ? page.getByRole('heading', { name: 'Room & Floor Finish' }) : page.getByLabel('Window wall cornice')).toBeVisible();
}
let original: string;
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text(); await request.post('/api/save-plan', { data: balconyPlan() });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('window cornice switches remove the balcony face independently and retain dropped ceilings through save/reload', async ({ page }) => {
  expect((await state(page))?.cornices).toEqual(expect.arrayContaining([{ side: 'A', visible: true, height: 2.6 }, { side: 'B', visible: true, height: 3 }]));
  await select(page, 'window');
  const section = page.getByLabel('Window wall cornice');
  await expect(section.getByText('Side A — Living room', { exact: true })).toBeVisible(); await expect(section.getByText('Side B — Balcony', { exact: true })).toBeVisible();
  const before = (await state(page))!;
  await page.getByLabel('Cornice on side B', { exact: true }).uncheck();
  expect((await state(page))?.cornices).toEqual([{ side: 'A', visible: true, height: 2.6 }]);
  expect((await state(page))?.wall.openings).toEqual(before.wall.openings);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await state(page))?.cornices).toHaveLength(2);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByLabel('Cornice on side A', { exact: true }).uncheck(); expect((await state(page))?.cornices.every(item => !item.visible)).toBe(true);
  await page.getByLabel('Cornice on side A', { exact: true }).check();
  expect((await state(page))?.cornice).toMatchObject({ side: 'A', profile: before.cornice.profile, height: before.cornice.height, depth: before.cornice.depth, offset: before.cornice.offset });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload(); await ready(page); expect((await state(page))?.cornices).toEqual([{ side: 'A', visible: true, height: 2.6 }]);
});

test('floor railing meets end walls, edits independently and survives offline iPad export', async ({ page, browser }, info) => {
  await select(page, 'floor'); await page.getByRole('button', { name: 'Add railing to open edges', exact: true }).click();
  const initial = (await state(page))!; expect(initial.railings).toHaveLength(1); expect(initial.railings[0].top).toBeCloseTo(1.05);
  const run = initial.railings[0].runs[0]; expect(initial.railings[0].runs).toHaveLength(1);
  expect(run.start.x).toBeCloseTo(.1); expect(run.end.x).toBeCloseTo(3.9); expect(run.start.y).toBeCloseTo(-1.975);
  expect(run.startAtWall && run.endAtWall).toBe(true);
  await page.getByLabel('Railing height (cm)', { exact: true }).fill('112'); await page.getByLabel('Railing colour', { exact: true }).fill('#768593');
  await page.getByLabel('Railing edge 1', { exact: true }).uncheck(); expect((await state(page))?.railings).toEqual([]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await state(page))?.railings[0]).toMatchObject({ color: '768593', top: expect.closeTo(1.12) });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('balcony-editor.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'balcony'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); expect((await state(tablet))?.railing).toMatchObject({ height: 1.12, color: '#768593' });
  await select(tablet, 'floor'); await tablet.getByRole('button', { name: 'Remove railing', exact: true }).tap(); expect((await state(tablet))?.railings).toEqual([]);
  await tablet.getByRole('button', { name: 'Undo', exact: true }).tap(); expect((await state(tablet))?.railings).toHaveLength(1);
  await tablet.screenshot({ path: info.outputPath('ipad-balcony-railing.png') }); await context.close();
});

test('three open balcony edges join at shared corners', async ({ page, request }, info) => {
  await request.post('/api/save-plan', { data: balconyPlan(false) }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  await select(page, 'floor'); await page.getByRole('button', { name: 'Add railing to open edges', exact: true }).click();
  const railing = (await state(page))!.railings[0]; expect(railing.runs).toHaveLength(3); expect(railing.posts).toBe(9);
  const runs = railing.runs; expect(runs[0].end).toEqual(runs[1].start); expect(runs[2].end).toEqual(runs[0].start);
  await page.screenshot({ path: info.outputPath('balcony-open-corners.png') });
});
