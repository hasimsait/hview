import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IKEA_KITCHEN_PRODUCTS } from '../../src/domain/catalog/IkeaKitchenProducts';
import { IKEA_ACCESSORIES } from '../../src/domain/catalog/IkeaAccessories';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const article = (code: string) => catalog.get(`ikea_${code}`)!;
const entity = (code: string, dimensions = article(code).defaultDimensions) => codec.factory.furniture({ id: code, name: article(code).key, assetKey: article(code).key, displayName: article(code).name, category: 'kitchen', dimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });

describe('IKEA Türkiye kitchenware', () => {
  it('adds individually referenced English articles without replacing existing catalogue objects', () => {
    expect(IKEA_KITCHEN_PRODUCTS.length).toBeGreaterThanOrEqual(220);
    expect(new Set(IKEA_KITCHEN_PRODUCTS.map(a => a.key)).size).toBe(IKEA_KITCHEN_PRODUCTS.length);
    for (const asset of IKEA_KITCHEN_PRODUCTS) {
      expect(IKEA_ACCESSORIES.some(old => old.key === asset.key)).toBe(false);
      expect(asset.source?.productCode).toMatch(/^\d{8}$/);
      expect(asset.source?.url).toMatch(new RegExp(`^https://www\\.ikea\\.com\\.tr/en/.*${asset.source!.productCode}$`));
      expect(asset.name).not.toMatch(/\b(tabak|bardak|tencere|kaşık|cam|zuccaciye|dolap)\b/i);
      expect(asset.source?.dimensionNotes).toBeTruthy();
      expect(asset.source?.dimensions).toBe(/estimated/i.test(asset.source!.dimensionNotes!) ? 'estimated' : 'listed');
      expect(catalog.recipe(asset.key)).toBe('kitchenware');
      expect(asset.placement?.mount).toBe('surface');
    }
  });

  it('uses overall handles, millimetre conversions and individual multipack sizes for cabinet clearances', () => {
    expect(article('00545218').defaultDimensions).toEqual({ x: .43, y: .04, z: .24 });
    expect(article('60463686').defaultDimensions).toEqual({ x: .56, y: .05, z: .32 });
    expect(article('09500890').defaultDimensions).toEqual({ x: .516, y: .05, z: .495 });
    expect(article('10597103')).toMatchObject({ defaultDimensions: { x: .14, y: .06, z: .14 }, source: { dimensions: 'listed' } });
    expect(article('10597103').description).toContain('One piece');
    expect(article('10597103').description).toContain('3 pieces');
    expect(article('10279723').source).toMatchObject({ dimensions: 'estimated' });
    expect(article('10279723').source!.dimensionNotes).toContain('handle projection');
    expect(article('30598489').kitchenware?.kind).toBe('utensil');
    expect(article('60058762').kitchenware?.kind).toBe('oven_dish');
  });

  it('builds finite metric geometry inside each editable envelope and releases all leases', () => {
    const resources = new ResourcePool(), shared = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = resources.size;
    for (const asset of IKEA_KITCHEN_PRODUCTS) {
      for (const scale of [1, .7]) {
        const dim = Object.fromEntries(Object.entries(asset.defaultDimensions).map(([axis, n]) => [axis, n * scale])) as { x: number; y: number; z: number };
        const root = builder.build(entity(asset.source!.productCode!, dim));
        const bounds = new THREE.Box3().setFromObject(root);
        expect(bounds.isEmpty(), asset.key).toBe(false);
        const limit = .001;
        expect(bounds.min.x, `${asset.key} min x`).toBeGreaterThanOrEqual(-dim.x / 2 - limit);
        expect(bounds.max.x, `${asset.key} max x`).toBeLessThanOrEqual(dim.x / 2 + limit);
        expect(bounds.min.y, `${asset.key} min y`).toBeGreaterThanOrEqual(-limit);
        expect(bounds.max.y, `${asset.key} max y`).toBeLessThanOrEqual(dim.y + limit);
        expect(bounds.min.z, `${asset.key} min z`).toBeGreaterThanOrEqual(-dim.z / 2 - limit);
        expect(bounds.max.z, `${asset.key} max z`).toBeLessThanOrEqual(dim.z / 2 + limit);
        let meshes = 0;
        root.traverse(part => {
          if (!(part instanceof THREE.Mesh) || part.userData.isOutline) return;
          meshes++;
          const positions = part.geometry.getAttribute('position');
          expect(Array.from(positions.array).every(Number.isFinite), asset.key).toBe(true);
          expect(part.geometry.getAttribute('uv')?.count, asset.key).toBe(positions.count);
        });
        expect(meshes, asset.key).toBeLessThanOrEqual(16);
        const lease = resources.ownTree(root); lease.dispose(); expect(resources.size).toBe(baseline);
      }
    }
    shared.dispose(); expect(resources.size).toBe(0);
  });

  it('keeps cups and food containers hollow, shelf inserts open and pan bodies circular', () => {
    for (const code of ['80258915', '10279723', '60359152', '30155019']) {
      const item = entity(code), root = builder.build(item); root.updateMatrixWorld(true);
      const w = item.dimensions.x, h = item.dimensions.y, d = item.dimensions.z;
      const x = article(code).kitchenware!.kind === 'mug' ? -w / 2 + d / 2 : 0;
      const hit = new THREE.Raycaster(new THREE.Vector3(x, h + 1, 0), new THREE.Vector3(0, -1, 0)).intersectObject(root, true).find(hit => hit.object instanceof THREE.Mesh)!;
      expect(hit.point.y, code).toBeLessThan(h * .3);
    }
    const pan = builder.build(entity('00545218'));
    const body = pan.children.find(p => p.userData.section === 'Body')!;
    const size = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(.24, 5); expect(size.z).toBeCloseTo(.24, 5);
    const shelf = builder.build(entity('60136623')); shelf.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, .08, 1), new THREE.Vector3(0, 0, -1)).intersectObject(shelf, true).filter(hit => hit.object instanceof THREE.Mesh);
    expect(hits).toHaveLength(0);
  });

  it('round-trips new keys, resized dimensions, placement and lid finishes in both save formats', () => {
    const items = IKEA_KITCHEN_PRODUCTS.map((asset, i) => entity(asset.source!.productCode!).withTransform({ x: i % 8, y: .2, z: Math.floor(i / 8) }, .25).withSectionFinish('Lid', { type: 'paint', color: '#5588aa' }));
    const document = new PlanDocument(items);
    for (const text of [codec.encode(document), new LegacyPlanWriter().encode(document)]) {
      const restored = codec.decode(text);
      for (const item of items) expect(restored.requireFurniture(item.id)).toMatchObject({ assetKey: item.assetKey, dimensions: item.dimensions, position: item.position, rotationY: item.rotationY, sectionFinishes: item.sectionFinishes });
    }
  });
});
