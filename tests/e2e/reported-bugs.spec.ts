import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { legacyData } from '../support/editor';
import { workflowPlan } from './workflow-helpers';

test.use({ viewport: { width: 2300, height: 900 } });
let original: string;
test.beforeEach(async ({ request }) => { original = await (await request.get('/sample.plan')).text(); });
test.afterEach(async ({ page, request }) => {
  await page.close();
  expect((await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } })).ok()).toBe(true);
});

async function selectWall(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const p = scene.getCamera().position.clone().set(2, 3, 0).project(scene.getCamera());
    const rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.getByText('ID: wall', { exact: true })).toBeVisible();
  await page.getByTitle('Side A', { exact: true }).click();
}

test('the living-room door-wall junction has no selectable gap beside the door', async ({ page, request }) => {
  const raw = legacyData(readFileSync('public/sample.plan', 'utf8'));
  const plan = raw.plan || raw;
  plan.walls = Object.fromEntries(['_g9657', '_rxf4v', '_vfhig', '_w5f7a_a'].map(id => [id, plan.walls[id]]));
  plan.rooms2 = {}; plan.items = {}; plan.columns = [];
  expect((await request.post('/api/save-plan', { data: raw })).ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByText('4 Walls', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const wall = runtime.editor.getDocument().requireWall('_w5f7a_a');
    // Click the actual strip previously cut away by the junction resolver.
    const p = scene.getCamera().position.clone().set(wall.p1.x, wall.height, wall.p1.y + 0.015).project(scene.getCamera());
    const rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.getByText('ID: _w5f7a_a', { exact: true })).toBeVisible();
});

test('paint highlight changes while the wall remains focused, not only after reselection', async ({ page, request }) => {
  const plan = workflowPlan();
  Object.assign(plan.plan.walls.wall, { finishSideA: { type: 'paint', color: '#fbfbf9', roughness: 0.85 } });
  expect((await request.post('/api/save-plan', { data: plan })).ok()).toBe(true);
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await selectWall(page);
  const oldSwatch = page.getByTitle('Chantilly Lace (#fbfbf9)', { exact: true });
  const newSwatch = page.getByTitle('White Dove (#f3f1ea)', { exact: true });
  await expect(oldSwatch).toHaveClass(/bg-sky-500\/10/);
  await newSwatch.click();
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect.poll(async () => (legacyData(await (await request.get('/sample.plan')).text())).plan.walls.wall.finishSideA.color).toBe('#f3f1ea');
  const immediateClass = await newSwatch.getAttribute('class');
  const previousClass = await oldSwatch.getAttribute('class');
  // Confirm the reported workaround before asserting the immediate result.
  await page.getByTitle('Close Inspector', { exact: true }).click(); await selectWall(page);
  await expect(newSwatch).toHaveClass(/bg-sky-500\/10/);
  await expect(oldSwatch).not.toHaveClass(/bg-sky-500\/10/);
  expect(immediateClass, 'the new paint must be highlighted before unfocusing').toMatch(/bg-sky-500\/10/);
  expect(previousClass, 'the previous paint must be deselected before unfocusing').not.toMatch(/bg-sky-500\/10/);
});

test('isolating Bathroom hides the hallway door while retaining its own entrance', async ({ page, request }) => {
  // Preserve the real positions/IDs from the working plan, trimming unrelated
  // rooms and furniture to make the same geometry bug fast to reproduce.
  const raw = legacyData(readFileSync('public/sample.plan', 'utf8'));
  const plan = raw.plan || raw;
  plan.walls = Object.fromEntries(['_tmb2o', '_ojjeh'].map(id => [id, plan.walls[id]]));
  plan.rooms2 = Object.fromEntries([['_rscdq', 'Bathroom'], ['_4wyay', 'Hallway'], ['_3h613', 'Bedroom']].map(([id, title]) => [id, { ...plan.rooms2[id], title }]));
  plan.items = {}; plan.columns = [];
  expect((await request.post('/api/save-plan', { data: raw })).ok()).toBe(true);
  const baseline = await (await request.get('/sample.plan')).text();
  await page.goto('/'); await expect(page.getByText('0 Objects')).toBeVisible();
  await page.getByTitle('Select rooms to isolate — multi-select supported', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Bathroom/ }).check();
  const state = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const group = scene.getScene().getObjectByName('openingsGroup');
    return { isolated: scene.getSettings().isolatedRoomIds, visible: group.children.filter((o: any) => group.visible && o.visible).map((o: any) => o.userData.id).sort() };
  });
  expect(state.isolated).toEqual(['_rscdq']);
  expect(await (await request.get('/sample.plan')).text()).toBe(baseline);
  expect(state.visible).toContain('_buz1m');
  expect(state.visible, 'hallway-to-bedroom door _87omj is outside the bathroom').not.toContain('_87omj');
});
