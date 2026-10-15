import { expect, test } from '@playwright/test';
import { legacyData } from '../support/editor';
import { selectSofa, workflowPlan } from './workflow-helpers';

test.use({ viewport: { width: 2300, height: 900 } });
test('luminaire edits use behavioral instances, retain geometry, undo, and survive manual save', async ({ page, request }) => {
  const original = await (await request.get('/sample.plan')).text();
  try {
    const raw = workflowPlan();
    Object.assign(raw.plan.items.sofa, { name: 'chandelier', assetKey: 'chandelier', position: { x: 2, y: 1, z: 2 }, dimensions: { x: 0.8, y: 0.6, z: 0.8 } });
    expect((await request.post('/api/save-plan', { data: raw })).ok()).toBe(true);
    await page.goto('/'); await expect(page.getByText('1 Objects')).toBeVisible(); await selectSofa(page);
    const lightState = () => page.evaluate(async () => {
      const runtimePath = '/src/main.tsx';
      const { runtime } = await import(runtimePath);
      const element = runtime.editor.getDocument().requireLuminaire('sofa');
      const root = runtime.scene.getRenderObject('sofa');
      const geometries: string[] = [], intensities: number[] = [];
      root.traverse((object: any) => { if (object.isMesh) geometries.push(object.geometry.uuid); if (object.isPointLight) intensities.push(object.intensity); });
      return { kind: element.kind, intensity: element.intensity, root: root.uuid, geometries, intensities };
    });
    const before = await lightState();
    expect(before.kind).toBe('furniture.luminaire'); expect(before.intensity).toBe(1); expect(before.intensities.length).toBeGreaterThan(0);
    const intensity = page.locator('main input[type="range"][max="3"]');
    await intensity.press('End'); await intensity.press('ArrowLeft');
    const after = await lightState();
    expect(after.intensity).toBeCloseTo(2.95); expect(after.root).toBe(before.root); expect(after.geometries).toEqual(before.geometries);
    expect(after.intensities[0]).toBeGreaterThan(before.intensities[0]);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await lightState()).intensity).toBe(3);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect((await lightState()).intensity).toBeCloseTo(2.95);
    await page.getByRole('button', { name: 'Save .plan', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Saving plan' })).toBeHidden();
    expect(legacyData(await (await request.get('/sample.plan')).text()).plan.items.sofa.lightConfig.intensity).toBeCloseTo(2.95);
    await page.reload(); await expect(page.getByText('1 Objects')).toBeVisible(); await selectSofa(page);
    await expect(page.locator('main input[type="range"][max="3"]')).toHaveValue('2.95');
    expect((await lightState()).kind).toBe('furniture.luminaire');
  } finally { await page.close(); await request.post('/api/save-plan', { data: Buffer.from(original), headers: { 'Content-Type': 'application/json' } }); }
});
