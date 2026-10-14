import { test, expect, type Page } from '@playwright/test';
import { workflowPlan, selectSofa, numberField } from './workflow-helpers';

test.use({ viewport: { width: 2300, height: 900 } });
let original: string;

test.beforeEach(async ({ request }) => {
  original = await (await request.get('/sample.plan')).text();
  expect((await request.post('/api/save-plan', { data: workflowPlan() })).ok()).toBe(true);
});

test.afterEach(async ({ page, request }) => {
  await page.close();
  expect((await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } })).ok()).toBe(true);
});

async function viewportState(page: Page) {
  return page.evaluate(async () => {
    const containerPath = '/src/core/di/container.ts', tokensPath = '/src/core/di/tokens.ts';
    const { defaultContainer } = await import(containerPath);
    const { TOKENS } = await import(tokensPath);
    const scene = defaultContainer.resolve(TOKENS.SceneService) as any;
    return { enabled: scene.getControls().enabled, target: scene.getControls().target.toArray() };
  });
}

test('edits wait for Save and the saving dialog blocks clicks, Escape, and navigation', async ({ page, request }) => {
  const saves: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/save-plan', async (route) => {
    saves.push(route.request().postData()!);
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
    await selectSofa(page);
    await numberField(page, 'Width (X)').fill('225');
    await page.waitForTimeout(1000);
    expect(saves).toHaveLength(0);
    expect((await (await request.get('/sample.plan')).json()).plan.items.sofa.width).toBe(160);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hview_current_plan')!).plan.items.sofa.width)).toBe(160);
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Saving plan' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => saves.length).toBe(1);
    const locked = await viewportState(page);
    expect(locked.enabled).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.keyboard.down('w');
    await page.waitForTimeout(200);
    await page.keyboard.up('w');
    expect((await viewportState(page)).target).toEqual(locked.target);
    await page.mouse.click(20, 20);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !document.activeElement?.closest('header, main'))).toBe(true);
    expect(saves).toHaveLength(1);
    expect(JSON.parse(saves[0]).plan.items.sofa.width).toBe(225);
    release();
    await expect(dialog).toBeHidden();
    expect((await viewportState(page)).enabled).toBe(true);
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeHidden();
    await expect.poll(async () => (await (await request.get('/sample.plan')).json()).plan.items.sofa.width).toBe(225);
  } finally { release(); }
});

test('a failed save unlocks the application and retains edits for manual retry', async ({ page, request }) => {
  let attempts = 0;
  await page.route('**/api/save-plan', async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: 'Unavailable' });
    else await route.continue();
  });
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await selectSofa(page);
  await numberField(page, 'Width (X)').fill('225');
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save failed · Retry', exact: true })).toBeVisible();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  expect((await viewportState(page)).enabled).toBe(true);
  await numberField(page, 'Width (X)').fill('230');
  await page.getByRole('button', { name: 'Save failed · Retry', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect((await (await request.get('/sample.plan')).json()).plan.items.sofa.width).toBe(230);
});
