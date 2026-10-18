import { expect, test } from '@playwright/test';
import { DAILY_LIFE_ASSETS } from '../../src/domain/catalog/DailyLifeAssets';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../../src/services/export/StandaloneHtml';

test('new daily-life assets render offline and remain searchable in English', async ({ page, context, request }, info) => {
  const codec = new PlanCodec();
  const entities = DAILY_LIFE_ASSETS.map((asset, i) => codec.factory.furniture({ id: asset.key, name: asset.key, assetKey: asset.key, displayName: asset.name, category: asset.category as 'decor', dimensions: asset.defaultDimensions, position: { x: (i % 4) * 1.5, y: 0, z: Math.floor(i / 4) * 1.8 }, rotationY: 0 }));
  const json = codec.encode(new PlanDocument(entities, 2.7));
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(json)));
  const url = 'http://127.0.0.1:3100/__offline__/daily-life.html', errors: string[] = [], requests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: 'text/html', body: html }) : (requests.push(route.request().url()), route.abort()));
  await page.goto(url);
  await page.waitForFunction(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    return key && root[key].stateNode.current.memoizedState.element.props.value.scene.getStatus().state === 'ready';
  });
  const state = await page.evaluate(() => {
    const root = document.getElementById('root') as any, key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const runtime = root[key].stateNode.current.memoizedState.element.props.value;
    runtime.scene.updateSettings({ showFloor: false, foregroundOcclusionMode: 'off' });
    runtime.scene.getCamera().position.set(10, 9, 13); runtime.scene.getControls().target.set(2.25, .6, 3.6); runtime.scene.getControls().update(); runtime.scene.invalidate();
    return runtime.editor.getDocument().furniture.map((f: any) => ({ key: f.assetKey, built: !!runtime.scene.getRenderObject(f.id)?.children.length }));
  });
  expect(state).toHaveLength(DAILY_LIFE_ASSETS.length); expect(state.every((a: any) => a.built)).toBe(true);
  await page.screenshot({ path: info.outputPath('daily-life-gallery.png') });
  for (const key of ['life_nespresso', 'life_cat_house', 'life_cat_fountain', 'life_vanity_bottles', 'life_garment_coat', 'life_boots_large', 'life_drawer_organizer']) {
    await page.evaluate(async key => {
      const root = document.getElementById('root') as any, ref = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
      const runtime = root[ref].stateNode.current.memoizedState.element.props.value, f = runtime.editor.getDocument().requireFurniture(key), p = f.position, d = f.dimensions;
      const span = Math.max(d.x, d.y, d.z), camera = runtime.scene.getCamera(), controls = runtime.scene.getControls();
      controls.minDistance = .05; controls.target.set(p.x, p.y + d.y / 2, p.z);
      camera.position.set(p.x + span * .9, p.y + d.y * .9, p.z + span * 1.7); controls.update(); runtime.scene.invalidate();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, key);
    await page.screenshot({ path: info.outputPath(`${key}.png`) });
  }
  await page.getByRole('button', { name: 'Add Asset', exact: true }).click();
  await page.getByRole('button', { name: 'Pet Care', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stainless-Steel Tray Cat Water Fountain', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('EU 47');
  await expect(page.getByRole('heading', { name: 'EU 47 Sneakers — Pair', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'EU 47 Ankle Boots — Pair', exact: true })).toBeVisible();
  await page.getByPlaceholder('Search assets (e.g. towel, fan, sconce, bed, sink)...').fill('Nespresso');
  await expect(page.getByRole('heading', { name: 'Nespresso Capsule Coffee Machine', exact: true })).toBeVisible();
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});
