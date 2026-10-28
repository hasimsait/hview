import * as THREE from 'three';
import { SurfaceMaterialFactory } from '../src/engine/materials/SurfaceMaterialFactory';
import { configureColorView, SurfaceColorView } from '../src/engine/materials/SurfaceColorView';

async function check() {
  document.body.insertAdjacentHTML('afterbegin', '<h1>Surface colour comparison</h1><p>Wood faces, accent paint and long-wall paint share the same input colour.<br>Comparison view removes lighting and exposure; felt and grain stay visible.</p>');
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(640, 320); renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.append(renderer.domElement);
  const factory = new SurfaceMaterialFactory(), view = new SurfaceColorView(), scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.36, .36, .18, -.18, .01, 10); camera.position.z = 5;
  scene.background = new THREE.Color('#0f172a');
  const meshes = [0, 1, 2].map(index => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.19, .26)); mesh.position.x = (index - 1) * .24;
    mesh.rotation.y = [0, .42, -.5][index]; factory.ensureLocalMetricBounds(mesh); scene.add(mesh); return mesh;
  });
  // Different wall angles should not change their base colours in comparison view.
  scene.add(new THREE.AmbientLight('#fff0d8', 3));
  const sun = new THREE.DirectionalLight('#fff4df', 4); sun.position.set(-2, 1, 3); scene.add(sun);
  const pixels = new Uint8Array(640 * 320 * 4);
  const dominant = (index: number) => {
    const counts = new Map<string, number>(), centre = (index + .5) * 640 / 3;
    for (let y = 105; y < 215; y++) for (let x = Math.floor(centre - 48); x < centre + 48; x++) {
      const offset = (y * 640 + x) * 4, key = Array.from(pixels.slice(offset, offset + 3)).join(','); counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  };
  const results = [];
  for (const color of ['#864954', '#ece5d4', '#bda078']) {
    for (const [index, type] of (['lambri', 'paint', 'plaster'] as const).entries()) {
      meshes[index].material = factory.getMaterial({ type, variant: type === 'lambri' ? 'oak_slats' : undefined, color }, { projection: 'local', foregroundOcclusion: false });
    }
    configureColorView(renderer, { surfaceColors: true, toneMapping: 'aces', exposure: .125 }); view.update(scene, true);
    renderer.render(scene, camera); renderer.getContext().readPixels(0, 0, 640, 320, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
    const expected = color.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16)), measured = meshes.map((_, i) => dominant(i));
    for (const actual of measured) if (actual.some((v, i) => Math.abs(v - expected[i]) > 2)) throw new Error(`sRGB mismatch ${color}: ${JSON.stringify(measured)} expected ${expected}`);
    results.push({ color, measured });
    const section = document.createElement('section');
    const title = document.createElement('h2'); title.textContent = `${color} — wood faces / accent wall / long wall`;
    const snapshot = document.createElement('canvas'); snapshot.width = 640; snapshot.height = 320;
    snapshot.getContext('2d')!.drawImage(renderer.domElement, 0, 0); section.append(title, snapshot); document.body.append(section);
  }
  // An explicit panel wood override must keep real grain, change its mean tone,
  // retain its chosen felt and survive the material cache.
  const a = factory.getLambriTexture('bauhaus_61598007', '#ffffff', '#113355', '#864954');
  const b = factory.getLambriTexture('bauhaus_61598007', '#ffffff', '#113355', '#bda078');
  await factory.textures.ready(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const means = [a, b].map(texture => {
    const canvas = texture.image as HTMLCanvasElement, ctx = canvas.getContext('2d')!, data = ctx.getImageData(0, 0, 1024, 1024).data;
    const values: number[] = [], sum = [0, 0, 0]; let count = 0;
    for (let y = 40; y < 980; y += 5) for (let x = 3; x < 1024; x += 5) if (x % 128 > 2 && x % 128 < 77) {
      const at = (y * 1024 + x) * 4; for (let c = 0; c < 3; c++) sum[c] += data[at + c]; values.push(data[at]); count++;
    }
    if (Math.max(...values) - Math.min(...values) < 12) throw new Error('Wood override lost its photographic grain');
    return { mean: sum.map(s => Math.round(s / count)), felt: Array.from(ctx.getImageData(110, 512, 1, 1).data).slice(0, 3) };
  });
  for (const [index, expected] of [[134, 73, 84], [189, 160, 120]].entries()) if (means[index].mean.some((v, c) => Math.abs(v - expected[c]) > 8)) throw new Error(`Incorrect wood tone: ${JSON.stringify(means)}`);
  if (JSON.stringify(means[0].felt) !== JSON.stringify(means[1].felt)) throw new Error('Changing wood also changed felt');
  view.update(scene, false); configureColorView(renderer, { toneMapping: 'neutral', exposure: 1 }); renderer.render(scene, camera);
  const lit = new Uint8Array(640 * 320 * 4); renderer.getContext().readPixels(0, 0, 640, 320, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, lit);
  if (lit.every((v, i) => v === pixels[i])) throw new Error('Room lighting was not restored');
  view.dispose(); factory.dispose(); renderer.dispose(); renderer.domElement.remove();
  return { ok: true, displayPixels: results, woodOverrides: means, lightingRestored: true };
}
void check().then(result => { document.getElementById('results')!.textContent = JSON.stringify(result); }).catch(error => { document.getElementById('results')!.textContent = JSON.stringify({ ok: false, error: String(error) }); });
