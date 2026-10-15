import { expect, test } from '@playwright/test';
import { legacyData } from '../support/editor';
import { workflowPlan } from './workflow-helpers';

test.use({ viewport: { width: 2300, height: 1000 } });
let original: string;

function roomPlan(id = 'room') {
  const raw = workflowPlan();
  return {
    plan: {
      ...raw.plan,
      items: {},
      walls: { wall: { ...raw.plan.walls.wall, holes: {} } },
      rooms2: { [id]: raw.plan.rooms2.room },
    },
  };
}

test.beforeEach(async ({ request }) => {
  original = await (await request.get('/sample.plan')).text();
  expect((await request.post('/api/save-plan', { data: roomPlan() })).ok()).toBe(true);
});

test.afterEach(async ({ page, request }) => {
  await page.close();
  expect((await request.post('/api/save-plan', {
    data: Buffer.from(original), headers: { 'Content-Type': 'application/json' },
  })).ok()).toBe(true);
});

test('opening a new plan removes isolation filters for rooms that no longer exist', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('0 Objects', { exact: true })).toBeVisible();
  await page.getByTitle('Select rooms to isolate — multi-select supported', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Living room/ }).check();
  await expect(page.getByTitle('Show all rooms', { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'another.plan', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(roomPlan('new-room'))),
  });
  await expect(page.getByTitle('Show all rooms', { exact: true })).toBeHidden();
  const state = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    return {
      isolated: runtime.scene.getSettings().isolatedRoomIds,
      floorVisible: runtime.scene.getRenderObject('new-room')?.visible,
    };
  });
  expect(state).toEqual({ isolated: [], floorVisible: true });
});

test('room-name drafts reject blanks, cancel, undo as one edit, and survive save/reload', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('0 Objects', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const point = scene.getCamera().position.clone().set(2, 0.02, 2).project(scene.getCamera());
    const bounds = scene.getDomElement().getBoundingClientRect();
    return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  const name = page.getByPlaceholder('e.g. Master Bedroom');
  await expect(name).toHaveValue('Living room');
  await name.fill('');
  await name.press('Tab');
  await expect(name).toHaveValue('Living room');
  await name.fill('   ');
  await name.press('Enter');
  await expect(name).toHaveValue('Living room');
  await name.fill('Cancelled draft');
  await name.press('Escape');
  await expect(name).toHaveValue('Living room');
  await name.fill('Reading room');
  await name.press('Enter');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(name).toHaveValue('Living room');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(name).toHaveValue('Reading room');
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  expect(legacyData(await (await request.get('/sample.plan')).text()).plan.rooms2.room.title).toBe('Reading room');
  await page.reload();
  await expect(page.getByText('0 Objects', { exact: true })).toBeVisible();
  expect(await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    return runtime.editor.getDocument().requireRoom('room').name;
  })).toBe('Reading room');
  expect(errors).toEqual([]);
});
