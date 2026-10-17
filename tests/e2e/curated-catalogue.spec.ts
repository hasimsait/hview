import { expect, test, type Page } from '@playwright/test';
import { workflowPlan } from './workflow-helpers';

let original: string;
test.beforeEach(async ({ page, request }) => {
  original = await (await request.get('/sample.plan')).text();
  await request.post('/api/save-plan', { data: { plan: { ...workflowPlan().plan, items: {} } } });
  await page.route(/^https:\/\/fonts\./, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.scene.getStatus().state === 'ready';
  });
});
test.afterEach(async ({ page, request }) => {
  await page.close();
  await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } });
});

async function search(page: Page, query: string) {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill(query);
}
async function items(page: Page): Promise<import('../../src/domain/model/PlanData').FurnitureData[]> {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => item.toData());
  });
}

test('HEMNES variants are searchable and keep IKEA sizes and shelf settings after reload', async ({ page }, testInfo) => {
  await search(page, 'HEMNES');
  await expect(page.getByText('4 assets available', { exact: true })).toBeVisible();
  await expect(page.getByText('90 × 37 × 197 cm', { exact: false }).first()).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'IKEA HEMNES Bookcase — White Stain / Light Brown', exact: true }) }).click();
  expect((await items(page))[0]).toMatchObject({ assetKey: 'ikea_hemnes_90_white_light_brown', dimensions: { x: .9, y: 1.97, z: .37 } });
  await page.getByRole('spinbutton', { name: 'Shelf count', exact: true }).fill('8');
  await page.getByRole('spinbutton', { name: 'Shelf count', exact: true }).press('Tab');
  expect((await items(page))[0].shelfCount).toBe(8);
  await page.screenshot({ path: testInfo.outputPath('hemnes-bookcase.png') });
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await items(page))[0]).toMatchObject({ displayName: 'IKEA HEMNES Bookcase — White Stain / Light Brown', shelfCount: 8 });
});

test('BAUHAUS and appliance filters place countertop items above the floor', async ({ page }) => {
  await search(page, 'BAUHAUS');
  await expect(page.getByText('7 assets available', { exact: true })).toBeVisible();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Primanova Biga Soap Dispenser — Black / Chrome', exact: true }) }).click();
  expect((await items(page))[0]).toMatchObject({ assetKey: 'primanova_biga_black_soap_dispenser', position: { y: .9 } });
  await search(page, '');
  await page.getByRole('button', { name: 'Appliances', exact: true }).click();
  for (const name of ['Black Angled Glass Range Hood', 'Black Glass Four-Burner Gas Cooktop', 'Black Built-In Electric Oven']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Black Glass Four-Burner Gas Cooktop', exact: true }) }).click();
  expect((await items(page)).find(item => item.assetKey === 'black_four_burner_gas_cooktop')).toMatchObject({ position: { y: .9 }, dimensions: { x: .6, y: .055, z: .52 } });
});

test('wall cornice controls stay independent of window curtains', async ({ page }) => {
  await page.evaluate(async () => { const path = '/src/main.tsx'; const { runtime } = await import(path); runtime.editor.selection.set({ kind: 'opening', id: 'window' }); });
  await page.getByRole('button', { name: 'Delete curtains', exact: true }).click();
  await page.getByRole('button', { name: 'Edit wall-to-wall cornice', exact: true }).click();
  const profile = page.getByLabel('Cornice profile', { exact: true }); await expect(profile).toHaveValue('cove');
  await page.getByLabel('Cornice visible', { exact: true }).uncheck();
  const decor = () => page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return { profile: runtime.editor.getDocument().requireWall('wall').cornice?.profile, visible: runtime.scene.getRenderObject('wall')?.getObjectByName('cornice_wall')?.visible, curtains: runtime.scene.getRenderObject('window')?.getObjectByName('curtains_window')?.visible ?? null };
  });
  expect(await decor()).toEqual({ profile: 'cove', visible: false, curtains: null });
  await page.getByLabel('Cornice visible', { exact: true }).check(); await profile.selectOption('none');
  expect((await decor()).profile).toBe('none');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(profile).toHaveValue('cove');
  expect((await decor()).curtains).toBeNull();
});
