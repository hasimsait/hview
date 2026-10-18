import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { IKEA_ACCESSORIES } from '../../src/domain/catalog/IkeaAccessories';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { Furniture, Luminaire } from '../../src/domain/elements/Furniture';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, FinishFurniture, SetLightIntensity, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import type { AssetDefinition } from '../../src/domain/catalog/AssetDefinition';
import type { FurnitureCategory } from '../../src/domain/model/PlanData';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog);
function item(asset: AssetDefinition) {
  return codec.factory.furniture({ id: asset.key, name: asset.key, displayName: asset.name, assetKey: asset.key,
    category: asset.category as FurnitureCategory, dimensions: asset.defaultDimensions,
    position: { x: 0, y: asset.placement?.defaultElevation ?? 0, z: 0 }, rotationY: 0 });
}

describe('IKEA accessory catalogue', () => {
  it('offers over 390 distinct sourced products across 40 accessory collections', () => {
    expect(IKEA_ACCESSORIES.length).toBeGreaterThanOrEqual(390);
    expect(new Set(IKEA_ACCESSORIES.map(asset => asset.collection)).size).toBeGreaterThanOrEqual(40);
    expect(new Set(IKEA_ACCESSORIES.map(asset => asset.source?.productCode)).size).toBe(IKEA_ACCESSORIES.length);
    for (const asset of IKEA_ACCESSORIES) {
      expect(catalog.get(asset.key)).toEqual(asset);
      expect(asset.name).toMatch(/^IKEA /);
      expect(asset.source?.url).toMatch(/^https:\/\/www\.ikea\.com(?:\.tr)?\//);
      expect(asset.source?.productCode).toMatch(/^\d{8}$/);
      expect(asset.placement?.mount).toBeTruthy();
      if (asset.source?.dimensions === 'estimated') expect(asset.source.dimensionNotes!.length).toBeGreaterThan(15);
      expect(asset.name).not.toMatch(/sabun|havlu|firca|alcipan|kitaplik/i);
    }
  });

  const builder = new FurnitureMeshBuilder(catalog);
  it.each(IKEA_ACCESSORIES)('$name builds editable geometry inside its planning dimensions', asset => {
    const entity = item(asset), model = builder.build(entity);
    const bounds = new THREE.Box3().setFromObject(model), dimensions = asset.defaultDimensions;
    const meshSections = new Set<string>();
    model.traverse(child => { if (child instanceof THREE.Mesh) meshSections.add(child.userData.section); });
    expect(meshSections.size).toBeGreaterThan(0);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(bounds.min[axis], `minimum ${axis}`).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -dimensions[axis] / 2) - .001);
      expect(bounds.max[axis], `maximum ${axis}`).toBeLessThanOrEqual((axis === 'y' ? dimensions[axis] : dimensions[axis] / 2) + .001);
    }
    const lights: THREE.PointLight[] = [];
    model.traverse(child => { if (child instanceof THREE.PointLight) lights.push(child); });
    expect(entity instanceof Luminaire).toBe(Boolean(asset.capabilities?.lighting));
    expect(lights.length).toBe(entity instanceof Luminaire ? 1 : 0);
  });

  it('saves all product keys, sizes, placement, finishes and lamp settings in both plan formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const asset of IKEA_ACCESSORIES) editor.execute(new AddFurniture(item(asset).toData()));
    const lamp = IKEA_ACCESSORIES.find(asset => asset.accessory?.kind === 'mushroom_lamp')!;
    editor.execute(new SetLightIntensity(lamp.key, .35));
    const vase = IKEA_ACCESSORIES[0];
    editor.execute(new FinishFurniture(vase.key, { type: 'glass', color: '#557788' }, 'Body'));
    editor.execute(new TransformFurniture(vase.key, { x: 1, y: 1.2, z: 2 }, .7, { x: .2, y: .3, z: .2 }));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded);
      for (const asset of IKEA_ACCESSORIES.slice(1)) expect((restored.get(asset.key) as Furniture).toData(), asset.key).toMatchObject({ assetKey: asset.key, displayName: asset.name, dimensions: asset.defaultDimensions });
      expect(restored.get(lamp.key)).toBeInstanceOf(Luminaire);
      expect(restored.get(lamp.key)).toMatchObject({ intensity: .35 });
      expect(restored.get(vase.key)).toMatchObject({ position: { x: 1, y: 1.2, z: 2 }, dimensions: { x: .2, y: .3, z: .2 }, sectionFinishes: { body: { color: '#557788' } } });
    }
    editor.undo(); expect(editor.getDocument().get(vase.key)).toMatchObject({ dimensions: vase.defaultDimensions });
  });

  it('releases accessory geometry and custom colour materials while preserving the shared palette', () => {
    const resources = new ResourcePool();
    const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = resources.size;
    for (const asset of IKEA_ACCESSORIES) {
      const lease = resources.ownTree(builder.build(item(asset)));
      expect(resources.size).toBeGreaterThan(baseline);
      lease.dispose();
      expect(resources.size).toBe(baseline);
    }
    palette.dispose(); expect(resources.size).toBe(0);
  });

  it('keeps powder-coated whites diffuse and mirror faces ahead of their backing', () => {
    const trolley = builder.build(item(IKEA_ACCESSORIES.find(a => a.source?.productCode === '30586783')!));
    const surfaces: THREE.MeshStandardMaterial[] = [];
    trolley.traverse(child => { if (child instanceof THREE.Mesh && child.userData.section === 'Shelves') surfaces.push(child.material as THREE.MeshStandardMaterial); });
    expect(surfaces.length).toBeGreaterThan(0);
    for (const mat of surfaces) {
      expect(mat.color.getHexString()).toBe('f4f1e9');
      expect(mat.metalness).toBeLessThan(.3);
    }
    const mirror = builder.build(item(IKEA_ACCESSORIES.find(a => a.source?.productCode === '70590448')!));
    const frame = mirror.children.find(c => c.userData.section === 'Frame')!;
    const face = mirror.children.find(c => c.userData.section === 'Mirror')!;
    expect(new THREE.Box3().setFromObject(face).min.z).toBeGreaterThan(new THREE.Box3().setFromObject(frame).max.z);
  });
});
