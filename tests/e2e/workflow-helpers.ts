import { expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { rawPlan } from '../unit/fixtures';

export function workflowPlan() {
  const raw = rawPlan();
  raw.plan.rooms2.room.polygon = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }];
  Object.assign(raw.plan.items.sofa, { pc: { x: 200, y: 200 }, width: 160, height: 80, self_height: 75, f0offset: 0, angle: 180 });
  return raw;
}

// Read only: project actual scene geometry to screen coordinates. All selections
// and edits still use real browser pointer/keyboard events, not service setters.
export async function objectPoint(page: Page) {
  return page.evaluate(async () => {
    const runtimePath = '/src/main.tsx';
    const { runtime } = await import(runtimePath);
    const scene = runtime.scene;
    const object = scene.getScene().getObjectByName('furnitureGroup').children.find((o: any) => o.userData.id === 'sofa');
    if (!object) throw new Error('sofa mesh missing');
    const point = object.position.clone(); point.y += 0.4;
    point.project(scene.getCamera());
    const rect = scene.getDomElement().getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  });
}

export async function selectSofa(page: Page) {
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const point = await objectPoint(page);
  await page.mouse.click(point.x, point.y);
  await expect(page.getByText('ID: sofa', { exact: true })).toBeVisible();
  return point;
}

export function numberField(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..').locator('input[type="number"]');
}

export async function offlineDocument(context: BrowserContext, path: string, name: string) {
  // Managed Chromium blocks file://. Fulfill the downloaded document from bytes
  // in memory, including on reload, and abort ALL other HTTP requests. No app,
  // asset or API response is available from the running server in this context.
  const url = `http://127.0.0.1:3100/__offline__/${name}.html`;
  const html = readFileSync(path, 'utf8');
  await context.route(/^https?:/, route => route.request().isNavigationRequest() && route.request().url() === url
    ? route.fulfill({ status: 200, contentType: 'text/html', body: html })
    : route.abort());
  return url;
}
