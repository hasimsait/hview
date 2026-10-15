import { test, expect, type Page, type Frame } from '@playwright/test';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../../src/services/export/StandaloneHtml';
import { workflowPlan } from './workflow-helpers';

const enterLabel = 'Enter fullscreen and hide topbar';
const exitLabel = 'Exit fullscreen and show topbar';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route(/\/sample\.plan(?:\?|$)/, route => route.fulfill({ json: workflowPlan() }));
  // These checks cover DOM layout and canvas resizing. Avoid spending GPU time
  // drawing the plan on software-rendered CI browsers.
  await page.addInitScript(() => {
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      context.prototype.drawElements = () => {};
      context.prototype.drawArrays = () => {};
    }
  });
});

async function expectExpandedViewport(page: Page | Frame) {
  await expect(page.getByRole('button', { name: exitLabel })).toBeVisible();
  await expect(page.getByRole('button', { name: exitLabel })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('header button:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Add Asset', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeHidden();
  await expect.poll(() => page.locator('main').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, width: rect.width, height: rect.height };
  })).toEqual(await page.evaluate(() => ({ top: 0, width: innerWidth, height: innerHeight })));
  // Wait for Three.js's ResizeObserver to resize the actual drawing surface too.
  await expect.poll(() => page.locator('main canvas').first().evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  })).toEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
}

test('only the logo restores the toolbar, including after native fullscreen exits', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const originalCanvas = await page.locator('main canvas').first().elementHandle();

  await page.getByRole('button', { name: enterLabel }).click();
  await expectExpandedViewport(page);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await page.getByRole('button', { name: exitLabel }).click();
  await expect(page.getByRole('button', { name: enterLabel })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: /2D Plan/ })).toHaveClass(/bg-sky-500/);
  expect(await page.locator('main canvas').first().evaluate((canvas, original) => canvas === original, originalCanvas)).toBe(true);

  await page.getByRole('button', { name: enterLabel }).click();
  await expectExpandedViewport(page);
  await page.evaluate(() => document.exitFullscreen());
  await expectExpandedViewport(page);
  await page.keyboard.press('Escape');
  await expectExpandedViewport(page);
  await page.getByRole('button', { name: exitLabel }).click();
  await expect(page.getByRole('button', { name: enterLabel })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Asset', exact: true })).toBeVisible();
});

for (const mode of ['unavailable', 'rejected'] as const) {
  test(`phone viewport expands when native fullscreen is ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((mode) => {
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        value: mode === 'unavailable' ? undefined : () => Promise.reject(new Error('Fullscreen denied')),
      });
      Object.defineProperty(HTMLElement.prototype, 'webkitRequestFullscreen', { value: undefined });
    }, mode);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
    const initialHeight = await page.locator('main').evaluate(element => element.clientHeight);
    await page.getByRole('button', { name: enterLabel }).click();
    await expectExpandedViewport(page);
    expect(await page.locator('main').evaluate(element => element.clientHeight)).toBeGreaterThan(initialHeight);

    await page.setViewportSize({ width: 844, height: 390 });
    await expectExpandedViewport(page);
    await page.getByRole('button', { name: exitLabel }).click();
    await expect(page.getByRole('button', { name: 'Add Asset', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
    await page.getByRole('button', { name: enterLabel }).click();
    await page.keyboard.press('Escape');
    await expectExpandedViewport(page);
    await page.getByRole('button', { name: exitLabel }).click();
    await expect(page.getByRole('button', { name: enterLabel })).toBeVisible();
  });
}

test('standalone editor supports the logo toggle offline on a phone', async ({ context, page, request }) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(workflowPlan()))));
  const url = 'http://127.0.0.1:3100/__offline__/fullscreen.html';
  await context.route(/^https?:/, route => route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html })
    : route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { value: undefined });
    Object.defineProperty(HTMLElement.prototype, 'webkitRequestFullscreen', { value: undefined });
  });
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.getByRole('button', { name: enterLabel }).click();
  await expectExpandedViewport(page);
  await page.getByRole('button', { name: exitLabel }).click();
  await expect(page.getByRole('button', { name: 'Add Asset', exact: true })).toBeVisible();
});

test('opaque-origin phone editor hides the save notice until the logo restores it', async ({ context, page, request }) => {
  const template = await (await request.get('/hview_editor_template.html')).text();
  const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(workflowPlan()))));
  await context.route(/^https?:/, route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<style>body{margin:0}iframe{display:block;border:0;width:100vw;height:100vh}</style><iframe sandbox="allow-scripts allow-downloads allow-modals"></iframe>');
  await page.locator('iframe').evaluate((element, content) => { (element as HTMLIFrameElement).srcdoc = content; }, html);
  const frame = page.frames().find(frame => frame.parentFrame())!;
  const notice = frame.getByText('Changes stay in this tab. Use Save HTML to keep a copy.');
  await expect(notice).toBeVisible();
  await frame.getByRole('button', { name: enterLabel }).click();
  await expectExpandedViewport(frame);
  await expect(notice).toBeHidden();
  await frame.getByRole('button', { name: exitLabel }).click();
  await expect(notice).toBeVisible();
});
