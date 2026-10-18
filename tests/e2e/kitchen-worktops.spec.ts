import { expect, test, type Page } from '@playwright/test';
import { workflowPlan, numberField, offlineDocument } from './workflow-helpers';

let original: string;
const green = { type: 'paint', color: '#94a395', roughness: .85 }, stone = { type: 'tile', variant: 'canakkale_diadem_bej_59x59', color: '#d3c7b8', roughness: .76, groutWidth: 0 };
async function state(page: Page, draft = false) {
  return page.evaluate(draft => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!, contexts: any[] = [];
    function scan(fiber: any) { if (!fiber) return; const value = fiber.memoizedProps?.value; if (value?.editor && value?.scene && !contexts.includes(value)) contexts.push(value); scan(fiber.child); scan(fiber.sibling); }
    scan(root[key].stateNode.current); const runtime = contexts[draft ? 1 : 0]; if (!runtime) return null;
    const item = runtime.editor.getDocument().requireFurniture('cabinet'), mesh = runtime.scene.getRenderObject(item.id), colours: Record<string, string[]> = {}, tops: any[] = [];
    mesh?.traverse((o: any) => { if (!o.isMesh) return; const section = o.userData.section; if (section) (colours[section] ??= []).push(o.material.color.getHexString()); if (section === 'Countertop') tops.push({ size: o.geometry.parameters, elevation: o.position.y, visible: o.visible }); });
    return { data: item.toData(), colours, tops, status: runtime.scene.getStatus().state, furniture: runtime.editor.getDocument().furniture.map((o: any) => o.toData()), selected: runtime.editor.selection.getSnapshot() };
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
