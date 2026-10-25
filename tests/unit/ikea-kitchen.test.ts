import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IKEA_KITCHEN_PRODUCTS } from '../../src/domain/catalog/IkeaKitchenProducts';
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
    expect(IKEA_KITCHEN_PRODUCTS.length).toBeGreaterThanOrEqual(1300);
    expect(new Set(IKEA_KITCHEN_PRODUCTS.map(a => a.key)).size).toBe(IKEA_KITCHEN_PRODUCTS.length);
    const kitchenKeys = new Set(IKEA_KITCHEN_PRODUCTS.map(a => a.key));
    const otherArticles = new Set(catalog.all().filter(a => !kitchenKeys.has(a.key)).map(a => a.source?.productCode?.replace(/\D/g, '')));
    for (const asset of IKEA_KITCHEN_PRODUCTS) {
      expect(otherArticles.has(asset.source!.productCode), asset.key).toBe(false);
      expect(asset.source?.productCode).toMatch(/^\d{8}$/);
      expect(asset.source?.url).toMatch(new RegExp(`^https://www\\.ikea\\.com\\.tr/en/.*${asset.source!.productCode}$`));
      expect(asset.name).not.toMatch(/\b(tabak|bardak|tencere|kaşık|cam|zuccaciye|dolap)\b/i);
      expect(asset.source?.dimensionNotes).toBeTruthy();
      expect(asset.source?.dimensions).toBe(/estimat/i.test(asset.source!.dimensionNotes!) ? 'estimated' : 'listed');
      expect(catalog.recipe(asset.key)).toBe('kitchenware');
      expect(['surface', 'wall', 'floor']).toContain(asset.placement?.mount);
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
        expect(meshes, asset.key).toBeLessThanOrEqual(asset.kitchenware?.kind === 'set' ? 64 : 16);
        const lease = resources.ownTree(root); lease.dispose(); expect(resources.size).toBe(baseline);
      }
    }
    shared.dispose(); expect(resources.size).toBe(0);
  }, 30000);

  it('represents complete mixed sets, individual multipacks and mounted organizers explicitly', () => {
    const cookware = article('90207402');
    expect(cookware.kitchenware?.kind).toBe('set');
    expect(cookware.kitchenware?.components).toHaveLength(3);
    expect(cookware.kitchenware?.components?.filter(c => c.model.withLid)).toHaveLength(2);
    expect(cookware.source?.dimensionNotes).toMatch(/capacities are not product dimensions/);
    const pruta = article('10597099');
    expect(pruta.kitchenware?.components?.reduce((sum, c) => sum + (c.model.count ?? 1), 0)).toBe(17);
    expect(article('70566641').defaultDimensions.x).toBeLessThan(.02);
    expect(article('70566641').description).toContain('One individually placeable piece');
    expect(article('80444442').placement?.mount).toBe('wall');
    expect(article('10327700').kitchenware).toMatchObject({ kind: 'board', style: 'raised' });
    for (const asset of IKEA_KITCHEN_PRODUCTS.filter(a => a.kitchenware?.kind === 'set')) {
      expect(asset.kitchenware!.components!.length, asset.key).toBeGreaterThan(0);
      expect(asset.source?.dimensions, asset.key).toBe('estimated');
    }
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

  it('shares repeated set geometry and disposes its instance buffers with the scene lease', () => {
    const root = builder.build(entity('10597099')), resources = new ResourcePool();
    let instances = 0, pieces = 0, disposed = 0;
    root.traverse(part => {
      if (!(part instanceof THREE.InstancedMesh)) return;
      instances++; pieces += part.count;
      part.addEventListener('dispose', () => disposed++);
    });
    expect(instances).toBeGreaterThan(0);
    expect(pieces).toBeGreaterThan(instances);
    const lease = resources.ownTree(root); lease.dispose();
    expect(disposed).toBe(instances);
    expect(resources.size).toBe(0);
  });

  it('round-trips new keys, resized dimensions, placement and lid finishes in both save formats', () => {
    const items = IKEA_KITCHEN_PRODUCTS.map((asset, i) => entity(asset.source!.productCode!).withTransform({ x: i % 8, y: .2, z: Math.floor(i / 8) }, .25).withSectionFinish('Lid', { type: 'paint', color: '#5588aa' }));
    const document = new PlanDocument(items);
    for (const text of [codec.encode(document), new LegacyPlanWriter().encode(document)]) {
      const restored = codec.decode(text);
      for (const item of items) {
        const actual = restored.requireFurniture(item.id).toData();
        expect(actual).toMatchObject({ assetKey: item.assetKey, position: item.position, rotationY: item.rotationY, sectionFinishes: item.sectionFinishes });
        // The legacy writer stores metres with four decimal places.
        for (const axis of ['x', 'y', 'z'] as const) expect(actual.dimensions[axis], `${item.id} ${axis}`).toBeCloseTo(item.dimensions[axis], 4);
      }
    }
  });
});
