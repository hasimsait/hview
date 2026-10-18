import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARCHITECTURAL_FINISHES } from '../../src/domain/catalog/ArchitecturalFinishes';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import type { AssetDefinition } from '../../src/domain/catalog/AssetDefinition';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { Furniture } from '../../src/domain/elements/Furniture';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, FinishFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const entity = (a: AssetDefinition, scale = 1) => codec.factory.furniture({ id: a.key, name: a.key, assetKey: a.key,
  displayName: a.name, category: 'architecture', position: { x: 0, y: 0, z: 0 }, rotationY: 0,
  dimensions: { x: a.defaultDimensions.x * scale, y: a.defaultDimensions.y * scale, z: a.defaultDimensions.z * scale } });
function built(key: string) { return builder.build(entity(catalog.get(`finish_${key}`)!)); }
function hits(object: THREE.Object3D, x: number, y: number) {
  object.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(object, true)
    .filter(hit => hit.object instanceof THREE.Mesh);
}

describe('architectural finishes', () => {
  it('registers all eight requested families with editable generic dimensions and placement', () => {
    expect(ARCHITECTURAL_FINISHES).toHaveLength(24);
    expect(new Set(ARCHITECTURAL_FINISHES.map(a => a.key)).size).toBe(24);
    expect(new Set(ARCHITECTURAL_FINISHES.map(a => a.collection)).size).toBe(8);
    for (const a of ARCHITECTURAL_FINISHES) {
      expect(catalog.recipe(a.key)).toBe('architectural_finish');
      expect(a).toMatchObject({ category: 'architecture', capabilities: { resizable: true }, source: { retailer: 'Generic', dimensions: 'reference' } });
      if (a.placement?.mount === 'ceiling') expect(a.placement.ceilingOffset).toBe(a.defaultDimensions.y);
      if (a.placement?.mount !== 'floor') expect(a.placement?.wallOffset).toBeCloseTo(a.defaultDimensions.z / 2 + .001);
    }
    // The existing reference pelmet remains available under its saved key.
    expect(catalog.get('curtain_pelmet')).toMatchObject({ category: 'architecture', collection: 'Curtain pelmets', recipe: 'curtain_pelmet' });
  });

  it.each(ARCHITECTURAL_FINISHES)('$name builds a complete metric envelope at default and resized dimensions', a => {
    for (const scale of [.65, 1, 1.6]) {
      const item = entity(a, scale), root = builder.build(item), bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(size[axis]).toBeCloseTo(item.dimensions[axis], 4);
        expect(bounds.min[axis]).toBeCloseTo(axis === 'y' ? 0 : -item.dimensions[axis] / 2, 4);
      }
      root.traverse(child => { if (child instanceof THREE.Mesh) expect(child.userData.section).toBeTruthy(); });
    }
  });

  it('keeps door and decorative frame centres open, including after resizing', () => {
    for (const style of ['flat', 'stepped', 'fluted']) {
      const a = catalog.get(`finish_architrave_${style}`)!;
      for (const scale of [1, 1.5]) {
        const item = entity(a, scale), mesh = builder.build(item);
        expect(hits(mesh, 0, item.dimensions.y / 2)).toHaveLength(0);
        expect(hits(mesh, item.dimensions.x / 2 - .035, item.dimensions.y / 2).length).toBeGreaterThan(0);
        expect(hits(mesh, 0, item.dimensions.y - .035).length).toBeGreaterThan(0);
        expect(hits(mesh, 0, .01)).toHaveLength(0);
      }
    }
    const frame = built('moulding_frame');
    expect(hits(frame, 0, .5)).toHaveLength(0);
    expect(hits(frame, .34, .5).length).toBeGreaterThan(0);
    expect(hits(frame, 0, .01).length).toBeGreaterThan(0);
  });

  it('builds hollow pelmets with open backs and undersides and optional end returns', () => {
    for (const style of ['flat', 'stepped', 'returned']) {
      const root = built(`pelmet_${style}`); root.updateMatrixWorld(true);
      const origin = new THREE.Vector3(0, .05, 0);
      for (const direction of [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)]) {
        expect(new THREE.Raycaster(origin, direction).intersectObject(root, true).filter(hit => hit.object instanceof THREE.Mesh)).toHaveLength(0);
      }
      const returns: THREE.Object3D[] = [];
      root.traverse(child => { if (child.userData.section === 'End Returns') returns.push(child); });
      expect(returns).toHaveLength(style === 'returned' ? 2 : 0);
    }
  });

  it('retains category, position, dimensions and separate finishes in both plan formats, with undo', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const a of ARCHITECTURAL_FINISHES) editor.execute(new AddFurniture(entity(a).toData()));
    const key = 'finish_panelling_slatted';
    editor.execute(new FinishFurniture(key, { type: 'wood', color: '#ad845c' }, 'Slats'));
    editor.execute(new FinishFurniture(key, { type: 'paint', color: '#111111' }, 'Backing'));
    editor.execute(new TransformFurniture(key, { x: 2, y: .2, z: 1 }, Math.PI / 2, { x: 1.3, y: 2.6, z: .03 }));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded);
      for (const a of ARCHITECTURAL_FINISHES) expect(restored.get(a.key)).toBeInstanceOf(Furniture);
      expect((restored.get(key) as Furniture).toData()).toMatchObject({ category: 'architecture', assetKey: key,
        position: { x: 2, y: .2, z: 1 }, dimensions: { x: 1.3, y: 2.6, z: .03 },
        sectionFinishes: { slats: { type: 'wood', color: '#ad845c' }, backing: { color: '#111111' } } });
    }
    editor.undo(); expect(editor.getDocument().requireFurniture(key).dimensions).toEqual(catalog.get(key)!.defaultDimensions);
  });

  it('releases finish geometry and materials through the resource pool', () => {
    const pool = new ResourcePool();
    const palette = pool.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = pool.size;
    for (const a of ARCHITECTURAL_FINISHES) {
      const lease = pool.ownTree(builder.build(entity(a))); lease.dispose(); expect(pool.size).toBe(baseline);
    }
    palette.dispose(); expect(pool.size).toBe(0);
  });
});
