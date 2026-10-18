import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { POPULAR_PRODUCTS } from '../../src/domain/catalog/PopularProducts';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
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

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const item = (asset: AssetDefinition) => codec.factory.furniture({ id: asset.key, name: asset.key, assetKey: asset.key,
  category: asset.category as FurnitureCategory, displayName: asset.name, position: { x: 0, y: 0, z: 0 }, rotationY: 0, dimensions: asset.defaultDimensions });

describe('Popular Products catalogue', () => {
  it('keeps 83 unique editable assets across 14 collections', () => {
    expect(POPULAR_PRODUCTS).toHaveLength(83);
    expect(new Set(POPULAR_PRODUCTS.map(a => a.key)).size).toBe(83);
    expect(new Set(POPULAR_PRODUCTS.map(a => a.collection)).size).toBe(14);
    for (const asset of POPULAR_PRODUCTS) {
      expect(catalog.get(asset.key)).toEqual(asset);
      expect(asset.source).toEqual({ retailer: 'Popular Products' });
      expect(asset.name).not.toMatch(/kitaplık|rafli|koltuk|sehpa|gardırop|beyaz|ceviz|çalışma|çekmece|sandalye|lambader|[ıİşŞğĞ]/);
      expect(asset.description).toBeUndefined();
      expect(catalog.recipe(asset.key)).toBe('retail_furniture');
    }
    expect(catalog.all().filter(a => a.key === 'retail_furniture')).toHaveLength(0);
  });

  it.each([POPULAR_PRODUCTS[0], POPULAR_PRODUCTS.find(a => a.capabilities?.lighting)!])('migrates earlier product prefixes for $name without changing saved identity or dimensions', asset => {
    const original = item(asset), oldKey = `archived_${asset.key.slice('popular_'.length)}`;
    const raw = rawPlan();
    Object.assign(raw.plan.items, { imported: { name: oldKey, assetKey: oldKey, dimensions: original.dimensions, pc: { x: 100, y: 100 } } });
    expect(codec.decode(raw).requireFurniture('imported').assetKey).toBe(asset.key);
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan())); editor.execute(new AddFurniture(original.toData()));
    const envelope = JSON.parse(codec.encode(editor.getDocument()));
    const entry = envelope.document.elements.find((e: { data: { id: string } }) => e.data.id === original.id); entry.data.assetKey = oldKey;
    const restored = codec.decode(envelope).requireFurniture(original.id);
    expect(restored.assetKey).toBe(asset.key); expect(restored.dimensions).toEqual(original.dimensions);
    expect(restored instanceof Luminaire).toBe(original instanceof Luminaire);
  });

  it('preserves dimensions, wall placement and overall bed footprints', () => {
    const byCode = (id: string) => POPULAR_PRODUCTS.find(a => a.key === `popular_${id}`)!;
    expect(byCode('23749091').defaultDimensions).toEqual({ x: 1.2, z: .44, y: 1.74 });
    expect(byCode('63214012')).toMatchObject({ defaultDimensions: { x: .39, z: .2, y: 1.6 } });
    expect(byCode('14359445')).toMatchObject({ defaultDimensions: { x: .56, z: .2, y: 1.08 } });
    expect(byCode('84595046').placement).toMatchObject({ mount: 'wall', defaultElevation: .15 });
    expect(byCode('2216361840').defaultDimensions.x).toBeGreaterThan(1.6);
  });

  it.each(POPULAR_PRODUCTS)('$name builds paintable component geometry inside its planning envelope', asset => {
    const entity = item(asset), root = builder.build(entity), bounds = new THREE.Box3().setFromObject(root);
    const sections = new Set<string>(); let lights = 0;
    root.traverse(child => { if (child instanceof THREE.Mesh) sections.add(child.userData.section); if (child instanceof THREE.PointLight) lights++; });
    expect(sections.size).toBeGreaterThanOrEqual(2);
    expect(lights).toBe(asset.furnitureProduct!.kind === 'floor_lamp' ? 1 : 0);
    expect(entity instanceof Luminaire).toBe(asset.furnitureProduct!.kind === 'floor_lamp');
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(bounds.min[axis], `minimum ${axis}`).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -asset.defaultDimensions[axis] / 2) - .001);
      expect(bounds.max[axis], `maximum ${axis}`).toBeLessThanOrEqual((axis === 'y' ? asset.defaultDimensions[axis] : asset.defaultDimensions[axis] / 2) + .001);
    }
  });

  it('preserves product identity, sizes, finishes, position and lamp settings in both plan formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const asset of POPULAR_PRODUCTS) editor.execute(new AddFurniture(item(asset).toData()));
    const first = POPULAR_PRODUCTS[0], lamp = POPULAR_PRODUCTS.find(a => a.capabilities?.lighting)!;
    editor.execute(new FinishFurniture(first.key, { type: 'paint', color: '#9f7547' }, 'Shelves'));
    editor.execute(new TransformFurniture(first.key, { x: 1, y: .1, z: 2 }, .4, { x: .5, y: 1.7, z: .3 }));
    editor.execute(new SetLightIntensity(lamp.key, .25));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded);
      for (const asset of POPULAR_PRODUCTS.slice(1)) expect((restored.get(asset.key) as Furniture).toData()).toMatchObject({ assetKey: asset.key, displayName: asset.name, dimensions: asset.defaultDimensions });
      expect((restored.get(first.key) as Furniture).toData()).toMatchObject({ dimensions: { x: .5, y: 1.7, z: .3 }, position: { x: 1, y: .1, z: 2 }, sectionFinishes: { shelves: { color: '#9f7547' } } });
      expect(restored.get(lamp.key)).toBeInstanceOf(Luminaire);
      expect((restored.get(lamp.key) as Luminaire).intensity).toBe(.25);
    }
    editor.undo(); editor.undo();
    expect((editor.getDocument().get(first.key) as Furniture).dimensions).toEqual(first.defaultDimensions);
  });

  it('releases component geometry and custom colours without disposing the shared palette', () => {
    const resources = new ResourcePool();
    const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = resources.size;
    for (const asset of POPULAR_PRODUCTS) {
      const lease = resources.ownTree(builder.build(item(asset))); lease.dispose();
      expect(resources.size).toBe(baseline);
    }
    palette.dispose(); expect(resources.size).toBe(0);
  });
});
