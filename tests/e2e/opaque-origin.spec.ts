import { expect, test, type Frame, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { workflowPlan } from './workflow-helpers';
import { standaloneBlockText } from '../../src/services/export/StandaloneHtml';

async function opaqueEditor(page: Page, html: string): Promise<Frame> {
  // Managed Chromium blocks top-level data: navigation. A sandboxed srcdoc has
  // the same opaque-origin storage restrictions; the data: pathname allocation
  // is independently guarded by a getter that throws in the unit regression.
  await page.setContent('<style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe sandbox="allow-scripts allow-downloads allow-modals"></iframe>');
  await page.locator('iframe').evaluate((element, content) => { (element as HTMLIFrameElement).srcdoc = content; }, html);
  const frame = page.frames().find(frame => frame.parentFrame())!;
  await frame.waitForFunction(() => {
    const root = document.getElementById('root') as any;
    const key = root && Object.keys(root).find(key => key.startsWith('__reactContainer$'));
    const runtime = key && root[key]?.stateNode.current.memoizedState?.element?.props?.value;
    if (!runtime) return false;
    (window as any).__testRuntime = runtime;
    return runtime.scene.getStatus().state === 'ready';
  });
  return frame;
}

test('opaque-origin editor imports, edits, resets, and saves a portable HTML copy without storage or requests', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  const requests: string[] = [], errors: string[] = [];
  await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  try {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    let frame = await opaqueEditor(page, readFileSync('hview_editor.html', 'utf8'));
    expect(await frame.evaluate(() => {
      try { localStorage.getItem('probe'); return 'available'; } catch (error) { return (error as Error).name; }
    })).toBe('SecurityError');
    await expect(frame.getByText('Changes stay in this tab. Use Save HTML to keep a copy.')).toBeVisible();
    await expect(frame.getByRole('button', { name: 'Save HTML', exact: true })).toBeVisible();
    expect(await frame.evaluate(() => {
      const browser = (window as any).__testRuntime.storage.browser;
      return Math.max(browser.key.length, browser.timeKey.length);
    })).toBeLessThan(100);

    // Reset is an in-memory operation here and must not fail on blocked storage.
    await frame.evaluate(() => (window as any).__testRuntime.documents.reset());
    await frame.locator('input[type=file]').setInputFiles({ name: 'shortcut.plan', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workflowPlan())) });
    await expect(frame.getByText('1 Objects', { exact: true })).toBeVisible();
    await frame.getByRole('button', { name: /2D Plan/ }).click();
    await frame.waitForFunction(() => {
      const scene = (window as any).__testRuntime.scene;
      return !scene.preparing && !scene.needsPreparation;
    });
    const point = await frame.evaluate(() => {
      const scene = (window as any).__testRuntime.scene;
      const object = scene.getRenderObject('sofa'), point = object.position.clone(); point.y += 0.4;
      point.project(scene.getCamera());
      const rect = scene.getDomElement().getBoundingClientRect();
      return { x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2 };
    });
    await frame.locator('canvas').first().click({ position: point });
    await expect(frame.getByText('ID: sofa', { exact: true })).toBeVisible();
    const width = frame.getByText('Width (X)', { exact: true }).locator('..').locator('input[type=number]');
    await width.fill('225'); await width.press('Tab');
    await expect.poll(() => frame.evaluate(() => (window as any).__testRuntime.editor.getDocument().requireFurniture('sofa').dimensions.x)).toBe(2.25);
    // Close the inspector so its mobile sheet does not cover the save controls.
    await frame.getByRole('button', { name: 'Close inspector' }).click();
    const downloading = page.waitForEvent('download');
    await frame.getByRole('button', { name: 'Save HTML', exact: true }).click();
    const destination = testInfo.outputPath('shortcut-saved.html');
    await (await downloading).saveAs(destination);
    const saved = readFileSync(destination, 'utf8');
    const plan = JSON.parse(standaloneBlockText(saved, 'plan-data'));
    expect(plan.document.elements.find((entry: any) => entry.data.id === 'sofa').data.dimensions.x).toBe(2.25);
    await expect(frame.getByRole('button', { name: 'Saved', exact: true })).toHaveCount(0);
    frame = await opaqueEditor(page, saved);
    expect(await frame.evaluate(() => (window as any).__testRuntime.editor.getDocument().requireFurniture('sofa').dimensions.x)).toBe(2.25);
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
