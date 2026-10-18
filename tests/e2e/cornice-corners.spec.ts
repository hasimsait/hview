import { expect, test, type Page } from '@playwright/test';
import { workflowPlan, offlineDocument } from './workflow-helpers';

let original: string;
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    return root[key].stateNode.current.memoizedState.element.props.value.scene.getStatus().state;
  })).toBe('ready');
}
async function cornerState(page: Page, side = 'A') {
  return page.evaluate(side => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value, scene = runtime.scene.getScene(); scene.updateMatrixWorld(true);
    const meshes = ['wall', 'right'].map(id => scene.getObjectByName(`wall_cornice_${id}_${side}`));
    const caps = meshes.map((mesh: any, i) => {
      const geom = mesh.geometry, group = geom.groups[0], count = group.count / 2, start = group.start + (i ? count : 0), points = [];
      for (let j = start; j < start + count; j++) points.push(mesh.position.clone().fromBufferAttribute(geom.attributes.position, geom.index?.getX(j) ?? j).applyMatrix4(mesh.matrixWorld));
      return points;
    });
    const error = Math.max(...caps.flatMap((points, i) => points.map(p => Math.min(...caps[1 - i].map(q => p.distanceTo(q))))));
    return { error, geometry: meshes.map((m: any) => m.geometry.uuid), top: Math.max(...caps[0].map((p: any) => p.y)), offsets: ['wall', 'right'].map(id => runtime.editor.getDocument().requireWall(id).cornice.offset) };
  }, side);
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
  await page.getByRole('button', { name: 'Top corner / cornice', exact: true }).click();
}
async function frameCorner(page: Page, outside = false) {
  const foreground = page.getByRole('button', { name: /^Foreground:/ });
  for (let i = 0; i < 2 && (await foreground.textContent())?.includes('Solid') !== true; i++) await foreground.click();
  if (!outside && await page.getByRole('button', { name: 'Ceilings: OFF', exact: true }).isVisible()) await page.getByRole('button', { name: 'Ceilings: OFF', exact: true }).click();
  await page.evaluate(async outside => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene;
    if (outside) { scene.getCamera().position.set(5.6, 1.8, -1.6); scene.getControls().target.set(4.2, 2.45, -.2); }
    else { scene.getCamera().position.set(2.2, 1.8, 2.2); scene.getControls().target.set(3.75, 2.45, .35); }
    scene.getControls().update(); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, outside);
}
test.beforeEach(async ({ request, page }) => {
  original = await (await request.get('/sample.plan')).text();
  const raw = workflowPlan(), cornice = { profile: 'cove', height: .12, depth: .12, offset: .17, side: 'interior' };
  Object.assign(raw.plan.walls.wall, { cornice }); Object.assign(raw.plan.rooms2.room, { ceilingHeight: 260 });
  Object.assign(raw.plan.walls, { right: { p1: { x: 400, y: 0 }, p2: { x: 400, y: 400 }, depth: 20, height: 300, material: 'a_block', holes: {}, cornice } });
  await request.post('/api/save-plan', { data: { plan: { ...raw.plan, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});

test('outside corners extend to the shared mitre instead of leaving a square gap', async ({ page, request }, info) => {
  const raw = await (await request.get('/sample.plan')).json();
  for (const wall of Object.values(raw.plan.walls) as any[]) { wall.cornice.side = 'B'; wall.height = 260; }
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  const result = await cornerState(page, 'B'); expect(result.error).toBeLessThan(.000002); expect(result.top).toBeCloseTo(2.6);
  await frameCorner(page, true); await page.screenshot({ path: info.outputPath('outside-mitred-corner.png') });
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('mitres update both walls on clearance edits and remain joined after save and offline iPad export', async ({ page, browser }, info) => {
  const initial = await cornerState(page); expect(initial.error).toBeLessThan(.000002); expect(initial.top).toBeCloseTo(2.6);
  await frameCorner(page); await page.screenshot({ path: info.outputPath('inside-mitred-corner.png') });
  await selectWall(page); await page.getByLabel('Cornice clearance from wall (cm)', { exact: true }).fill('8');
  const edited = await cornerState(page); expect(edited.error).toBeLessThan(.000002); expect(edited.offsets).toEqual([.08, .17]);
  expect(edited.geometry[0]).not.toBe(initial.geometry[0]); expect(edited.geometry[1]).not.toBe(initial.geometry[1]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect((await cornerState(page)).offsets).toEqual([.17, .17]); expect((await cornerState(page)).error).toBeLessThan(.000002);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden(); await page.reload(); await ready(page);
  expect((await cornerState(page)).error).toBeLessThan(.000002); expect((await cornerState(page)).offsets).toEqual([.08, .17]);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('cornice-corners.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'cornice-corners'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); expect((await cornerState(tablet)).error).toBeLessThan(.000002); expect((await cornerState(tablet)).top).toBeCloseTo(2.6);
  await selectWall(tablet); await tablet.getByLabel('Cornice projection (cm)', { exact: true }).fill('16'); expect((await cornerState(tablet)).error).toBeLessThan(.000002);
  await tablet.getByTitle('Close Inspector', { exact: true }).click(); await frameCorner(tablet); await tablet.screenshot({ path: info.outputPath('ipad-mitred-corner.png') }); await context.close();
});
