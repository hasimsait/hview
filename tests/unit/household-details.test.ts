import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_DETAILS } from '../../src/domain/catalog/HouseholdDetails';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, FinishFurniture } from '../../src/application/commands/FurnitureCommands';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
function item(key: string, scale = 1) {
  const a = catalog.get(key)!;
  return codec.factory.furniture({ id: key, name: key, assetKey: key, displayName: a.name, category: 'decor', position: { x: 0, y: 0, z: 0 }, rotationY: 0,
    dimensions: { x: a.defaultDimensions.x * scale, y: a.defaultDimensions.y * scale, z: a.defaultDimensions.z * scale } });
}
function meshes(root: THREE.Object3D, section?: string) { const all: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh && (!section || o.userData.section === section)) all.push(o); }); return all; }

describe('household objects and practical details', () => {
  it.each(HOUSEHOLD_DETAILS)('$name fits its declared occupied space when resized', a => {
    for (const scale of [.7, 1, 1.4]) {
      const entity = item(a.key, scale), root = builder.build(entity), box = new THREE.Box3().setFromObject(root);
      expect(meshes(root).length).toBeGreaterThan(0);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(box.min[axis], `${a.key} minimum ${axis} at ${scale}`).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -entity.dimensions[axis] / 2) - .002);
        expect(box.max[axis], `${a.key} maximum ${axis} at ${scale}`).toBeLessThanOrEqual((axis === 'y' ? entity.dimensions.y : entity.dimensions[axis] / 2) + .002);
      }
    }
  });
  it('leaves toaster slots recessed below the surrounding rim', () => {
    const entity = item('detail_toaster'), root = builder.build(entity); root.updateMatrixWorld(true);
    for (const z of [-.22, .22]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(-.04 * entity.dimensions.x, entity.dimensions.y * 2, z * entity.dimensions.z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(root, true).find(hit => hit.object instanceof THREE.Mesh);
      expect(hit?.object.userData.section).toBe('Toast Slots');
      expect(hit!.point.y).toBeLessThan(entity.dimensions.y * .70);
    }
  });
  it('has open pipe and hose connections instead of solid cylinders', () => {
    for (const a of HOUSEHOLD_DETAILS.filter(a => ['pipe', 'hose', 'trap'].includes(a.householdDetail!.kind))) {
      const root = builder.build(item(a.key)), rims = meshes(root, 'Connection Rim');
      expect(rims.length).toBeGreaterThanOrEqual(2); expect(meshes(root, 'Inner Bore').length).toBeGreaterThan(0);
      for (const rim of rims) {
        expect(rim.geometry.type).toBe('RingGeometry');
        expect((rim.geometry as THREE.RingGeometry).parameters.innerRadius).toBeGreaterThan(0);
      }
    }
  });
  it('keeps cable diameter circular and constant when only route width changes', () => {
    const original = item('detail_cable_bent'), stretched = original.withDimensions({ ...original.dimensions, x: 1.6 });
    for (const entity of [original, stretched]) {
      const mesh = meshes(builder.build(entity), 'Cable')[0], parameters = (mesh.geometry as THREE.TubeGeometry).parameters;
      expect(parameters.radius).toBeCloseTo(.004);
      const positions = mesh.geometry.attributes.position, center = parameters.path.getPointAt(0);
      for (let i = 0; i <= parameters.radialSegments; i++) expect(new THREE.Vector3().fromBufferAttribute(positions, i).distanceTo(center)).toBeCloseTo(.004, 5);
    }
  });
  it('merges drain hose ribs and keyboard keys to avoid one draw call per detail', () => {
    const hose = builder.build(item('detail_hose_drain')), keyboard = builder.build(item('detail_keyboard'));
    expect(meshes(hose, 'Hose Ribs')).toHaveLength(1); expect(meshes(keyboard, 'Keys')).toHaveLength(1);
    expect(meshes(hose, 'Hose Ribs')[0].geometry.attributes.position.count).toBeGreaterThan(1000);
  });
  it('retains practical fittings, placement and independent finishes in both plan formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const a of HOUSEHOLD_DETAILS) editor.execute(new AddFurniture(item(a.key).withTransform({ x: 1.3, y: .2, z: 2.1 }, Math.PI / 2).toData()));
    editor.execute(new FinishFurniture('detail_panel_large', { type: 'paint', color: '#556677' }, 'Hatch'));
    for (const raw of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(raw);
      for (const a of HOUSEHOLD_DETAILS) expect(restored.requireFurniture(a.key).toData()).toMatchObject({ assetKey: a.key, position: { x: 1.3, y: .2, z: 2.1 }, dimensions: a.defaultDimensions });
      expect(restored.requireFurniture('detail_panel_large').sectionFinishes?.hatch.color).toBe('#556677');
    }
  });
  it('releases geometry and materials for repeated add and remove operations', () => {
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette })), baseline = resources.size;
    for (const a of HOUSEHOLD_DETAILS) { resources.ownTree(builder.build(item(a.key))).dispose(); expect(resources.size, a.key).toBe(baseline); }
    palette.dispose(); expect(resources.size).toBe(0);
  });
});
