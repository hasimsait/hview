import { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { SurfaceMaterialFactory } from "../src/engine/materials/SurfaceMaterialFactory";
import { SurfaceLayerControl } from '../src/ui/components/SurfaceLayerControl';

const results: string[] = [];
const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };

try {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(512, 512);
  renderer.setClearColor('#101010');
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 4));
  const service = new SurfaceMaterialFactory();
  service.setForegroundMode('off');
  const definitions = [
    { color: '#ff0000', layer: 0, x: -1, y: 0, w: 2, h: 4 },
    { color: '#00ff00', layer: 1, x: 0.5, y: 0, w: 3, h: 2 },
    { color: '#0000ff', layer: 2, x: 1, y: 1, w: 2, h: 2 },
    { color: '#ffff00', layer: -1, x: 1, y: -1, w: 2, h: 2 },
  ];
  const meshes = definitions.map((definition) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(definition.w, definition.h),
      service.getMaterial({
        type: definition.color === '#0000ff' ? 'tile' : 'paint',
        variant: definition.color === '#0000ff' ? 'square' : undefined,
        groutWidth: 0, color: definition.color, layer: definition.layer
      }, { side: THREE.DoubleSide }));
    mesh.position.set(definition.x, definition.y, 0);
    return mesh;
  });
  // A physically nearer object must still occlude the surface stack.
  const foreground = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
    service.getMaterial({ type: 'paint', color: '#ff00ff', layer: -100 }));
  foreground.position.set(-0.5, 0.5, 0.5);
  scene.add(foreground);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  const target = new THREE.WebGLRenderTarget(512, 512);
  const pixel = new Uint8Array(4);
  const probes = [
    { x: -1.5, y: 1.5, channels: [0] }, // A only
    { x: -0.5, y: -0.5, channels: [1] }, // B over A
    { x: 1, y: 0.5, channels: [2] }, // C over B
    { x: 1, y: -0.5, channels: [1] }, // B over D
    { x: 1, y: -1.5, channels: [0, 1] }, // D only
  ];
  let checkedPixels = 0;
  for (const reverse of [false, true]) {
    for (const mesh of meshes) scene.remove(mesh);
    for (const mesh of reverse ? [...meshes].reverse() : meshes) scene.add(mesh);
    for (const position of [[0, 0, 7], [1.8, 1, 7], [-1.5, -0.8, 6]]) {
      camera.position.set(...position as [number, number, number]);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      for (const probe of probes) {
        for (const dx of [-0.1, 0, 0.1]) for (const dy of [-0.1, 0, 0.1]) {
          const projected = new THREE.Vector3(probe.x + dx, probe.y + dy, 0).project(camera);
          renderer.readRenderTargetPixels(target, Math.floor((projected.x + 1) * 256), Math.floor((projected.y + 1) * 256), 1, 1, pixel);
          for (let channel = 0; channel < 3; channel++) {
            check(probe.channels.includes(channel) ? pixel[channel] > 100 : pixel[channel] < 20,
              `Layer pixel mismatch ${JSON.stringify({ probe, reverse, position, pixel: [...pixel] })}`);
          }
          checkedPixels++;
        }
      }
      const projected = foreground.position.clone().project(camera);
      renderer.readRenderTargetPixels(target, Math.floor((projected.x + 1) * 256), Math.floor((projected.y + 1) * 256), 1, 1, pixel);
      check(pixel[0] > 100 && pixel[1] < 20 && pixel[2] > 100,
        `Layer priority incorrectly draws through nearer geometry: ${JSON.stringify({ position, pixel: [...pixel] })}`);
    }
  }
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  results.push(`${checkedPixels} paint/tile overlap pixels correct across 3 camera angles and 2 insertion orders; nearer geometry remains visible`);

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  function Demo() {
    const [layer, setLayer] = useState(0);
    return <div data-layer={layer}><SurfaceLayerControl layer={layer} onChange={setLayer} /></div>;
  }
  flushSync(() => root.render(<Demo />));
  const layer = () => host.querySelector('[data-layer]')!.getAttribute('data-layer');
  flushSync(() => (host.querySelector('[aria-label="Increase surface layer"]') as HTMLButtonElement).click());
  check(layer() === '1', 'Increase layer button failed');
  flushSync(() => (host.querySelector('[aria-label="Decrease surface layer"]') as HTMLButtonElement).click());
  check(layer() === '0', 'Decrease layer button failed');
  const input = host.querySelector('input')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  input.focus();
  flushSync(() => { setter.call(input, '-4'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  flushSync(() => input.blur());
  check(layer() === '-4', 'Signed integer layer input failed');
  input.focus();
  flushSync(() => { setter.call(input, '2.5'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  flushSync(() => input.blur());
  check(layer() === '-4' && input.value === '-4', 'Fractional layer must be rejected');
  results.push('Layer buttons, signed integer input and fractional input rejection passed');
  document.getElementById('results')!.textContent = JSON.stringify({ ok: true, results });
} catch (error) {
  document.getElementById('results')!.textContent = JSON.stringify({ ok: false, error: String(error), results });
}
