import { expect, test, type Page } from '@playwright/test';
import { workflowPlan } from './workflow-helpers';
import { escapeScriptJson, packStandaloneHtml, setScriptContent } from '../../src/services/export/StandaloneHtml';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\./, route => route.abort());
  await page.route(/\/sample\.plan(?:\?|$)/, route => route.fulfill({ json: workflowPlan() }));
});

async function readyAtEyeLevel(page: Page) {
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toBeVisible();
  await page.waitForFunction(() => {
    const root = document.getElementById('root') as any;
    const key = root && Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    return key && root[key].stateNode.current.memoizedState.element?.props.value?.scene.getStatus().state === 'ready';
  });
  // Set only the starting viewpoint. Tour actions below use real keyboard events.
  await page.evaluate(() => {
    const root = document.getElementById('root') as any;
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene;
    scene.getCamera().position.set(2, 1.6, 3);
    scene.getControls().target.set(2, 1.6, -2);
    scene.getControls().update(); scene.invalidate();
  });
}

async function view(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('root') as any;
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
    const scene = root[key].stateNode.current.memoizedState.element.props.value.scene;
    const camera = scene.getCamera(), controls = scene.getControls();
    return { eye: camera.position.toArray() as number[], target: controls.target.toArray() as number[],
      direction: camera.getWorldDirection(camera.position.clone()).toArray() as number[],
      distance: camera.position.distanceTo(controls.target) as number };
  });
}

const delta = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]));
async function holdUntil(page: Page, key: string, predicate: () => Promise<boolean>) {
  await page.keyboard.down(key);
  try { await expect.poll(predicate).toBe(true); }
  finally { await page.keyboard.up(key); }
}

for (const offline of [false, true]) {
  test(`${offline ? 'offline editor' : 'live editor'} tilts and turns at a fixed eye position, then walks at eye height`, async ({ page, context, request }) => {
    if (offline) {
      const template = await (await request.get('/hview_editor_template.html')).text();
      const html = packStandaloneHtml(setScriptContent(template, 'plan-data', escapeScriptJson(JSON.stringify(workflowPlan()))));
      const url = 'http://127.0.0.1:3100/__offline__/camera-tour.html';
      await context.route(/^https?:/, route => route.request().url() === url
        ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
      await page.goto(url);
    } else await page.goto('/');
    await readyAtEyeLevel(page);
    const beforeFov = await view(page);
    const fov = page.getByRole('slider', { name: 'Field of view', exact: true });
    await expect(fov).toHaveValue('65');
    await expect(fov).toHaveAttribute('max', '120');
    await fov.fill('120');
    await expect.poll(() => page.evaluate(() => {
      const root = document.getElementById('root') as any;
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'))!;
      return root[key].stateNode.current.memoizedState.element.props.value.scene.getCamera().fov;
    })).toBe(120);
    const afterFov = await view(page);
    expect(delta(afterFov.eye, beforeFov.eye)).toBeLessThan(1e-6);
    expect(delta(afterFov.target, beforeFov.target)).toBeLessThan(1e-6);
    await fov.fill('65');
    // Mouse look must turn from the same eye position as keyboard look.
    const beforeMouse = await view(page);
    const canvas = page.locator('canvas').first();
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => delta((await view(page)).direction, beforeMouse.direction)).toBeGreaterThan(.1);
    const afterMouse = await view(page);
    expect(delta(afterMouse.eye, beforeMouse.eye)).toBeLessThan(1e-6);
    expect(afterMouse.distance).toBeCloseTo(beforeMouse.distance, 6);
    const start = await view(page);
    await holdUntil(page, 'ArrowUp', async () => (await view(page)).direction[1] > .4);
    const up = await view(page);
    expect(delta(up.eye, start.eye)).toBeLessThan(1e-6);
    expect(up.distance).toBeCloseTo(start.distance, 5);
    expect(up.target[1]).toBeGreaterThan(up.eye[1]);

    await holdUntil(page, 'ArrowLeft', async () => (await view(page)).direction[0] < -.3);
    const turned = await view(page);
    expect(delta(turned.eye, start.eye)).toBeLessThan(1e-6);
    expect(turned.direction[1]).toBeCloseTo(up.direction[1], 5);

    await holdUntil(page, 'w', async () => delta((await view(page)).eye, start.eye) > .5);
    const walked = await view(page);
    expect(walked.eye[1]).toBeCloseTo(1.6, 5);
    expect(delta(walked.direction, turned.direction)).toBeLessThan(1e-6);

    await holdUntil(page, 'ArrowDown', async () => (await view(page)).direction[1] < -.25);
    const down = await view(page);
    expect(delta(down.eye, walked.eye)).toBeLessThan(1e-6);
    expect(down.distance).toBeCloseTo(start.distance, 5);
  });
}

test('2D plan arrows pan while keeping the camera directly overhead', async ({ page }) => {
  await page.goto('/'); await readyAtEyeLevel(page);
  await page.getByRole('button', { name: /2D Plan/ }).click();
  const start = await view(page);
  await holdUntil(page, 'ArrowUp', async () => (await view(page)).target[2] < start.target[2] - .5);
  const panned = await view(page);
  expect(panned.eye[1]).toBeCloseTo(start.eye[1], 5);
  expect(delta(panned.direction, start.direction)).toBeLessThan(1e-6);
  expect(panned.direction[1]).toBeCloseTo(-1, 5);
});
