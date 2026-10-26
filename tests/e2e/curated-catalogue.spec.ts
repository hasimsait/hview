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
test('catalogue mounts bounded pages and still searches products beyond the initial page', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  const catalogue = await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    const assets = runtime.catalog.all(), asset = assets.at(-1)!; return { total: assets.length, key: asset.key, name: asset.name };
  });
  const results = page.getByRole('region', { name: 'Catalogue results', exact: true });
  await expect(results.getByRole('heading')).toHaveCount(60);
  await expect(page.getByText(`${catalogue.total} assets available`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show more assets', exact: true }).click();
  await expect(results.getByRole('heading')).toHaveCount(120);
  const search = page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...');
  await search.fill(catalogue.key); await expect(results.getByRole('heading', { name: catalogue.name, exact: true })).toBeVisible();
  await search.fill(''); await expect(results.getByRole('heading')).toHaveCount(60);
  await page.getByRole('button', { name: 'Show more assets', exact: true }).click();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
  expect(await results.getByRole('heading').count()).toBeLessThanOrEqual(60);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(results.getByRole('heading')).toHaveCount(60);
});
async function items(page: Page): Promise<import('../../src/domain/model/PlanData').FurnitureData[]> {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path);
    return runtime.editor.getDocument().furniture.map((item: import('../../src/domain/elements/Furniture').Furniture) => item.toData());
  });
}
async function bookcaseColours(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path), bookcase = runtime.editor.getDocument().furniture[0], colours: Record<string, string[]> = {};
    runtime.scene.getRenderObject(bookcase.id)?.traverse((mesh: any) => { if (mesh.isMesh && mesh.userData.section) (colours[mesh.userData.section] ??= []).push(mesh.material.color.getHexString()); });
    return colours;
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
  await page.evaluate(async () => {
    const path = '/src/main.tsx'; const { runtime } = await import(path), p = runtime.editor.getDocument().furniture[0].position;
    runtime.scene.updateSettings({ foregroundOcclusionMode: 'off' }); runtime.scene.getCamera().position.set(p.x + .8, p.y + 1.35, p.z + 3);
    runtime.scene.getControls()!.target.set(p.x, p.y + 1, p.z); runtime.scene.getControls()!.update(); runtime.scene.invalidate();
  });
  await page.screenshot({ path: testInfo.outputPath('hemnes-bookcase.png') });
  await page.getByRole('button', { name: 'Back panel', exact: true }).click(); await page.getByTitle('White Dove (#f3f1ea)', { exact: true }).click();
  await page.getByRole('button', { name: 'Shelves', exact: true }).click(); await page.getByTitle('Simply White (#f7f6ef)', { exact: true }).click();
  await page.getByRole('button', { name: 'Frame', exact: true }).click(); await page.getByTitle('Alabaster (#f0ece2)', { exact: true }).click();
  const colours = await bookcaseColours(page);
  expect(colours['Back Panel']).toEqual(['f3f1ea']); expect(colours.Shelves.every(c => c === 'f7f6ef')).toBe(true); expect(colours.Frame.every(c => c === 'f0ece2')).toBe(true);
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const edited = await bookcaseColours(page);
  expect(edited['Back Panel']).toEqual(['f3f1ea']); expect(edited.Shelves.every(c => c === 'f7f6ef')).toBe(true); expect(edited.Frame.every(c => c === 'f0ece2')).toBe(true);
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  expect((await items(page))[0]).toMatchObject({ displayName: 'IKEA HEMNES Bookcase — White Stain / Light Brown', shelfCount: 8, sectionFinishes: { back_panel: { color: '#f3f1ea' }, shelves: { color: '#f7f6ef' }, frame: { color: '#f0ece2' } } });
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
