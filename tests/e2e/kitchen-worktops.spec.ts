import { expect, test, type Page } from '@playwright/test';
import { workflowPlan, numberField, offlineDocument } from './workflow-helpers';

let original: string;
const green = { type: 'paint', color: '#94a395', roughness: .85 }, stone = { type: 'tile', variant: 'canakkale_diadem_bej_59x59', color: '#d3c7b8', roughness: .76, groutWidth: 0 };
async function state(page: Page, draft = false) {
  return page.evaluate(draft => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, contexts: any[] = [];
    function scan(fiber: any) { if (!fiber) return; const value = fiber.memoizedProps?.value; if (value?.editor && value?.scene && !contexts.includes(value)) contexts.push(value); scan(fiber.child); scan(fiber.sibling); }
    scan(root[key].stateNode.current); const runtime = contexts[draft ? 1 : 0]; if (!runtime) return null;
    const item = runtime.editor.getDocument().requireFurniture('cabinet'), mesh = runtime.scene.getRenderObject(item.id), colours: Record<string, string[]> = {}, tops: any[] = [], plinths: any[] = [];
    mesh?.traverse((o: any) => { if (!o.isMesh) return; const section = o.userData.section; if (section) (colours[section] ??= []).push(o.material.color.getHexString()); if (section === 'Plinth') plinths.push({ size: o.geometry.parameters, position: o.parent.position.toArray() }); if (section === 'Countertop') tops.push({ size: o.geometry.parameters, elevation: o.position.y, visible: o.visible }); });
    return { data: item.toData(), colours, tops, plinths, status: runtime.scene.getStatus().state, furniture: runtime.editor.getDocument().furniture.map((o: any) => o.toData()), selected: runtime.editor.selection.getSnapshot() };
  }, draft);
}
async function ready(page: Page) { await expect(page.getByRole('button', { name: 'Move', exact: true }).first()).toBeVisible(); await expect.poll(async () => (await state(page))?.status).toBe('ready'); }
async function selectCabinet(page: Page) {
  const point = await page.evaluate(async () => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, scene = root[key].stateNode.current.memoizedState.element.props.value.scene, camera = scene.getCamera();
    camera.position.set(2, 1, 5); scene.getControls().target.set(2, .45, 2); scene.getControls().update(); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    scene.getScene().updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const p = camera.position.clone().set(1.85, .45, 2.3).project(camera), r = scene.getDomElement().getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  });
  await page.mouse.click(point.x, point.y); await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toBeVisible();
}
function expectRetained(value: Awaited<ReturnType<typeof state>>) {
  expect(value!.tops).toHaveLength(1); expect(value!.colours.Countertop).toEqual(['d3c7b8']);
  for (const section of ['Frame', 'Back Panel', 'Shelves', 'Door 1', 'Door 2']) if (value!.colours[section]) expect(value!.colours[section].every(c => c === '94a395')).toBe(true);
  expect(value!.data.sectionFinishes).toMatchObject({ cabinet: green, countertop: stone });
}
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: { plan: { ...workflowPlan().plan, items: { cabinet: { name: 'kitchen_box_door_double', assetKey: 'kitchen_box_door_double', dimensions: { x: .8, y: .85, z: .58 }, position: { x: 2, y: 0, z: 2 }, pc: { x: 200, y: 200 }, rotationY: 0, sectionFinishes: { Cabinet: green, Countertop: stone } } } } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort()); await page.goto('/'); await ready(page);
});
test.afterEach(async ({ page, request }) => { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); });

test('first door opening and layout edits retain kitchen finishes and worktop geometry through save/reload', async ({ page }, info) => {
  const initial = await state(page); expect(initial!.colours.Cabinet).toEqual(['94a395']);
  await selectCabinet(page); await page.getByLabel('Cabinet door 1 angle', { exact: true }).fill('65');
  expectRetained(await state(page)); expect((await state(page))!.tops[0]).toEqual(initial!.tops[0]);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await state(page, true))?.status).toBe('ready'); expectRetained(await state(page, true));
  await page.getByRole('button', { name: 'Add shelf', exact: true }).click(); const layout = (await state(page, true))!.data.cabinet;
  await page.getByRole('button', { name: 'Done', exact: true }).click(); expectRetained(await state(page));
  expect((await state(page))!.data.cabinet.panels).toEqual(layout.panels); expect((await state(page))!.data.cabinet.doors.angles[0]).toBe(65);
  await page.getByLabel('Cabinet door 2 angle', { exact: true }).fill('30'); expectRetained(await state(page));
  await page.screenshot({ path: info.outputPath('kitchen-colours-and-counter.png') });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden(); await page.reload(); await ready(page); expectRetained(await state(page));
  expect((await state(page))!.data.cabinet.panels).toEqual(layout.panels);
});

test('independent worktop can be placed, resized and finished while offline iPad cabinet edits retain appearance', async ({ page, browser }, info) => {
  await selectCabinet(page); await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('counter');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Kitchen Worktop', exact: true }) }).click();
  const added = (await state(page))!.furniture.find((f: any) => f.assetKey === 'kitchen_worktop')!; expect(added.position.y).toBe(.85); expect(added.cabinet).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toHaveCount(0);
  await numberField(page, 'Width (X)').fill('280'); await numberField(page, 'Height (Y)').fill('3'); await numberField(page, 'Depth (Z)').fill('65');
  await page.getByRole('button', { name: 'Tile & Marble', exact: true }).click(); await page.getByRole('button', { name: /59x59 Diadem Beige Matte Porcelain/ }).click();
  const slab = (await state(page))!.furniture.find((f: any) => f.id === added.id)!; expect(slab.dimensions).toEqual({ x: 2.8, y: .03, z: .65 }); expect(slab.finish?.variant).toBe(stone.variant);
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click(); const path = info.outputPath('kitchen-worktops.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), url = await offlineDocument(context, path, 'kitchen-worktops'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); expect((await state(tablet))!.furniture.find((f: any) => f.id === added.id)).toMatchObject({ dimensions: slab.dimensions, finish: slab.finish });
  await selectCabinet(tablet); await tablet.getByLabel('Cabinet door 1 angle', { exact: true }).fill('45'); expectRetained(await state(tablet));
  await tablet.getByRole('button', { name: 'Edit layout', exact: true }).click(); await expect.poll(async () => (await state(tablet, true))?.status).toBe('ready'); expectRetained(await state(tablet, true));
  await tablet.getByRole('button', { name: 'Cancel layout', exact: true }).click(); expectRetained(await state(tablet)); await tablet.screenshot({ path: info.outputPath('ipad-kitchen-worktops.png') }); await context.close();
});


test('optional plinth keeps worktop height and persists through layout editing and offline touch reload', async ({ page, browser }, info) => {
  const initial = await state(page); await selectCabinet(page);
  await expect(page.getByLabel('Cabinet plinth', { exact: true })).not.toBeChecked();
  await page.getByLabel('Cabinet plinth', { exact: true }).check();
  await expect(page.getByLabel('Plinth height (cm)', { exact: true })).toHaveValue('10');
  await expect(page.getByLabel('Plinth setback (cm)', { exact: true })).toHaveValue('5');
  let current = (await state(page))!;
  expect(current.data.cabinet.plinth).toEqual({ height: .1, setback: .05 });
  expect(current.data.dimensions).toEqual(initial!.data.dimensions); expect(current.tops).toEqual(initial!.tops);
  expect(current.plinths).toHaveLength(3); expect(current.colours.Plinth).toEqual(['94a395', '94a395', '94a395']);
  await page.getByLabel('Plinth height (cm)', { exact: true }).fill('12');
  await page.getByLabel('Plinth setback (cm)', { exact: true }).fill('7');
  current = (await state(page))!; expect(current.plinths.every((p: any) => p.size.height === .12)).toBe(true);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click();
  await expect.poll(async () => (await state(page, true))?.status).toBe('ready');
  await expect(page.getByLabel('Plinth height (cm)', { exact: true })).toHaveValue('12');
  await page.getByLabel('Plinth height (cm)', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Undo layout', exact: true }).click();
  await expect(page.getByLabel('Plinth height (cm)', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Cabinet door 1 angle', { exact: true }).fill('70');
  expectRetained(await state(page));
  await page.screenshot({ path: info.outputPath('kitchen-plinth.png') });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('kitchen-plinth.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const url = await offlineDocument(context, path, 'kitchen-plinth'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet); current = (await state(tablet))!;
  expect(current.data.cabinet.plinth).toEqual({ height: .12, setback: .07 });
  expect(current.plinths).toHaveLength(3); expect(current.tops).toEqual(initial!.tops);
  await selectCabinet(tablet); await tablet.getByLabel('Cabinet plinth', { exact: true }).uncheck();
  expect((await state(tablet))!.plinths).toHaveLength(0); expect((await state(tablet))!.tops).toEqual(initial!.tops);
  await context.close();
});


test('placed countertops stay visible and selectable in foreground clip mode with photo laminate offline', async ({ page, browser }, info) => {
  await selectCabinet(page); await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('countertop');
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Kitchen Worktop', exact: true }) }).click();
  const added = (await state(page))!.furniture.find((f: any) => f.assetKey === 'kitchen_worktop')!;
  const focus = async (target: Page) => target.evaluate(async id => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value, scene = runtime.scene, item = runtime.editor.getDocument().requireFurniture(id), p = item.position, camera = scene.getCamera();
    camera.position.set(p.x, p.y + 1.6, p.z + 4); scene.getControls().target.set(p.x, p.y, p.z - 1.5); scene.getControls().update(); camera.updateMatrixWorld(true); scene.invalidate();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); scene.getScene().updateMatrixWorld(true);
    const point = camera.position.clone().set(p.x, p.y + item.dimensions.y, p.z).project(camera), rect = scene.getDomElement().getBoundingClientRect();
    const mesh = scene.getRenderObject(id).getObjectByName(`worktop_${id}`), shader = { uniforms: {} as any, vertexShader: '#include <common>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <dithering_fragment>\n#include <map_fragment>' };
    mesh.material.onBeforeCompile(shader, {});
    const hit = scene.pick({ x: point.x, y: point.y });
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2, picked: hit?.target.id, foreground: scene.isPointForegroundOccluded(camera.position.clone().set(p.x, p.y + item.dimensions.y, p.z)), mode: shader.uniforms.uForegroundMode.value, imageReady: !!mesh.material.map?.image?.width, rotation: shader.uniforms.uTileRot?.value.toArray() };
  }, added.id);
  await page.getByRole('button', { name: /Foreground: Fade/ }).click();
  const bare = await focus(page); expect(bare.foreground).toBe(true); expect(bare.picked).toBe(added.id); expect(bare.mode).toBe(0);
  await page.mouse.click(bare.x, bare.y); expect((await state(page))!.selected.id).toBe(added.id);
  await page.getByRole('button', { name: 'Wood & Parquet', exact: true }).click();
  await page.getByRole('button', { name: /Light Beige Wood-Effect Laminate/ }).click();
  await expect.poll(async () => (await focus(page)).imageReady).toBe(true);
  const painted = await focus(page); expect(painted.picked).toBe(added.id); expect(painted.mode).toBe(0);
  expect((await state(page))!.furniture.find((f: any) => f.id === added.id).sectionFinishes.countertop).toMatchObject({ type: 'wood', variant: 'light_beige_laminate', color: '#ffffff' });
  expect(painted.rotation).toEqual([1, 0]);
  await page.getByRole('button', { name: 'Vertical grain (90°)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vertical grain (90°)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await focus(page)).rotation[0]).toBeCloseTo(0); expect((await focus(page)).rotation[1]).toBeCloseTo(1);
  await page.getByRole('button', { name: /Natural Scandinavian Oak/ }).click();
  await page.getByRole('button', { name: /Light Beige Wood-Effect Laminate/ }).click();
  expect((await state(page))!.furniture.find((f: any) => f.id === added.id).sectionFinishes.countertop.rotation).toBe(90);
  await page.screenshot({ path: info.outputPath('countertop-laminate-visible.png') });
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = info.outputPath('countertop-laminate.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true });
  const url = await offlineDocument(context, path, 'countertop-laminate'), tablet = await context.newPage();
  await tablet.goto(url); await ready(tablet);
  await tablet.getByRole('button', { name: /Foreground: Fade/ }).tap();
  const restored = await focus(tablet); expect(restored.picked).toBe(added.id); expect(restored.mode).toBe(0);
  expect(restored.rotation[0]).toBeCloseTo(0); expect(restored.rotation[1]).toBeCloseTo(1);
  expect((await state(tablet))!.furniture.find((f: any) => f.id === added.id).sectionFinishes.countertop.rotation).toBe(90);
  await expect.poll(async () => (await focus(tablet)).imageReady).toBe(true);
  await tablet.touchscreen.tap(restored.x, restored.y); expect((await state(tablet))!.selected.id).toBe(added.id);
  await tablet.getByRole('button', { name: 'Wood & Parquet', exact: true }).tap();
  await expect(tablet.getByRole('button', { name: 'Vertical grain (90°)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tablet.getByRole('button', { name: 'Horizontal grain (0°)', exact: true }).tap();
  expect((await focus(tablet)).rotation).toEqual([1, 0]);
  await tablet.screenshot({ path: info.outputPath('ipad-countertop-laminate.png') });
  await context.close();
});
