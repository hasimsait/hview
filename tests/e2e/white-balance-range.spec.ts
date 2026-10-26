import { expect, test } from '@playwright/test';

// Exercise the real GPU target, not just the adaptation matrix or lamp settings.
test('small physical spot emitters stay bright and finite through viewing adaptation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__hdr_review__', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('/__hdr_review__');
  const results = await page.evaluate(async () => {
    const module = (path: string) => import(path);
    const THREE = await module('/node_modules/three/build/three.module.js');
    const { PlanCodec } = await module('/src/domain/codec/PlanCodec.ts');
    const { FurnitureMeshBuilder } = await module('/src/engine/assets/FurnitureMeshBuilder.ts');
    const { FurnitureAppearance } = await module('/src/engine/materials/FurnitureAppearance.ts');
    const { ResourcePool } = await module('/src/engine/resources/ResourcePool.ts');
    const { WhiteBalancePass } = await module('/src/engine/lighting/WhiteBalance.ts');
    const codec = new PlanCodec(), asset = codec.factory.catalog.get('lighting_spot_single');
    const builder = new FurnitureMeshBuilder(codec.factory.catalog); builder.setForegroundMode('off');
    const resources = new ResourcePool();
    const appearance = new FurnitureAppearance({}, resources, () => ({ spotLightIntensity: 1, chandelierIntensity: 1 }), () => undefined);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('black');
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(64, 64);
    renderer.toneMapping = THREE.NeutralToneMapping;
    const camera = new THREE.OrthographicCamera(-.06, .06, .06, -.06, .01, 10);
    camera.position.set(0, -1, 0); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);
    const pass = new WhiteBalancePass(), gl = renderer.getContext(), results = [];
    try {
      for (const lumens of [806, 100000]) for (const temperature of [2700, 3500, 6500]) {
        const item = codec.factory.furniture({ id: 'spot', name: asset.key, displayName: asset.name, assetKey: asset.key,
          category: asset.category, dimensions: asset.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0,
          lightConfig: { lumens, temperatureKelvin: temperature } });
        const root = builder.build(item); appearance.apply(root, item); scene.add(root);
        const lease = resources.ownTree(root);
        for (const kelvin of [6500, temperature]) for (const adaptation of [0, .5, 1]) {
          renderer.toneMappingExposure = 1 / 64;
          pass.render(renderer, scene, camera, kelvin, adaptation);
          const pixel = new Uint8Array(4); gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          results.push({ lumens, temperature, kelvin, adaptation, pixel: [...pixel], error: gl.getError() });
        }
        scene.remove(root); lease.dispose();
      }
    } finally { pass.dispose(); renderer.dispose(); }
    return results;
  });
  for (const result of results) {
    expect(result.error, JSON.stringify(result)).toBe(0);
    expect(Math.min(...result.pixel.slice(0, 3)), JSON.stringify(result)).toBeGreaterThan(240);
  }
  expect(errors).toEqual([]);
});
