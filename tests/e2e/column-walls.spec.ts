import { expect, test } from '@playwright/test';
import { rawPlan } from '../unit/fixtures';

test('a column selects its own inspector with four paint faces and recess controls', async ({ page, request }) => {
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
  } finally {
    expect((await request.post('/api/save-plan', { data: JSON.parse(original) })).ok()).toBe(true);
  }
});
