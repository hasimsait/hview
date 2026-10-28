import * as THREE from 'three';
import { PlanDocument } from '../src/domain/model/PlanDocument';
import { Wall } from '../src/domain/elements/Wall';
import { Door } from '../src/domain/elements/Opening';
import { Luminaire } from '../src/domain/elements/Furniture';
import { RoomFixtureLighting } from '../src/engine/lighting/RoomFixtureLighting';
import { Room } from '../src/domain/elements/Room';
import { SceneLighting } from '../src/engine/lighting/SceneLighting';
import { WhiteBalancePass } from '../src/engine/lighting/WhiteBalance';
import { addFixtureLight, addStripAreaLight } from '../src/engine/lighting/FixtureLight';
import { configureColorView } from '../src/engine/materials/SurfaceColorView';
import { FurnitureAppearance } from '../src/engine/materials/FurnitureAppearance';
import { SurfaceMaterialFactory } from '../src/engine/materials/SurfaceMaterialFactory';
import { OpeningMeshBuilder } from '../src/engine/geometry/OpeningMeshBuilder';
import { ResourcePool } from '../src/engine/resources/ResourcePool';
import type { ViewportSettings } from '../src/core/types/services';

async function check() {
  document.body.insertAdjacentHTML('afterbegin', '<h1>Night lighting regression</h1><p>Kumru / Günbatımı · 806 lm · fixed indoor exposure · 3500 K unless labelled otherwise</p>');
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(640, 320); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1.6, 1.6, .8, -.8, .01, 20);
  camera.position.set(0, 1.4, 1.8); camera.lookAt(0, 1.4, 0);
  const settings = { globalLighting: false, globalLightIntensity: 1, viewMode: 'perspective', chandelierIntensity: 1, spotLightIntensity: 1 } as ViewportSettings;
  const lights = new SceneLighting(scene); lights.update(settings); configureColorView(renderer, settings);
  const exposure = renderer.toneMappingExposure;
  const factory = new SurfaceMaterialFactory(), roomLighting = new RoomFixtureLighting(), balance = new WhiteBalancePass();
  const resources = new ResourcePool(), appearance = new FurnitureAppearance(factory, resources, () => settings, () => undefined);
  const shades = [{ name: 'KUMRU', color: '#eae2d1' }, { name: 'GÜNBATIMI', color: '#864954' }];
  shades.forEach((shade, i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), factory.getMaterial({ type: 'paint', color: shade.color }, { foregroundOcclusion: false }));
    mesh.position.set(i ? .65 : -.65, 1.4, 0); scene.add(mesh);
  });
  const local = new THREE.Group(), neighbour = new THREE.Group(); scene.add(local, neighbour);
  addFixtureLight(local, [0, 1.4, .8], 20, 9, 'chandelier');
  const other = addFixtureLight(neighbour, [0, 1.4, 3.2], 20, 9, 'chandelier');
  const lamp = new Luminaire({ id: 'lamp', name: 'Lamp', displayName: 'Lamp', assetKey: 'chandelier', category: 'decor', position: { x: 0, y: 0, z: 0 }, dimensions: { x: .5, y: .5, z: .5 }, rotationY: 0, lightConfig: { temperatureKelvin: 3500, lumens: 806 } });
  const wall = new Wall({ id: 'partition', p1: { x: -3, y: 2 }, p2: { x: 3, y: 2 }, height: 3, thickness: .2, material: 'brick', openings: [] }, []);
  const rooms = [new Room({ id: 'bedroom', name: 'Bedroom', area: 18, height: 3, polygon: [{ x: -3, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 2 }, { x: -3, y: 2 }] }),
    new Room({ id: 'next-room', name: 'Next room', area: 18, height: 3, polygon: [{ x: -3, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }, { x: -3, y: 5 }] })];
  const plan = new PlanDocument([wall, ...rooms]); roomLighting.rebuild(plan); roomLighting.update(scene);
  const pixels = new Uint8Array(640 * 320 * 4), results: Record<string, unknown> = {};
  const record = (name: string, kelvin = 3500, adaptation = .5) => {
    roomLighting.update(scene);
    balance.render(renderer, scene, camera, kelvin, adaptation);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 640, 320, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const measured = [-.65, .65].map(x => {
      const centre = Math.round((x / 3.2 + .5) * 640), sum = [0, 0, 0]; let count = 0;
      for (let y = 145; y < 175; y++) for (let x = centre - 15; x < centre + 15; x++) {
        const offset = (y * 640 + x) * 4; for (let c = 0; c < 3; c++) sum[c] += pixels[offset + c]; count++;
      }
      return sum.map(v => Math.round(v / count));
    });
    const section = document.createElement('section'), title = document.createElement('h2'), snapshot = document.createElement('canvas');
    title.textContent = `${name}: ${JSON.stringify(measured)}`; snapshot.width = 640; snapshot.height = 320;
    snapshot.getContext('2d')!.drawImage(renderer.domElement, 0, 0); section.append(title, snapshot); document.body.append(section);
    results[name] = measured; return measured;
  };
  appearance.applyLighting(local, lamp.withEmission({ intensity: 0 })); appearance.applyLighting(neighbour, lamp);
  const dark = record('Chandelier at zero, neighbour on');
  if (dark.flat().some(c => c > 1)) throw new Error('Neighbour light leaked through solid partition');
  // Every fixture type is confined to its room, without shadow maps.
  other.visible = false;
  const spot = addFixtureLight(neighbour, [0, 1.4, 3.2], 30, 9, 'spot', [0, 0, -1]);
  const area = addStripAreaLight(neighbour, [0, 1.4, 3.2], 1, .2); area.rotation.set(0, 0, 0); area.power = 806;
  roomLighting.update(scene);
  if (record('Neighbour spot and area blocked').flat().some(c => c > 1)) throw new Error('Spot or area light leaked through solid partition');
  spot.visible = area.visible = false; other.visible = true;
  appearance.applyLighting(local, lamp);
  const warm = record('3500 K, own chandelier on');
  if (warm[0][1] - warm[1][1] < 35 || warm[1][0] > 190) throw new Error('Dark paint washed out at fixed indoor exposure');
  appearance.applyLighting(local, lamp.withEmission({ temperatureKelvin: 6500 }));
  const cool = record('6500 K, same lumens and exposure', 6500);
  if (warm[0][0] / warm[0][2] <= cool[0][0] / cool[0][2]) throw new Error('3500 K did not retain warmth at partial adaptation');
  appearance.applyLighting(local, lamp.withEmission({ enabled: false }));
  const doorway = new Door({ id: 'door', type: 'door', wallId: wall.id, width: 2.5, height: 2.3, floorHeight: 0, distanceAlongWall: 3, position: { x: 0, y: 2 }, openAngle: 0 });
  const withDoor = wall.withOpenings([doorway]), doorPlan = new PlanDocument([withDoor, ...rooms]);
  roomLighting.rebuild(doorPlan);
  if (record('Open aperture keeps room isolation').flat().some(c => c > 1)) throw new Error('Light crossed room boundary through an aperture');
  const openingBuilder = new OpeningMeshBuilder(factory), leaf = openingBuilder.buildOpening(doorway, withDoor); scene.add(leaf);
  roomLighting.rebuild(doorPlan); roomLighting.update(scene);
  if (record('Closed door blocks neighbour light').flat().some(c => c > 1)) throw new Error('Closed door leaked light');
  const open = doorway.withOpenAngle(90); openingBuilder.update(leaf, open);
  roomLighting.rebuild(new PlanDocument([wall.withOpenings([open]), ...rooms]));
  if (record('Open door keeps room isolation').flat().some(c => c > 1)) throw new Error('Light crossed room boundary through an open door');
  scene.remove(leaf);
  roomLighting.rebuild(plan); appearance.applyLighting(neighbour, lamp.withEmission({ enabled: false }));
  if (record('All lamps off').flat().some(c => c > 1)) throw new Error('Night still has artificial ambient fill');
  if (renderer.toneMappingExposure !== exposure) throw new Error('Exposure changed while switching lamps');
  roomLighting.dispose(); balance.dispose(); lights.dispose(); factory.dispose(); renderer.dispose();
  return { ok: true, exposure, results };
}
void check().then(result => { document.getElementById('results')!.textContent = JSON.stringify(result); }).catch(error => { document.getElementById('results')!.textContent = JSON.stringify({ ok: false, error: String(error) }); });
