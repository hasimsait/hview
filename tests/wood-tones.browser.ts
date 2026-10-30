import * as THREE from 'three';
import { FURNITURE_WOOD_FINISHES } from '../src/domain/catalog/WoodFinishes';
import { SurfaceMaterialFactory } from '../src/engine/materials/SurfaceMaterialFactory';
import { SurfaceColorView, configureColorView } from '../src/engine/materials/SurfaceColorView';

async function check() {
  const factory = new SurfaceMaterialFactory(), view = new SurfaceColorView();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(256, 256); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .01, 10); camera.position.z = 2;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1)); factory.ensureLocalMetricBounds(plane); scene.add(plane);
  const materials = FURNITURE_WOOD_FINISHES.map(finish => factory.getMaterial(finish, { projection: 'local', foregroundOcclusion: false }) as THREE.MeshStandardMaterial);
  const billy = factory.getWoodTexture('billy_walnut_effect');
  const billyBlack = factory.getMaterial({ type: 'wood', variant: 'billy_black_oak_effect', color: '#24211e', roughness: .65, metalness: 0 }, { projection: 'local', foregroundOcclusion: false }) as THREE.MeshStandardMaterial;
  const panel = factory.getLambriTexture('bauhaus_61598007');
  await factory.textures.ready(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const read = (image: CanvasImageSource) => { ctx.drawImage(image, 0, 0, 512, 512); return ctx.getImageData(0, 0, 512, 512).data; };
  const stats = (data: Uint8ClampedArray | Uint8Array) => {
    const mean = [0, 0, 0]; let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) { for (let c = 0; c < 3; c++) mean[c] += data[i + c] / (data.length / 4); min = Math.min(min, data[i]); max = Math.max(max, data[i]); }
    return { mean: mean.map(value => Math.round(value)), variation: max - min };
  };
  const expected: Record<string, number[]> = { american_walnut: [84, 63, 49], smoked_walnut: [66, 54, 47], dark_wenge: [39, 32, 27], deep_chocolate_walnut: [57, 36, 26], espresso_walnut: [40, 26, 20], black_brown_wood: [27, 20, 16] };
  const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,256px);gap:14px'; document.body.append(grid);
  const report = [];
  for (const [i, finish] of FURNITURE_WOOD_FINISHES.entries()) {
    const material = materials[i], texture = material.map!, data = read(texture.image as CanvasImageSource), measured = stats(data);
    if (measured.variation < 8) throw new Error(`${finish.name} lost its grain`);
    if (expected[finish.id]) {
      if (measured.mean.some((v, c) => Math.abs(v - expected[finish.id][c]) > 1)) throw new Error(`${finish.name} has the wrong base tone: ${measured.mean}`);
    } else {
      const original = await new Promise<HTMLImageElement>((resolve, reject) => factory.textures.imageLoader().load(finish.imageUrl, resolve, undefined, reject));
      const originalData = read(original);
      if (data.some((value, pixel) => value !== originalData[pixel])) throw new Error(`${finish.name} changed unexpectedly`);
    }
    if (material.color.getHexString() !== 'ffffff' || texture.colorSpace !== THREE.SRGBColorSpace) throw new Error(`${finish.name} has a second tint or wrong colour space`);
    plane.material = material; view.update(scene, true); configureColorView(renderer, { surfaceColors: true }); renderer.render(scene, camera);
    const pixels = new Uint8Array(256 * 256 * 4); renderer.getContext().readPixels(0, 0, 256, 256, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
    const displayed = stats(pixels);
    if (displayed.mean.some((value, c) => Math.abs(value - measured.mean[c]) > 2)) throw new Error(`${finish.name} rendered too light/dark: ${displayed.mean} vs ${measured.mean}`);
    const card = document.createElement('div'), title = document.createElement('p'), snapshot = document.createElement('canvas');
    title.textContent = `${finish.name} · RGB ${measured.mean.join('/')}`; snapshot.width = snapshot.height = 256; snapshot.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    card.append(title, snapshot); grid.append(card); report.push({ variant: finish.variant, texture: measured, displayed, unchangedPhoto: !finish.matchTone });
  }
  if (factory.getWoodTexture('american_walnut') === factory.getWoodTexture('deep_chocolate_walnut') || factory.getWoodTexture('dark_wenge') === factory.getWoodTexture('black_brown_wood') || factory.getWoodTexture('american_walnut') === billy) throw new Error('Independent wood tones share a final texture');
  const billyTone = stats(read(billy.image as CanvasImageSource));
  if (billyTone.mean.some((value, c) => Math.abs(value - [157, 123, 91][c]) > 1)) throw new Error('BILLY finish changed');
  const blackTone = stats(read(billyBlack.map!.image as CanvasImageSource));
  if (blackTone.mean.some((value, c) => Math.abs(value - [36, 33, 30][c]) > 1) || blackTone.variation < 8) throw new Error('BILLY Black Oak lost its dark tone or grain');
  if (billyBlack.metalness !== 0 || billyBlack.color.getHexString() !== 'ffffff' || billyBlack.map!.colorSpace !== THREE.SRGBColorSpace) throw new Error('BILLY Black Oak has metal or double tint');
  plane.material = billyBlack; view.update(scene, true); configureColorView(renderer, { surfaceColors: true }); renderer.render(scene, camera);
  const blackPixels = new Uint8Array(256 * 256 * 4); renderer.getContext().readPixels(0, 0, 256, 256, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, blackPixels);
  if (stats(blackPixels).mean.some((value, c) => Math.abs(value - blackTone.mean[c]) > 2)) throw new Error('BILLY Black Oak rendered with the wrong tone');
  // The existing photo-matched slat tone and felt must also remain unchanged.
  const panelCanvas = panel.image as HTMLCanvasElement, panelCtx = panelCanvas.getContext('2d')!;
  const felt = Array.from(panelCtx.getImageData(110, 512, 1, 1).data).slice(0, 3);
  if (felt.some((value, c) => Math.abs(value - [170, 169, 159][c]) > 10)) throw new Error('Reference panel felt changed');
  const woodMean = [0, 0, 0]; let count = 0;
  for (let y = 40; y < 980; y += 5) for (let x = 3; x < 1024; x += 5) if (x % 128 > 2 && x % 128 < 77) { const p = panelCtx.getImageData(x, y, 1, 1).data; for (let c = 0; c < 3; c++) woodMean[c] += p[c]; count++; }
  if (woodMean.some((value, c) => Math.abs(value / count - [201, 176, 125][c]) > 8)) throw new Error('Reference panel wood changed');
  // Disposed finish textures must rebuild, never be returned stale from cache.
  const old = factory.getWoodTexture('dark_wenge'); old.dispose(); const replacement = factory.getWoodTexture('dark_wenge');
  if (replacement === old) throw new Error('Disposed wood texture was reused');
  await factory.textures.ready(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (stats(read(replacement.image as CanvasImageSource)).mean.some((v, c) => Math.abs(v - expected.dark_wenge[c]) > 1)) throw new Error('Cached grain failed to rebuild');
  view.dispose(); factory.dispose(); renderer.dispose(); plane.geometry.dispose();
  return { ok: true, woods: report, billyUnchanged: billyTone, billyBlack: blackTone, referencePanelUnchanged: true, rebuildPassed: true };
}
void check().then(result => { document.getElementById('results')!.textContent = JSON.stringify(result); }).catch(error => { document.getElementById('results')!.textContent = JSON.stringify({ ok: false, error: String(error) }); });
