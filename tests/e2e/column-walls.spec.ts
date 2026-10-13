import { test, expect } from '@playwright/test';
import { rawPlan } from '../unit/fixtures';

test('a column selects the ordinary wall inspector with four paint faces and recess controls', async ({ page, request }) => {
  const original = await (await request.get('/sample.plan')).text();
  try {
    const raw: any = rawPlan();
    raw.plan.walls = {}; raw.plan.items = {};
    raw.plan.columns = [{ id: 'column', type: 'column', width: 1.2, depth: 0.6, height: 3,
      worldPos: { x: 2, y: 0, z: 1.5 }, rotationY: 0 }];
    expect((await request.post('/api/save-plan', { data: raw })).ok()).toBe(true);
    await page.goto('/');
    await expect(page.getByText('1 Walls', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /2D Plan/ }).click();
    const point = await page.evaluate(async () => {
      const containerPath = '/src/core/di/container.ts', tokensPath = '/src/core/di/tokens.ts';
      const { defaultContainer } = await import(containerPath);
      const { TOKENS } = await import(tokensPath);
      const service = defaultContainer.resolve(TOKENS.SceneService);
      const wall = service.getScene().getObjectByName('wall_column');
      const mesh = wall.children.find((c: any) => c.isMesh);
      const p = mesh.position.clone().project(service.getCamera());
      const rect = service.getDomElement().getBoundingClientRect();
      return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.getByText('ID: column', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Wall 1\.20m \(60cm thick\)/ })).toBeVisible();
    for (const name of [/^Side A/, /^Side B/, /^Start End Cap/, /^End End Cap/]) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Add Recess', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add Recess', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create Recess', exact: true })).toBeVisible();
  } finally {
    expect((await request.post('/api/save-plan', { data: JSON.parse(original) })).ok()).toBe(true);
  }
});
