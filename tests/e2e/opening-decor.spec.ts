import { expect,test,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { packStandaloneHtml,setScriptContent,escapeScriptJson,standaloneBlockText } from '../../src/services/export/StandaloneHtml';
import { workflowPlan } from './workflow-helpers';

let original: string;
test.beforeEach(async ({ page,request }) => {
  original = await (await request.get('/sample.plan')).text();
  const source = workflowPlan();
  const plan = { plan: { ...source.plan, items: {} } };
  await request.post('/api/save-plan', { data: plan });
  await page.route(/^https:\/\/fonts\./, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    return runtime.scene.getStatus().state === 'ready';
  });
  await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    runtime.scene.getCamera().position.set(2, 1.7, 5);
    runtime.scene.getControls()!.target.set(2, 1.4, 0);
    runtime.scene.getControls()!.update();
  });
});
test.afterEach(async ({ page,request }) => {
  await page.close();
  await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } });
});

async function clickMesh(page: Page, id: string, name: string) {
  const point = await page.evaluate(async ({ id,name }) => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const mesh = runtime.scene.getRenderObject(id)!.getObjectByName(name)!;
    const point = mesh.getWorldPosition(runtime.scene.getCamera().position.clone()).project(runtime.scene.getCamera());
    const rect = runtime.scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  }, { id,name });
  await page.mouse.click(point.x, point.y);
}

async function state(page: Page) {
  return page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const door = runtime.editor.getDocument().get('door') as import('../../src/domain/elements/Opening').Door;
    const window = runtime.editor.getDocument().get('window') as import('../../src/domain/elements/Opening').WindowOpening;
    const curtain = runtime.scene.getRenderObject('window')?.getObjectByName('curtains_window');
    const frame = runtime.scene.getRenderObject('door')?.getObjectByName('doorFrame_left_door') as import('three').Mesh<import('three').BufferGeometry,import('three').MeshStandardMaterial>;
    return { frame: door.frameColor, frameMesh: frame.material.color.getHexString(), leaf: door.finish, curtainState: window.curtainState, curtainVisible: curtain?.visible ?? null };
  });
}

test('door frame color is independent of leaf finish and survives undo and save/reload', async ({ page }) => {
  await clickMesh(page, 'door', 'doorFrame_left_door');
  await expect(page.getByText('ID: door', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'White door frame', exact: true }).click();
  expect(await state(page)).toMatchObject({ frame: '#f8fafc', frameMesh: 'f8fafc' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).frameMesh).toBe('333338');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  expect(await state(page)).toMatchObject({ frame: '#f8fafc', frameMesh: 'f8fafc', leaf: { color: '#f3f1ea' } });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect(await state(page)).toMatchObject({ frame: '#f8fafc', frameMesh: 'f8fafc', leaf: { color: '#f3f1ea' } });
});

test('curtains can be selected, hidden, deleted, restored, and stay deleted after reload', async ({ page }, testInfo) => {
  expect(await state(page)).toMatchObject({ curtainState: 'visible', curtainVisible: true });
  await clickMesh(page, 'window', 'curtain_left_window');
  await expect(page.getByRole('heading', { name: 'Ceiling-mounted curtains', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ceiling-curtains.png') });
  await page.getByRole('button', { name: 'Hide curtains', exact: true }).click();
  expect(await state(page)).toMatchObject({ curtainState: 'hidden', curtainVisible: false });
  await page.getByRole('button', { name: 'Show curtains', exact: true }).click();
  expect(await state(page)).toMatchObject({ curtainState: 'visible', curtainVisible: true });
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click();
  expect(await state(page)).toMatchObject({ curtainState: 'removed', curtainVisible: null });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state(page)).toMatchObject({ curtainState: 'visible', curtainVisible: true });
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click();
  await page.getByRole('button', { name: 'Add curtains', exact: true }).click();
  expect(await state(page)).toMatchObject({ curtainState: 'visible', curtainVisible: true });
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click();
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect(await state(page)).toMatchObject({ curtainState: 'removed', curtainVisible: null });
});

test('offline editor retains frame colors and curtain settings in downloaded HTML', async ({ page,context,request }, testInfo) => {
  const source = workflowPlan();
  const plan = {
    plan: { ...source.plan, items: {}, walls: { wall: {
      ...source.plan.walls.wall, holes: {
        door: { ...source.plan.walls.wall.holes.door, frameColor: '#225588' },
        window: { ...source.plan.walls.wall.holes.window, curtainState: 'hidden' },
      },
    } } },
  };
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(plan))));
  const url = 'http://127.0.0.1:3100/__offline__/opening-decor.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const root = document.getElementById('root') as any;
    const key = Object.keys(root).find(key => key.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value;
    runtime.editor.selection.set({ kind: 'opening', id: 'window' });
  });
  await expect(page.getByRole('button', { name: 'Show curtains', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('opening-decor.html');
  await (await downloading).saveAs(path);
  const saved = JSON.parse(standaloneBlockText(readFileSync(path, 'utf8'), 'plan-data'));
  const wall = saved.document.elements.find((element: any) => element.kind === 'wall').data;
  expect(wall.openings.find((opening: any) => opening.id === 'door').frameColor).toBe('#225588');
  expect(wall.openings.find((opening: any) => opening.id === 'window').curtainState).toBe('removed');
});
