// @vitest-environment jsdom
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { afterEach, describe, expect, it } from 'vitest';
import { CameraNavigationController, MAX_CAMERA_PITCH } from '../../src/services/rendering/CameraNavigationController';
import type { ViewMode } from '../../src/core/types/services';

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });

function fixture(viewMode: ViewMode = 'perspective') {
  const element = document.createElement('div'); document.body.append(element);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(2, 1.6, 3);
  const ortho = new THREE.OrthographicCamera(); ortho.position.set(2, 30, 3);
  const controls = new OrbitControls(viewMode === 'topDown' ? ortho : camera, element);
  controls.target.set(2, viewMode === 'topDown' ? 0 : 1.6, viewMode === 'topDown' ? 3 : -2);
  controls.minDistance = 1;
  controls.maxPolarAngle = Math.PI / 2 + MAX_CAMERA_PITCH;
  controls.update();
  const nav = new CameraNavigationController(camera, ortho, () => controls, () => viewMode);
  nav.attach(); cleanup.push(() => { nav.dispose(); controls.dispose(); element.remove(); });
  const key = (key: string, down = true, target: EventTarget = window) => target.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
    key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, bubbles: true, cancelable: true,
  }));
  const step = (frames = 1) => { for (let i = 0; i < frames; i++) { nav.update(.05); controls.update(); } };
  const direction = () => camera.getWorldDirection(new THREE.Vector3());
  const pitch = () => Math.asin(THREE.MathUtils.clamp(direction().y, -1, 1));
  return { camera, ortho, controls, nav, key, step, direction, pitch };
}

describe('house tour camera navigation', () => {
  it('tilts above the horizon and settles without moving the eye position or orbit distance', () => {
    const { camera, controls, key, step, pitch } = fixture();
    const eye = camera.position.clone(), distance = eye.distanceTo(controls.target);
    key('ArrowUp'); step(10); key('ArrowUp', false); step(50);
    expect(pitch()).toBeCloseTo(.8, 8);
    expect(camera.position.distanceTo(eye)).toBeLessThan(1e-10);
    expect(controls.target.distanceTo(camera.position)).toBeCloseTo(distance, 8);
    expect(controls.target.y).toBeGreaterThan(camera.position.y);
  });

  it('clamps long upward and downward tilts without flipping, then immediately reverses', () => {
    const { camera, key, step, pitch } = fixture();
    const eye = camera.position.clone();
    key('ArrowUp'); step(200); key('ArrowUp', false);
    expect(pitch()).toBeCloseTo(MAX_CAMERA_PITCH, 8);
    key('ArrowDown'); step();
    expect(pitch()).toBeCloseTo(MAX_CAMERA_PITCH - .08, 8);
    step(200); key('ArrowDown', false);
    expect(pitch()).toBeCloseTo(-MAX_CAMERA_PITCH, 8);
    expect(camera.position.distanceTo(eye)).toBeLessThan(1e-9);
  });

  it('turns in place while tilted and walks horizontally at the same eye height', () => {
    const { camera, key, step, direction } = fixture();
    const eye = camera.position.clone();
    key('ArrowUp'); step(5); key('ArrowUp', false);
    key('ArrowLeft'); step(10); key('ArrowLeft', false);
    const facing = direction();
    expect(facing.x).toBeLessThan(0); expect(facing.y).toBeGreaterThan(0);
    expect(camera.position.distanceTo(eye)).toBeLessThan(1e-10);
    key('w'); step(10); key('w', false);
    const displacement = camera.position.clone().sub(eye);
    expect(displacement.y).toBeCloseTo(0, 8);
    expect(displacement.length()).toBeCloseTo(1.4, 8);
    expect(direction().distanceTo(facing)).toBeLessThan(1e-10);
  });

  it('cancels opposing tilt keys and releases navigation on blur', () => {
    const { nav, key, step, pitch } = fixture();
    key('ArrowUp'); key('ArrowDown'); step(10);
    expect(pitch()).toBeCloseTo(0, 8);
    window.dispatchEvent(new Event('blur'));
    expect(nav.hasActiveInput).toBe(false);
    step(); expect(pitch()).toBeCloseTo(0, 8);
  });

  it('keeps Control+arrows as horizontal movement rather than tilting', () => {
    const { camera, key, step, pitch } = fixture();
    const eye = camera.position.clone();
    key('Control'); key('ArrowUp'); step(10); key('ArrowUp', false); key('Control', false);
    expect(pitch()).toBeCloseTo(0, 8);
    expect(camera.position.y).toBeCloseTo(eye.y, 8);
    expect(camera.position.z).toBeCloseTo(eye.z - 1.4, 8);
  });

  it('preserves 2D arrow panning without tilting the orthographic camera', () => {
    const { ortho, controls, key, step } = fixture('topDown');
    const eye = ortho.position.clone(), facing = ortho.getWorldDirection(new THREE.Vector3());
    key('ArrowUp'); step(5); key('ArrowUp', false);
    expect(ortho.position.z).toBeLessThan(eye.z);
    expect(ortho.position.y).toBeCloseTo(eye.y, 8);
    expect(controls.target.y).toBe(0);
    expect(ortho.getWorldDirection(new THREE.Vector3()).distanceTo(facing)).toBeLessThan(1e-8);
  });

  it('ignores arrows used to edit input fields', () => {
    const { nav, key, step, pitch } = fixture();
    const input = document.createElement('input'); document.body.append(input);
    key('ArrowUp', true, input); step(10);
    expect(pitch()).toBeCloseTo(0, 8); expect(nav.hasActiveInput).toBe(false);
    input.remove();
  });
});

function setupMouse() {
  const canvas = document.createElement('canvas');
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  Object.defineProperty(canvas, 'clientHeight', { value: 600 });
  document.body.appendChild(canvas);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(3, 2, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  controls.target.set(3, 2, 0);
  controls.update();
  const nav = new CameraNavigationController(camera, new THREE.OrthographicCamera(), () => controls, () => 'perspective');
  nav.attach();
  return { camera, controls, nav, canvas };
}

function pointer(target: EventTarget, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x, clientY: y });
  target.dispatchEvent(event);
}

describe('camera navigation', () => {
  it('dragging up and left matches arrow-up/left look while retaining the eye and look distance', () => {
    const mouse = setupMouse();
    const keys = setupMouse();
    const start = mouse.camera.position.clone();
    const distance = mouse.camera.position.distanceTo(mouse.controls.target);
    const angle = 1.6 * 0.1;
    pointer(mouse.canvas, 'pointerdown', 0, 0);
    pointer(window, 'pointermove', -angle * 600 / (2 * Math.PI), -angle * 600 / (2 * Math.PI));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp' }));
    keys.nav.update(0.1);
    mouse.controls.update();
    keys.controls.update();
    expect(mouse.camera.position.distanceTo(start)).toBeLessThan(1e-10);
    expect(mouse.controls.target.distanceTo(keys.controls.target)).toBeLessThan(1e-10);
    expect(mouse.camera.position.distanceTo(mouse.controls.target)).toBeCloseTo(distance);
    pointer(window, 'pointerup', 0, 0);
    expect(mouse.controls.enableRotate).toBe(true);
    mouse.nav.dispose(); keys.nav.dispose();
    mouse.controls.dispose(); keys.controls.dispose();
  });

  it('clamps mouse pitch and restores rotation when interrupted', () => {
    const { nav, camera, controls, canvas } = setupMouse();
    const start = camera.position.clone();
    pointer(canvas, 'pointerdown', 0, 0);
    pointer(window, 'pointermove', 0, 100000);
    controls.update();
    const direction = controls.target.clone().sub(camera.position).normalize();
    expect(Math.asin(direction.y)).toBeCloseTo(-MAX_CAMERA_PITCH);
    pointer(window, 'pointermove', 0, -100000);
    controls.update();
    expect(Math.asin(controls.target.clone().sub(camera.position).normalize().y)).toBeCloseTo(MAX_CAMERA_PITCH);
    expect(camera.position.distanceTo(start)).toBeLessThan(1e-10);
    window.dispatchEvent(new Event('blur'));
    expect(controls.enableRotate).toBe(true);
    nav.dispose(); controls.dispose();
  });
});
