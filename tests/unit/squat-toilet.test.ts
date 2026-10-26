import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const asset = catalog.get('squat_toilet')!;
const item = (dimensions = asset.defaultDimensions) => codec.factory.furniture({ id: 'pan', name: asset.key, assetKey: asset.key, displayName: asset.name, category: 'bathroom', dimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });

describe('squat toilet', () => {
  it('fits its editable floor envelope and releases geometry without disposing the shared palette', () => {
    expect(asset.placement).toMatchObject({ mount: 'floor', defaultElevation: 0 });
    expect(catalog.recipe('squat_pan')).toBe('squat_toilet');
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = resources.size;
    for (const dimensions of [asset.defaultDimensions, { x: .7, y: .14, z: .8 }]) {
      const root = builder.build(item(dimensions)), bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
      for (const axis of ['x', 'y', 'z'] as const) expect(size[axis]).toBeCloseTo(dimensions[axis], 5);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(root.children.filter(object => object instanceof THREE.Mesh).length).toBeLessThanOrEqual(8);
      const lease = resources.ownTree(root); lease.dispose(); expect(resources.size).toBe(baseline);
    }
    palette.dispose(); expect(resources.size).toBe(0);
  });

  it('has a recessed bowl and open drain between raised, ribbed footplates', () => {
    const root = builder.build(item()), { x: w, y: h, z: d } = asset.defaultDimensions;
    root.updateMatrixWorld(true);
    const hit = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true).find(hit => hit.object instanceof THREE.Mesh)!;
    const bowl = hit(0, 0), drain = hit(0, -d * .12);
    expect(bowl.object.userData.section).toBe('Bowl'); expect(bowl.point.y).toBeLessThan(h * .82);
    expect(drain.object.userData.section).toBe('Drain'); expect(drain.point.y).toBeCloseTo(h * .04, 5);
    for (const x of [-w * .34, w * .34]) {
      const tread = hit(x, 0);
      expect(tread.object.userData.section).toBe('Footplate Treads'); expect(tread.point.y).toBeCloseTo(h, 5);
    }
    const geometry = (bowl.object as THREE.Mesh).geometry;
    expect(geometry.attributes.uv.count).toBe(geometry.attributes.position.count);
    expect(root.children.some(object => object.userData.section === 'Cistern')).toBe(false);
  });

  it('retains identity, resized dimensions, placement and separate bowl/drain finishes in both plan formats', () => {
    const pan = item({ x: .6, y: .12, z: .72 }).withTransform({ x: 2, y: 0, z: 3 }, .4)
      .withSectionFinish('Bowl', { type: 'paint', color: '#dedbd1' })
      .withSectionFinish('Drain', { type: 'paint', color: '#202020' });
    const document = new PlanDocument([pan]);
    for (const text of [codec.encode(document), new LegacyPlanWriter().encode(document)]) {
      const saved = codec.decode(text).requireFurniture(pan.id);
      expect(saved).toMatchObject({ assetKey: asset.key, category: 'bathroom', dimensions: pan.dimensions, position: pan.position, rotationY: pan.rotationY, sectionFinishes: pan.sectionFinishes });
    }
  });
});
