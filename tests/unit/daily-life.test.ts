import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DAILY_LIFE_ASSETS } from '../../src/domain/catalog/DailyLifeAssets';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { cabinetDoorCount } from '../../src/domain/catalog/Cabinets';
import { defaultCabinet, cabinetIssues } from '../../src/domain/cabinet/CabinetLayout';
import { cabinetLeaves } from '../../src/domain/cabinet/CabinetFronts';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
function build(key: string, dimensions = catalog.get(key)!.defaultDimensions) {
  const asset = catalog.get(key)!;
  return builder.build(codec.factory.furniture({ id: key, name: key, assetKey: key, displayName: asset.name, category: 'decor', dimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 }));
}
describe('daily-life catalogue', () => {
  for (const asset of DAILY_LIFE_ASSETS) it(`builds ${asset.name} within its reference envelope`, () => {
    const model = build(asset.key), bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(Number.isFinite(size[axis])).toBe(true); expect(size[axis]).toBeGreaterThan(0);
      expect(size[axis], `${asset.key} ${axis}`).toBeLessThanOrEqual(asset.defaultDimensions[axis] + .001);
    }
    expect(bounds.min.y).toBeGreaterThanOrEqual(-.001);
  });
  it('keeps vanity items shallower than the usable depth of a 16 cm mirrored cabinet', () => {
    for (const key of ['life_vanity_bottles', 'life_hot_air_brush', 'life_jewelry_tray']) expect(catalog.get(key)!.defaultDimensions.z).toBeLessThanOrEqual(.16 - .018 - .006);
  });
  it('opens the shallow mirrored cabinet for storage while preserving asymmetric mirror fronts', () => {
    const definition = catalog.get('mirror_cabinet_upper')!;
    expect(cabinetDoorCount(definition)).toBe(2);
    const layout = defaultCabinet({ dimensions: definition.defaultDimensions, assetKey: definition.key }, 2);
    const leaves = cabinetLeaves(layout, definition.defaultDimensions);
    expect(leaves[0].width).toBeGreaterThan(leaves[1].width);
    const bottle = catalog.get('life_vanity_bottles')!;
    layout.contents = [{ id: 'bottles', name: bottle.name, assetKey: bottle.key, dimensions: bottle.defaultDimensions, position: { x: .02, y: 0, z: .01 }, rotationY: 0, supportId: 'shelf_1' }];
    expect(cabinetIssues(layout, definition.defaultDimensions).size).toBe(0);
    const model = builder.build(codec.factory.furniture({ id: 'mirror', name: definition.key, assetKey: definition.key, displayName: definition.name, category: 'bathroom', dimensions: definition.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet: layout }));
    expect(model.getObjectByName('cabinet_content_bottles')).toBeDefined();
    let mirrors = 0; model.traverse(o => { if (o instanceof THREE.Mesh && o.userData.section === 'Mirrors') mirrors++; });
    expect(mirrors).toBe(2);
    expect(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).z).toBeLessThanOrEqual(.161);
  });
  it('removes organizer modules on resize while retaining their metric sizes', () => {
    const a = build('life_drawer_organizer', { x: .45, y: .055, z: .48 });
    const b = build('life_drawer_organizer', { x: .28, y: .055, z: .26 });
    expect(a.userData.organizer).toMatchObject({ columns: 5, rows: 2, cellWidth: .085, cellDepth: .22 });
    expect(b.userData.organizer).toMatchObject({ columns: 3, rows: 1, cellWidth: .085, cellDepth: .22 });
    const walls: THREE.Mesh[] = []; b.traverse(o => { if (o instanceof THREE.Mesh && o.userData.section === 'Compartment Walls') walls.push(o); });
    expect(walls.some(mesh => Math.abs(new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).z - .22) < .0001)).toBe(true);
  });
  it('round-trips every new asset through the plan codec', () => {
    const entities = DAILY_LIFE_ASSETS.map(asset => codec.factory.furniture({ id: asset.key, name: asset.key, assetKey: asset.key, displayName: asset.name, category: asset.category as 'decor', dimensions: asset.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 }));
    const restored = codec.decode(codec.encode(new PlanDocument(entities, 2.7)));
    expect(restored.furniture.map(f => f.assetKey)).toEqual(DAILY_LIFE_ASSETS.map(a => a.key));
  });
});
