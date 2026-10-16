import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { offlineDocument } from './workflow-helpers';

async function ready(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root') as any;
    const key = root && Object.keys(root).find(key => key.startsWith('__reactContainer$'));
    const runtime = key && root[key]?.stateNode.current.memoizedState?.element?.props?.value;
    if (!runtime) return false;
    (window as any).__testRuntime = runtime;
    return runtime.scene.getStatus().state === 'ready';
  });
}

test('a damaged compressed application leaves a readable retry screen', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const source = readFileSync('dist/hview_editor.html', 'utf8').replace(
      /(<script id="editor-runtime"[^>]*>)[\s\S]*?(<\/script>)/,
      '$1invalid compressed bytes$2',
    );
    await context.route('http://portable.test/broken.html', route => route.fulfill({ body: source, contentType: 'text/html' }));
    const page = await context.newPage();
    await page.goto('http://portable.test/broken.html');
    await expect(page.getByRole('alert')).toContainText('This plan could not open');
    await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  } finally { await context.close(); }
});

test('mobile editor opens and re-exports offline, then redraws after GPU restoration', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, acceptDownloads: true });
  try {
    const url = await offlineDocument(context, 'dist/hview_editor.html', 'mobile-performance');
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await ready(page);
    expect(await page.locator('#embedded-textures, #plan-data, #editor-runtime').count()).toBe(0);
    expect(await page.evaluate(() => Boolean(window.__EMBEDDED_TEXTURES__))).toBe(false);
    const metrics = await page.evaluate(() => {
      const scene = (window as any).__testRuntime.scene;
      let outlines = 0, fixtureLights = 0;
      scene.getScene().traverseVisible((o: any) => { if (o.name === 'celOutline') outlines++; if (o.userData.isFixtureLight) fixtureLights++; });
      return { pixelRatio: scene.renderer.getPixelRatio(), shadows: scene.renderer.shadowMap.enabled, outlines, fixtureLights, calls: scene.renderer.info.render.calls };
    });
    expect(metrics.pixelRatio).toBeLessThanOrEqual(1.25);
    expect(metrics.shadows).toBe(false); expect(metrics.outlines).toBe(0); expect(metrics.fixtureLights).toBeGreaterThan(0); expect(metrics.fixtureLights).toBeLessThanOrEqual(4);
    expect(metrics.calls).toBeLessThan(1200);

    // Night lighting keeps a bounded set of real lights and follows the camera.
    await page.evaluate(() => (window as any).__testRuntime.scene.updateSettings({ globalLighting: false }));
    await page.waitForFunction(() => {
      const scene = (window as any).__testRuntime.scene;
      let count = 0; scene.getScene().traverseVisible((o: any) => { if (o.userData.isFixtureLight) count++; });
      return count > 0 && count <= 4 && !scene.preparing;
    });
    await page.evaluate(() => {
      const scene = (window as any).__testRuntime.scene;
      const room = (window as any).__testRuntime.editor.getDocument().rooms[0];
      scene.focusOnRoom(room.id);
    });
    await page.waitForFunction(() => {
      const scene = (window as any).__testRuntime.scene;
      return scene.lightTarget.distanceToSquared(scene.getCamera().position) < 0.01;
    });
    await page.evaluate(() => (window as any).__testRuntime.scene.updateSettings({ globalLighting: true }));

    // Resource changes must still permit hidden ceilings and isolated rooms.
    await page.getByRole('button', { name: 'Ceilings: OFF', exact: true }).click();
    await page.waitForFunction(() => (window as any).__testRuntime.scene.ceilingsGroup.children[0]?.children.length === 10);
    await page.getByRole('button', { name: 'Ceilings: ON', exact: true }).click();

    await page.evaluate(() => (window as any).__testRuntime.scene.renderer.forceContextLoss());
    await expect(page.getByText('Restoring 3D view…', { exact: true })).toBeVisible();
    await page.evaluate(() => (window as any).__testRuntime.scene.renderer.forceContextRestore());
    await ready(page);
    expect(await page.evaluate(() => (window as any).__testRuntime.scene.renderer.info.render.frame)).toBeGreaterThan(0);

    const editorDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Full Editor (.html)', exact: true }).click();
    const editorPath = testInfo.outputPath('reexported-editor.html');
    await (await editorDownload).saveAs(editorPath);
    const viewerDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'iPad Viewer (.html)', exact: true }).click();
    const viewerPath = testInfo.outputPath('reexported-viewer.html');
    await (await viewerDownload).saveAs(viewerPath);
    expect(errors).toEqual([]);

    for (const [path, name] of [[editorPath, 'editor'], [viewerPath, 'viewer']]) {
      const offline = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      try {
        const exportedUrl = await offlineDocument(offline, path, name), exported = await offline.newPage();
        exported.on('pageerror', error => errors.push(error.message));
        await exported.goto(exportedUrl);
        if (name === 'editor') await ready(exported);
        else await exported.waitForFunction(() => (window as any).__viewerApp?.sceneService.getStatus().state === 'ready');
        await expect(exported.locator('canvas').first()).toBeVisible();
        if (name === 'editor') {
          // Reset must still work after compressed source blocks left the DOM.
          const count = await exported.evaluate(() => (window as any).__testRuntime.editor.getDocument().furniture.length);
          await exported.evaluate(() => (window as any).__testRuntime.documents.reset());
          expect(await exported.evaluate(() => (window as any).__testRuntime.editor.getDocument().furniture.length)).toBe(count);
        }
      } finally { await offline.close(); }
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('a WebGL initialization failure leaves a readable retry screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const url = await offlineDocument(context, 'dist/hview_editor.html', 'no-webgl');
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: any[]) {
        if (type.startsWith('webgl')) return null;
        return original.apply(this, [type, ...args] as any);
      };
    });
    await page.goto(url);
    await expect(page.getByRole('alert')).toContainText('The 3D view could not start');
    await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
