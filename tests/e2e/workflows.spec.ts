import { expect, test, type Dialog, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { legacyData } from '../support/editor';
import { numberField, objectPoint, offlineDocument, selectSofa, workflowPlan } from './workflow-helpers';

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

test('inspector move, elevation, rotation and resize survive manual save and reload', async ({ page, request }) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await selectSofa(page);
  await numberField(page, 'X (Horiz.)').fill('2.75');
  await numberField(page, 'Y (Elev.)').fill('0.4');
  await numberField(page, 'Width (X)').fill('210');
  const rotation = page.locator('input[type="range"]').first();
  await rotation.press('Home'); await rotation.press('ArrowRight');
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect.poll(async () => {
    const raw = legacyData(await (await request.get('/sample.plan')).text());
    return raw.plan.items.sofa;
  }).toMatchObject({ position: { x: 2.75, y: 0.4, z: 2 }, dimensions: { x: 2.1, y: 0.75, z: 0.8 }, angle: 5 });
  await page.reload(); await selectSofa(page);
  await expect(numberField(page, 'X (Horiz.)')).toHaveValue('2.75');
  await expect(numberField(page, 'Y (Elev.)')).toHaveValue('0.4');
  await expect(numberField(page, 'Width (X)')).toHaveValue('210');
  await expect(rotation).toHaveValue('5');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .plan', exact: true }).click();
  const download = await downloading;
  const exported = legacyData(readFileSync((await download.path())!, 'utf8'));
  expect(exported.plan.items.sofa.position).toEqual({ x: 2.75, y: 0.4, z: 2 });
});

test('dragging the translation gizmo changes position and persists it', async ({ page, request }) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await selectSofa(page);
  const handle = await page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const controls = runtime.interaction.transformControls;
    const handles = controls._gizmo.gizmo.translate.children.filter((o: any) => o.name === 'X' && o.isMesh && o.visible);
    const arrow = handles.find((o: any) => o.geometry.type === 'CylinderGeometry') || handles[0];
    if (!arrow) throw new Error('X translation handle missing');
    arrow.geometry.computeBoundingBox();
    const point = arrow.position.clone(); arrow.geometry.boundingBox.getCenter(point); point.applyMatrix4(arrow.matrixWorld).project(scene.getCamera());
    const rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
  await page.mouse.move(handle.x, handle.y); await page.mouse.down();
  await page.mouse.move(handle.x + 80, handle.y, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => Number(await numberField(page, 'X (Horiz.)').inputValue())).not.toBe(2);
  const x = Number(await numberField(page, 'X (Horiz.)').inputValue());
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect.poll(async () => (legacyData(await (await request.get('/sample.plan')).text())).plan.items.sofa.position.x).toBeCloseTo(x, 2);
  await page.reload(); await selectSofa(page);
  expect(Number(await numberField(page, 'X (Horiz.)').inputValue())).toBeCloseTo(x, 2);
});

test('replacement selected in the UI survives manual save and reload', async ({ page, request }) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible(); await selectSofa(page);
  await page.getByRole('button', { name: /Replace Asset/ }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('Dining Chair');
  await page.getByRole('button', { name: /Dining Chair/ }).click();
  await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
  await expect.poll(async () => (legacyData(await (await request.get('/sample.plan')).text())).plan.items.sofa.assetKey).toBe('chair');
  await page.reload(); await selectSofa(page);
  expect(await page.locator('h2').innerText()).toBe('Chair');
});

test('downloaded viewer runs with every HTTP request blocked', async ({ page, browser }, testInfo) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'iPad Viewer (.html)', exact: true }).click();
  const downloaded = await downloading;
  const path = testInfo.outputPath('viewer.html'); await downloaded.saveAs(path);
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const offlineUrl = await offlineDocument(context, path, 'viewer');
  const offline = await context.newPage(); const errors: string[] = [];
  offline.on('pageerror', error => errors.push(error.message));
  try {
    await offline.goto(offlineUrl);
    await expect(offline.locator('canvas')).toBeVisible();
    await expect(offline.locator('#room-bar')).toContainText('Living room');
    expect(legacyData(await offline.locator('#plan-data').textContent() as string).plan.items.sofa.position).toEqual({ x: 2, y: 0, z: 2 });
    await offline.locator('#btn-topdown').click();
    await expect(offline.locator('#btn-topdown')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('downloaded editor saves edits offline, reloads, and exports the updated plan', async ({ page, browser }, testInfo) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await objectPoint(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
  const path = testInfo.outputPath('editor.html'); await (await downloading).saveAs(path);
  const context = await browser.newContext({ viewport: { width: 2300, height: 900 } });
  const offlineUrl = await offlineDocument(context, path, 'editor');
  const offline = await context.newPage();
  try {
    await offline.goto(offlineUrl); await expect(offline.getByText('1 Objects')).toBeVisible();
    await offline.getByRole('button', { name: /2D Plan/ }).click(); await offline.mouse.click(point.x, point.y);
    await expect(offline.getByText('ID: sofa', { exact: true })).toBeVisible();
    await numberField(offline, 'Width (X)').fill('225');
    await offline.getByRole('button', { name: 'Save .plan', exact: true }).click();
    await expect(offline.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
    await expect.poll(async () => offline.evaluate(() => {
      const key = `hview_current_plan:${encodeURIComponent(window.location.pathname)}`;
      return JSON.parse(localStorage.getItem(key)!).document.elements.find((entry: any) => entry.data.id === 'sofa').data.dimensions.x * 100;
    })).toBe(225);
    await offline.reload(); await expect(offline.getByText('1 Objects')).toBeVisible();
    await offline.getByRole('button', { name: /2D Plan/ }).click(); await offline.mouse.click(point.x, point.y);
    await expect(numberField(offline, 'Width (X)')).toHaveValue('225');
    const downloadingPlan = offline.waitForEvent('download');
    await offline.getByRole('button', { name: 'Export .plan', exact: true }).click();
    const plan = legacyData(readFileSync((await (await downloadingPlan).path())!, 'utf8'));
    expect(plan.plan.items.sofa.width).toBe(225);
  } finally { await context.close(); }
});

for (const exportButton of ['Full Editor (.html)', 'iPad Viewer (.html)']) {
  test(`offline editor can re-export ${exportButton} without fetching a template`, async ({ page, browser }, testInfo) => {
    await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
    const path = testInfo.outputPath('editor-reexport.html'); await (await downloading).saveAs(path);
    const context = await browser.newContext({ viewport: { width: 2300, height: 900 } });
    const offlineUrl = await offlineDocument(context, path, 'editor-reexport');
    const offline = await context.newPage();
    try {
      await offline.goto(offlineUrl); await expect(offline.getByText('1 Objects')).toBeVisible();
      const outcome = new Promise<{ download?: Download; error?: string }>((resolve, reject) => {
        const cleanup = () => { offline.off('download', onDownload); offline.off('dialog', onDialog); };
        const onDownload = (download: Download) => { cleanup(); resolve({ download }); };
        const onDialog = async (dialog: Dialog) => {
          cleanup(); const error = dialog.message();
          try { await dialog.dismiss(); resolve({ error }); } catch (failure) { reject(failure); }
        };
        offline.once('download', onDownload); offline.once('dialog', onDialog);
      });
      await offline.getByRole('button', { name: exportButton, exact: true }).click();
      const result = await outcome;
      expect(result.error, 'exporting from the downloaded editor must not require an external template').toBeUndefined();
      expect(result.download).toBeDefined();
      const exported = readFileSync((await result.download!.path())!, 'utf8');
      const planData = exported.match(/<script id="plan-data" type="application\/json">([\s\S]*?)<\/script>/);
      expect(planData).not.toBeNull();
      expect(legacyData(planData![1]).plan.items.sofa.pc).toEqual({ x: 200, y: 200 });
    } finally { await context.close(); }
  });
}

test('export controls wrap and remain reachable at desktop widths', async ({ page }) => {
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Export .plan', 'iPad Viewer (.html)', 'Full Editor (.html)']) {
      const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, `${name} must fit at ${width}px`).toBeLessThanOrEqual(width);
    }
    const header = await page.locator('header').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
    expect(header.content).toBeLessThanOrEqual(header.width);
    const main = await page.locator('main').boundingBox();
    expect(main!.y + main!.height).toBeLessThanOrEqual(900);
  }
});

test('finish categories wrap within the inspector without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible();
  await selectSofa(page);
  const names = ['Paint & Plaster', 'Wood & Parquet', 'Tile & Marble', 'Glass', 'Metal & Fixtures', 'Velvet & Fabric'];
  const tabs = page.getByRole('button', { name: names[0], exact: true }).locator('..');
  const row = await tabs.boundingBox();
  const tops: number[] = [];
  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true });
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(row!.x);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(row!.x + row!.width + 1);
    tops.push(bounds!.y);
  }
  expect(new Set(tops).size).toBeGreaterThan(1);
  const size = await tabs.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.width);
  await page.getByRole('button', { name: 'Velvet & Fabric', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Velvet & Fabric', exact: true })).toHaveClass(/text-rose-300/);
});
