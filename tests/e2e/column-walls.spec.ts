import { expect, test } from '@playwright/test';
import { rawPlan } from '../unit/fixtures';

test('column inspection creates one hosted recess, validates it, undoes it, and saves it', async ({ page, request }) => {
  const original = await (await request.get('/sample.plan')).text();
  try {
    const raw: any = rawPlan();
    raw.plan.walls = {}; raw.plan.items = {};
    raw.plan.columns = [{
      id: 'column', type: 'column', width: 1.2, depth: 0.6, height: 3,
      worldPos: { x: 2, y: 0, z: 1.5 }, rotationY: 0
    }];
    expect((await request.post('/api/save-plan', { data: raw })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByText('0 Walls · 1 Columns', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /2D Plan/ }).click();
    const point = await page.evaluate(async () => {
      const runtimePath = '/src/main.tsx';
      const { runtime } = await import(runtimePath);
      const service = runtime.scene;
      const wall = service.getRenderObject('column');
      const p = service.getCamera().position.clone().set(2, 3, 1.5).project(service.getCamera());
      if (!wall) throw new Error('Column mesh missing');
      const rect = service.getDomElement().getBoundingClientRect();
      return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.getByText('ID: column', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Column/ })).toBeVisible();
    for (const name of ['front', 'back', 'left', 'right']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Add Recess', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add Recess', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create Recess', exact: true })).toBeVisible();
    const width = page.getByText('Width (cm)', { exact: true }).locator('..').locator('input');
    await width.fill('200');
    await page.getByRole('button', { name: 'Create Recess', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('fit within its host');
    await expect(page.getByText('0 Objects', { exact: true })).toBeVisible();
    await width.fill('80');
    await page.getByRole('button', { name: 'Create Recess', exact: true }).click();
    await expect(page.getByText('1 Objects', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
    const recessState = () => page.evaluate(async () => {
      const runtimePath = '/src/main.tsx';
      const { runtime } = await import(runtimePath);
      const document = runtime.editor.getDocument();
      const recess = document.recesses[0];
      return recess ? { kind: recess.kind, hostId: recess.hostId, rawHost: recess.rawItem?.wallId, cut: recess.cutFor(document.requireRecessHost(recess.hostId)) } : null;
    });
    const state = await recessState();
    expect(state).toMatchObject({ kind: 'furniture.recess', hostId: 'column' });
    expect(state!.rawHost).toBeUndefined();
    expect(state!.cut).toBeDefined();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await recessState()).toBeNull();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect(await recessState()).toEqual(state);
    await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
    const saved = await (await request.get('/sample.plan')).json();
    expect(saved.document.elements.filter((entry: { kind: string }) => entry.kind === 'furniture.recess')).toHaveLength(1);
    await page.reload();
    await expect(page.getByText('1 Objects', { exact: true })).toBeVisible();
    expect(await recessState()).toEqual(state);
  } finally {
    expect((await request.post('/api/save-plan', { data: JSON.parse(original) })).ok()).toBe(true);
  }
});
