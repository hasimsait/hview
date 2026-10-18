import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan, numberField } from './workflow-helpers';
import { defaultCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { escapeScriptJson, packStandaloneHtml, setScriptContent, standaloneBlockText } from '../../src/services/export/StandaloneHtml';
const dimensions = { x: .6, y: 1.9, z: .4 };
const cabinet = () => defaultCabinet({ dimensions, assetKey: 'cabinet_tall_single' }, 1);
function fixture() { return { plan: { ...workflowPlan().plan, items: { cabinet: { name: 'cabinet_tall_single', assetKey: 'cabinet_tall_single', dimensions, position: { x: 2, y: 0, z: 2 }, pc: { x: 200, y: 200 }, rotationY: 0, cabinet: cabinet() } } } }; }
let original: string;
async function ready(page: Page) { await expect(page.getByRole('button', { name: 'Move', exact: true }).first()).toBeVisible(); await page.waitForFunction(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); return runtime.scene.getStatus().state === 'ready'; }); }
// Read-only inspection of the same providers used by the full and offline editors.
async function snapshot(page: Page, draft = false) {
  return page.evaluate(draft => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, contexts: any[] = [];
    function scan(fiber: any) { if (!fiber) return; const value = fiber.memoizedProps?.value; if (value?.editor && value?.scene && !contexts.includes(value)) contexts.push(value); scan(fiber.child); scan(fiber.sibling); }
    scan(root[key].stateNode.current); const runtime = contexts[draft ? 1 : 0];
    if (!runtime) return null;
    const snapshot = runtime.editor.getSnapshot(); if (!snapshot) return null;
    const item = snapshot.requireFurniture('cabinet'), mesh = runtime.scene.getRenderObject('cabinet');
    const red: string[] = []; mesh?.traverse((o: any) => { if (o.isMesh && o.userData.collision && o.userData.cabinetPart) red.push(o.userData.cabinetPart); });
    return { data: item.toData(), red: [...new Set(red)], issues: mesh?.userData.cabinetIssues, doorCollision: mesh?.userData.doorCollision, parts: Object.fromEntries([...(item.cabinet?.panels ?? []), ...(item.cabinet?.contents ?? [])].map((part: any) => [part.id, runtime.scene.getCabinetPart(item.id, part.id)?.position.toArray()])), count: runtime.editor.getDocument().furniture.length, camera: runtime.scene.getCamera().position.toArray(), status: runtime.scene.getStatus().state };
  }, draft);
}
async function selectCabinet(page: Page) {
  const point = await page.evaluate(async () => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, runtime = root[key].stateNode.current.memoizedState.element.props.value, scene = runtime.scene, camera = scene.getCamera();
    camera.position.set(2, 1, 5.8); scene.getControls().target.set(2, .95, 2); scene.getControls().update(); camera.updateMatrixWorld(true); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    scene.getScene().updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const pos = camera.position.clone().set(2.10, 1, 2.21).project(camera), rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (pos.x + 1) * rect.width / 2, y: rect.top + (1 - pos.y) * rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toBeVisible();
}
async function openLayout(page: Page) {
  await selectCabinet(page); await page.getByRole('button', { name: 'Edit layout', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Cabinet layout editor' })).toBeVisible(); await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
}
async function chooseObject(page: Page, name: string) {
  await page.getByRole('button', { name: 'Place object', exact: true }).click(); await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Catalogue source', { exact: true }).selectOption('Generic'); await page.getByLabel('Accessory type', { exact: true }).selectOption('Cabinet fit objects');
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(name);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
}
test.beforeEach(async ({ page, request }) => { original = await (await request.get('/sample.plan')).text(); await request.post('/api/save-plan', { data: fixture() }); await page.route(/^https:\/\/fonts\./, r => r.abort()); await page.goto('/'); await ready(page); });
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('desktop builds partial dividers, drops contents onto shelves and commits one reversible layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openLayout(page); const main = await snapshot(page); expect((await snapshot(page, true))!.count).toBe(1);
  await page.getByRole('button', { name: 'Shelf 1', exact: true }).click(); await numberField(page, 'Y (Elev.)').fill('.45');
  await page.getByRole('button', { name: 'Shelf 2', exact: true }).click(); await numberField(page, 'Y (Elev.)').fill('1.6');
  await page.getByRole('button', { name: 'Add divider', exact: true }).click(); const divider = (await snapshot(page, true))!.data.cabinet.panels.find((p: any) => p.kind === 'divider');
  // It starts above the selected shelf. Make it full height before splitting it.
  await page.getByLabel('Panel start boundary', { exact: true }).selectOption('bottom');
  await page.getByRole('button', { name: 'Shelf 1', exact: true }).click(); await page.getByLabel('Panel end boundary', { exact: true }).selectOption(divider.id);
  await page.getByRole('button', { name: 'Divider 1', exact: true }).click(); await page.getByRole('button', { name: 'Split divider at shelves', exact: true }).click();
  await page.getByRole('button', { name: 'Divider 1 1', exact: true }).click(); await page.getByRole('button', { name: 'Delete Object', exact: true }).click();
  await page.getByRole('button', { name: 'Divider 1 2', exact: true }).click(); await page.getByRole('button', { name: 'Add shelf', exact: true }).click(); await numberField(page, 'Y (Elev.)').fill('.9');
  await chooseObject(page, 'Laundry Detergent Bottle');
  let state = (await snapshot(page, true))!; const bottle = state.data.cabinet.contents[0], support = state.data.cabinet.panels.find((p: any) => p.id === bottle.supportId);
  expect(bottle.position.y).toBe(0); expect(support.at).toBe(.9); expect(state.red).not.toContain(bottle.id);
  await numberField(page, 'X (Horiz.)').fill('.52'); state = (await snapshot(page, true))!; expect(state.red).toContain(bottle.id);
  await numberField(page, 'X (Horiz.)').fill('.02'); expect((await snapshot(page, true))!.red).not.toContain(bottle.id);
  await page.getByRole('button', { name: 'Shelf 3', exact: true }).click(); await page.getByRole('button', { name: 'Delete Object', exact: true }).click();
  state = (await snapshot(page, true))!; expect(state.data.cabinet.contents[0].supportId).toBeUndefined(); expect(state.red).toContain(bottle.id);
  await page.getByRole('button', { name: 'Undo layout', exact: true }).click(); expect((await snapshot(page, true))!.data.cabinet.contents[0].supportId).toBe(bottle.supportId);
  await page.getByRole('button', { name: '3D view', exact: true }).click(); await page.screenshot({ path: info.outputPath('cabinet-layout-desktop.png') });
  expect((await snapshot(page))!.data).toEqual(main!.data); expect((await snapshot(page))!.camera).toEqual(main!.camera);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const saved = (await snapshot(page))!.data.cabinet; expect(saved.panels).toHaveLength(5); expect(saved.contents).toHaveLength(1); expect(saved.doors.angles).toEqual([0, 0]);
  await page.keyboard.press('Control+z'); expect((await snapshot(page))!.data.cabinet.contents).toHaveLength(0);
  await page.keyboard.press('Control+Shift+z'); expect((await snapshot(page))!.data.cabinet.contents).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('shrinking and restoring a cabinet preserves shelves and contents and checks only inside layout mode', async ({ page }) => {
  await openLayout(page); await page.getByRole('button', { name: 'Shelf 2', exact: true }).click(); await chooseObject(page, 'Toilet Paper Roll'); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const previous = (await snapshot(page))!.data.cabinet;
  await numberField(page, 'Height (Y)').fill('50'); expect((await snapshot(page))!.red).toEqual([]);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
  expect((await snapshot(page, true))!.red).toContain(previous.contents[0].id); await page.getByRole('button', { name: 'Cancel layout', exact: true }).click();
  await numberField(page, 'Height (Y)').fill('190'); expect((await snapshot(page))!.data.cabinet).toEqual(previous);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
  expect((await snapshot(page, true))!.red).toEqual([]); await page.getByRole('button', { name: 'Cancel layout', exact: true }).click();
});

test('cabinet doors swing independently, turn red for an obstacle and leave ordinary placement unchecked', async ({ page, request }) => {
  const raw = fixture(); raw.plan.items.cabinet.cabinet.doors.count = 2;
  Object.assign(raw.plan.items, { obstacle: { name: 'cube', assetKey: 'detail_books', dimensions: { x: .22, y: .5, z: .22 }, position: { x: 1.7, y: .4, z: 2.4 }, pc: { x: 170, y: 240 }, rotationY: 0 } });
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await selectCabinet(page);
  await page.getByLabel('Cabinet door 1 angle', { exact: true }).fill('90');
  expect((await snapshot(page))!.doorCollision).toBe(true); expect((await snapshot(page))!.red).toContain('door_0');
  expect((await snapshot(page))!.data.cabinet.doors.angles).toEqual([90, 0]);
  await page.getByLabel('Cabinet door 2 angle', { exact: true }).fill('10');
  expect((await snapshot(page))!.doorCollision).toBe(true); expect((await snapshot(page))!.red).toContain('door_0');
  await numberField(page, 'X (Horiz.)').fill('3'); expect((await snapshot(page))!.red).toEqual([]);
  await page.getByLabel('Cabinet door 1 angle', { exact: true }).fill('91'); expect((await snapshot(page))!.doorCollision).toBe(false);
  await page.getByLabel('Cabinet door 2 angle', { exact: true }).fill('70'); expect((await snapshot(page))!.data.cabinet.doors.angles).toEqual([91, 70]);
});

test('concealed hinge travel clears a flush enclosure and collision checks follow opening and closing paths', async ({ page, request }) => {
  const raw = fixture();
  Object.assign(raw.plan.items, { enclosure: { name: 'cube', assetKey: 'detail_books', dimensions: { x: .1, y: 1.9, z: .6 }, position: { x: 1.65, y: 0, z: 2.5 }, pc: { x: 165, y: 250 }, rotationY: 0 } });
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await selectCabinet(page);
  const angle = page.getByLabel('Cabinet door 1 angle', { exact: true }), type = page.getByLabel('Cabinet door 1 hinge type', { exact: true });
  await angle.fill('90'); expect((await snapshot(page))!.doorCollision).toBe(true);
  await type.selectOption('half-cranked');
  const travel = page.getByLabel('Cabinet door 1 hinge travel (mm)', { exact: true });
  await expect(travel).toHaveValue('20'); expect((await snapshot(page))!.doorCollision).toBe(false); expect((await snapshot(page))!.red).toEqual([]);
  // Rechecking at the same angle must use the new hardware path.
  await type.selectOption('straight-arm');
  await travel.fill('2'); expect((await snapshot(page))!.doorCollision).toBe(true); expect((await snapshot(page))!.red).toContain('door_0');
  await travel.fill('20'); expect((await snapshot(page))!.doorCollision).toBe(false);
  await angle.fill('0'); expect((await snapshot(page))!.doorCollision).toBe(false);
  await angle.fill('90'); expect((await snapshot(page))!.doorCollision).toBe(false);
  // The final closed pose is clear, but the fixed-pivot closing arc is not.
  await type.selectOption('pivot'); expect((await snapshot(page))!.doorCollision).toBe(true);
  await angle.fill('0'); expect((await snapshot(page))!.doorCollision).toBe(true);
  await type.selectOption('fully-cranked'); expect((await snapshot(page))!.doorCollision).toBe(false);
  await angle.fill('90'); expect((await snapshot(page))!.doorCollision).toBe(false);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click();
  await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
  await expect(page.getByLabel('Cabinet door 1 hinge type', { exact: true })).toHaveValue('fully-cranked');
  await page.getByLabel('Cabinet door 1 hinge travel (mm)', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await snapshot(page))!.data.cabinet.doors.hinges[0]).toEqual({ type: 'fully-cranked', travel: .025 });
  expect((await snapshot(page))!.data.cabinet.doors.angles).toEqual([90, 0]);
});

test('layout previews check door sweeps against extended internal drawers and clear recovered warnings', async ({ page, request }) => {
  const raw = fixture();
  raw.plan.items.cabinet.cabinet.panels = [];
  raw.plan.items.cabinet.cabinet.internalDrawers = [{ id: 'inside', name: 'Internal drawer', bottom: .5, height: .15, depth: .3, setback: .02, extension: 1 }];
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await openLayout(page);
  const angle = page.getByLabel('Cabinet door 1 angle', { exact: true });
  await angle.fill('0');
  expect((await snapshot(page, true))!.doorCollision).toBe(true);
  expect((await snapshot(page, true))!.red).toContain('door_0');
  await expect(page.getByRole('status').filter({ hasText: 'parts need attention' })).toBeVisible();
  await angle.fill('115'); await angle.fill('116');
  expect((await snapshot(page, true))!.doorCollision).toBe(false);
  expect((await snapshot(page, true))!.red).toEqual([]);
  await page.getByRole('button', { name: 'Cancel layout', exact: true }).click();
});

test('offline editor saves stacked rolls and folded clothes and iPad displays the same contents and working doors', async ({ page, context, request }, info) => {
  const template = await (await request.get('/hview_editor_template.html')).text(), html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/cabinet.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url); await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.status).toBe('ready');
  await selectCabinet(page); await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
  await page.getByRole('button', { name: 'Shelf 1', exact: true }).click(); await chooseObject(page, 'Toilet Paper Roll');
  await page.getByLabel('Copies to stack', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Stack copies above', exact: true }).click();
  let stacked = (await snapshot(page, true))!.data.cabinet.contents;
  expect(stacked).toHaveLength(3);
  expect(stacked[1].supportId).toBe(stacked[0].id); expect(stacked[2].supportId).toBe(stacked[1].id);
  await page.getByRole('button', { name: 'Undo layout', exact: true }).click();
  expect((await snapshot(page, true))!.data.cabinet.contents).toHaveLength(1);
  await page.getByRole('button', { name: 'Redo layout', exact: true }).click();
  await page.getByRole('button', { name: 'Shelf 2', exact: true }).click();
  await chooseObject(page, '5 Folded T-shirts');
  const pile = (await snapshot(page, true))!.data.cabinet.contents.at(-1);
  await page.getByRole('button', { name: 'Place another object on top', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('Folded Sweatshirt');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Folded Sweatshirt', exact: true }) }).click();
  expect((await snapshot(page, true))!.data.cabinet.contents.at(-1).supportId).toBe(pile.id);
  expect((await snapshot(page, true))!.red).toEqual([]);
  await page.screenshot({ path: info.outputPath('stacked-clothes-preview.png') });
  await page.getByLabel('Cabinet door 1 hinge type', { exact: true }).selectOption('fully-cranked');
  await page.getByLabel('Cabinet door 1 hinge travel (mm)', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.getByLabel('Cabinet door 1 angle', { exact: true }).fill('105');
  const expected = (await snapshot(page))!.data.cabinet, downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('cabinet-offline.html'); await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  expect(saved.document.elements.find((e: any) => e.data.id === 'cabinet').data.cabinet).toEqual(expected);
  const ipad = await context.browser()!.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const tablet = await ipad.newPage(), savedHtml = readFileSync(path, 'utf8'); await ipad.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: savedHtml }) : route.abort());
  await tablet.goto(url); await expect(tablet.getByRole('button', { name: 'Move', exact: true })).toBeVisible(); await expect.poll(async () => (await snapshot(tablet))?.status).toBe('ready');
  expect((await snapshot(tablet))!.data.cabinet).toEqual(expected); await selectCabinet(tablet);
  await tablet.getByRole('button', { name: 'Close door 1', exact: true }).tap(); expect((await snapshot(tablet))!.data.cabinet.doors.angles[0]).toBe(0);
  await tablet.getByRole('button', { name: 'Open door 1', exact: true }).tap(); expect((await snapshot(tablet))!.data.cabinet.doors.angles[0]).toBe(110); await tablet.screenshot({ path: info.outputPath('ipad-offline-cabinet.png') }); await ipad.close();
});

test('dragging a shelf changes its exact height and carries its attached contents', async ({ page }) => {
  await openLayout(page); await page.getByRole('button', { name: 'Shelf 1', exact: true }).click(); await chooseObject(page, 'Toilet Paper Roll');
  const beforeState = (await snapshot(page, true))!, before = beforeState.data.cabinet;
  await page.getByRole('button', { name: 'Shelf 1', exact: true }).click();
  await page.getByRole('button', { name: 'Front view', exact: true }).click();
  const arrow = await page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, values: any[] = [];
    function scan(f: any) { if (!f) return; const v = f.memoizedProps?.value; if (v?.editor && v?.scene && !values.includes(v)) values.push(v); scan(f.child); scan(f.sibling); } scan(root[key].stateNode.current);
    const runtime = values[1], scene = runtime.scene; scene.getScene().updateMatrixWorld(true); scene.getCamera().updateMatrixWorld(true);
    const gizmo = runtime.interaction.transformControls._gizmo.gizmo.translate;
    const heads = gizmo.children.filter((o: any) => o.name === 'Y' && o.isMesh && o.visible).map((o: any) => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.getCenter(scene.getCamera().position.clone()).applyMatrix4(o.matrixWorld); }).sort((a: any, b: any) => b.y - a.y);
    const p = heads[0].project(scene.getCamera()), r = scene.getDomElement().getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.move(arrow.x, arrow.y); await page.mouse.down(); await page.mouse.move(arrow.x, arrow.y - 70, { steps: 12 });
  const preview = (await snapshot(page, true))!; expect(preview.data.cabinet).toEqual(before); expect(preview.parts[before.contents[0].id][1]).toBeGreaterThan(beforeState.parts[before.contents[0].id][1] + .05);
  await page.mouse.up();
  const after = (await snapshot(page, true))!.data.cabinet;
  expect(after.panels[0].at).toBeGreaterThan(before.panels[0].at + .05); expect(after.contents[0].supportId).toBe(before.contents[0].supportId); expect(after.contents[0].position).toEqual(before.contents[0].position);
});

test('room door rotation checks actual walls and objects without mistaking contact or its doorway for collision', async ({ page, request }) => {
  const raw = fixture(); Object.assign(raw.plan.walls.wall.holes.door, { openAngle: 0, opening: 'r-r' });
  Object.assign(raw.plan.items, { obstruction: { name: 'books', assetKey: 'detail_books', dimensions: { x: .2, y: .6, z: .2 }, position: { x: 1.1, y: .4, z: .4 }, pc: { x: 110, y: 40 }, rotationY: 0 } });
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  const point = await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path), s = runtime.scene, camera = s.getCamera();
    camera.position.set(1, 1.2, 3); s.getControls()!.target.set(1, 1, 0); s.getControls()!.update(); camera.updateMatrixWorld(true); s.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); s.getScene().updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const p = camera.position.clone().set(1, 1, .02).project(camera), r = s.getDomElement().getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; });
  await page.mouse.click(point.x, point.y); const field = page.getByLabel('Door opening angle', { exact: true }); await expect(field).toBeVisible();
  await field.fill('90');
  const collision = () => page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); return runtime.scene.getRenderObject('door')?.userData.doorCollision; });
  expect(await collision()).toBe(true);
  await field.fill('0'); await field.fill('1');
  expect(await collision()).toBe(false);
});

test('an existing cabinet gains an editable interior and collision checking on its first door opening', async ({ page, request }) => {
  const raw = fixture(); Object.assign(raw.plan.items.cabinet, { name: 'ward_single', assetKey: 'ward_single', cabinet: undefined });
  Object.assign(raw.plan.items, { obstacle: { name: 'books', assetKey: 'detail_books', dimensions: { x: .22, y: .5, z: .22 }, position: { x: 1.72, y: .4, z: 2.4 }, pc: { x: 172, y: 240 }, rotationY: 0 } });
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await selectCabinet(page);
  expect((await snapshot(page))!.data.cabinet).toBeUndefined();
  await page.getByRole('button', { name: 'Open door 1', exact: true }).click();
  const state = (await snapshot(page))!; expect(state.data.cabinet.doors.count).toBe(1); expect(state.data.cabinet.doors.angles[0]).toBe(110); expect(state.red).toContain('door_0');
});

test('front sections split vertically with independent tilt-out baskets and a pair of upper doors', async ({ page, request }) => {
  const raw = fixture(); raw.plan.items.cabinet.cabinet.panels = [];
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await openLayout(page);
  await page.getByLabel('Front split height (cm)', { exact: true }).fill('60'); await page.getByRole('button', { name: 'Split front vertically', exact: true }).click();
  await page.getByLabel('Front split height (cm)', { exact: true }).fill('120'); await page.getByRole('button', { name: 'Split front vertically', exact: true }).click();
  const section = page.getByLabel('Cabinet front section', { exact: true });
  await section.selectOption({ index: 0 }); await page.getByLabel('Front section opening', { exact: true }).selectOption('tilt-out');
  await page.getByLabel('Laundry basket depth (cm)', { exact: true }).fill('28');
  await section.selectOption({ index: 1 }); await page.getByLabel('Front section opening', { exact: true }).selectOption('tilt-out');
  await section.selectOption({ index: 2 }); await page.getByLabel('Front section panel count', { exact: true }).selectOption('2');
  const draft = (await snapshot(page, true))!.data.cabinet;
  expect(draft.frontSections.map((s: any) => [s.bottom, s.top, s.opening, s.doors.count])).toEqual([[0, .6, 'tilt-out', 1], [.6, 1.2, 'tilt-out', 1], [1.2, 'top', 'swing', 2]]);
  expect(draft.frontSections[0].basketDepth).toBe(.28);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Open door 1', exact: true }).click();
  expect((await snapshot(page))!.data.cabinet.frontSections[0].doors.angles).toEqual([40, 0]);
  expect((await snapshot(page))!.doorCollision).toBe(false);
  await page.getByRole('button', { name: 'Open door 4', exact: true }).click();
  expect((await snapshot(page))!.data.cabinet.frontSections[2].doors.angles).toEqual([0, 110]);
});

test('laundry baskets carry supported objects, detect swing collisions and work in the offline iPad editor', async ({ page, request, browser }, info) => {
  const raw = fixture(), dims = { x: .6, y: 1.9, z: .35 };
  Object.assign(raw.plan.items.cabinet, { name: 'cabinet_laundry_tiltout', assetKey: 'cabinet_laundry_tiltout', dimensions: dims, cabinet: defaultCabinet({ dimensions: dims, assetKey: 'cabinet_laundry_tiltout' }, 2) });
  Object.assign(raw.plan.items, { obstruction: { name: 'cube', assetKey: 'detail_books', dimensions: { x: .08, y: .08, z: .08 }, position: { x: 2.24, y: .44, z: 2.22 }, pc: { x: 224, y: 222 }, rotationY: 0 } });
  await request.post('/api/save-plan', { data: raw }); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); await selectCabinet(page);
  await page.getByRole('button', { name: 'Open door 1', exact: true }).click();
  expect((await snapshot(page))!.doorCollision).toBe(true); expect((await snapshot(page))!.red).toContain('door_0');
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await snapshot(page, true))?.status).toBe('ready');
  await page.getByRole('button', { name: 'Shelf 3', exact: true }).click(); await chooseObject(page, 'Toilet Paper Roll');
  await page.getByLabel('Supporting shelf', { exact: true }).selectOption('basket_lower_0');
  expect((await snapshot(page, true))!.red).toEqual([]);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const expected = (await snapshot(page))!.data.cabinet;
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('laundry-cabinet.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const url = 'http://127.0.0.1:3100/__offline__/laundry-cabinet.html', html = readFileSync(path, 'utf8');
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  const tablet = await context.newPage(); await tablet.goto(url); await expect.poll(async () => (await snapshot(tablet))?.status).toBe('ready');
  expect((await snapshot(tablet))!.data.cabinet).toEqual(expected); await selectCabinet(tablet);
  await tablet.getByRole('button', { name: 'Close door 1', exact: true }).tap(); await tablet.getByRole('button', { name: 'Open door 2', exact: true }).tap();
  expect((await snapshot(tablet))!.data.cabinet.frontSections[1].doors.angles[0]).toBe(40);
  await tablet.getByRole('button', { name: 'Open door 3', exact: true }).tap(); await tablet.getByRole('button', { name: 'Open door 4', exact: true }).tap();
  await tablet.screenshot({ path: info.outputPath('ipad-tilt-out-laundry.png') }); await context.close();
});

test('catalogue adds complete flat and wider spin-mop sets to a cabinet fit check', async ({ page }) => {
  await openLayout(page); await chooseObject(page, 'Flat Mop and Wringer Bucket Set');
  await chooseObject(page, 'Spin Mop and Bucket Set');
  const contents = (await snapshot(page, true))!.data.cabinet.contents;
  expect(contents.map((o: any) => o.assetKey)).toEqual(['fit_mop_set', 'fit_spin_mop_set']);
  expect(contents[1].dimensions.x).toBeGreaterThan(contents[0].dimensions.x); expect(contents[0].dimensions.y).toBe(1.4);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
});

test('drawer fronts and internal drawers carry contents through offline export and touch reload', async ({ page, context, request }, info) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(fixture()))));
  const url = 'http://127.0.0.1:3100/__offline__/drawers.html';
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url); await expect.poll(async () => (await snapshot(page))?.status).toBe('ready');
  await openLayout(page);
  await page.getByLabel('Front split height (cm)', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Split front vertically', exact: true }).click();
  await page.getByLabel('Cabinet front section', { exact: true }).selectOption('front');
  await page.getByLabel('Front section opening', { exact: true }).selectOption('drawer');
  await page.getByLabel('Drawer box height (cm)', { exact: true }).fill('18');
  await page.getByLabel('Drawer box depth (cm)', { exact: true }).fill('32');
  await page.getByRole('button', { name: 'Place object in drawer 1', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('Modular Drawer Cutlery Organizer');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Modular Drawer Cutlery Organizer', exact: true }) }).click();
  await numberField(page, 'Width (X)').fill('28'); await numberField(page, 'Depth (Z)').fill('26');
  let draft = (await snapshot(page, true))!, content = draft.data.cabinet.contents[0];
  expect(content.supportId).toBe('drawer_front_0');
  await page.getByLabel('Cabinet drawer 1 extension', { exact: true }).fill('0');
  const closed = (await snapshot(page, true))!.parts[content.id];
  await page.getByLabel('Cabinet drawer 1 extension', { exact: true }).fill('100');
  // Local position stays relative to the moving drawer; world position changes.
  const moving = await page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, runtimes: any[] = [];
    function scan(f: any) { if (!f) return; const v = f.memoizedProps?.value; if (v?.editor && v?.scene && !runtimes.includes(v)) runtimes.push(v); scan(f.child); scan(f.sibling); } scan(root[key].stateNode.current);
    const runtime = runtimes[1], id = runtime.editor.getDocument().requireFurniture('cabinet').cabinet.contents[0].id;
    return runtime.scene.getCabinetPart('cabinet', id).parent.position.z;
  });
  expect(moving).toBeGreaterThan(.4); expect((await snapshot(page, true))!.parts[content.id]).toEqual(closed);
  await page.getByRole('button', { name: 'Add internal drawer', exact: true }).click();
  await page.getByLabel('Internal drawer 1 bottom (cm)', { exact: true }).fill('90');
  await page.getByLabel('Internal drawer 1 depth (cm)', { exact: true }).fill('32');
  await page.getByRole('button', { name: 'Place object in Internal drawer 1', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('Folded T-shirt');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Folded T-shirt', exact: true }) }).click();
  await numberField(page, 'Depth (Z)').fill('27');
  draft = (await snapshot(page, true))!;
  expect(draft.data.cabinet.contents[1].supportId).toBe(`drawer_${draft.data.cabinet.internalDrawers[0].id}`);
  expect(draft.red).toEqual([]);
  await page.screenshot({ path: info.outputPath('drawers-preview.png') });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Cabinet drawer 1 extension', { exact: true }).fill('85');
  await page.getByLabel('Internal drawer 1 extension', { exact: true }).fill('75');
  const internalId = `drawer_${(await snapshot(page))!.data.cabinet.internalDrawers[0].id}`;
  expect((await snapshot(page))!.red).toContain(internalId);
  await page.getByLabel('Internal drawer 1 extension', { exact: true }).fill('0');
  await page.getByLabel('Cabinet door 2 angle', { exact: true }).fill('115');
  await page.getByLabel('Internal drawer 1 extension', { exact: true }).fill('75');
  expect((await snapshot(page))!.red).not.toContain(internalId);
  const expected = (await snapshot(page))!.data.cabinet;
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('drawers-offline.html'); await (await downloading).saveAs(path);
  const saved = readFileSync(path, 'utf8'), decoded = JSON.parse(standaloneBlockText(saved, 'plan-data'));
  expect(decoded.document.elements.find((e: any) => e.data.id === 'cabinet').data.cabinet).toEqual(expected);
  const touch = await context.browser()!.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  await touch.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: saved }) : route.abort());
  const tablet = await touch.newPage(); await tablet.goto(url); await expect.poll(async () => (await snapshot(tablet))?.status).toBe('ready');
  expect((await snapshot(tablet))!.data.cabinet).toEqual(expected);
  await touch.close();
});
