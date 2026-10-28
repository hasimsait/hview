import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { AssetSearchIndex } from '../../src/domain/catalog/AssetSearchIndex';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { defaultCabinet, cabinetIssues, resolveContent } from '../../src/domain/cabinet/CabinetLayout';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import type { ViewportSettings } from '../../src/core/types/services';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';
import { PlanDocument } from '../../src/domain/model/PlanDocument';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const keys = ['fit_clothes_rail_shirts', 'fit_clothes_rail_dresses'];
const black: SurfaceFinishConfig = { type: 'metal', variant: 'matte_black_powder', color: '#18181b', roughness: .7, metalness: .15 };
const meshes = (root: THREE.Object3D) => { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) result.push(o); }); return result; };
const entity = (key: string) => { const a = catalog.get(key)!; return codec.factory.furniture({ id: key, assetKey: key, name: key, displayName: a.name, category: 'decor', dimensions: a.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 }); };
const appearance = () => new FurnitureAppearance({ getMaterial: (f: SurfaceFinishConfig) => new THREE.MeshStandardMaterial({ color: f.color, roughness: f.roughness, metalness: f.metalness }) } as unknown as SurfaceMaterialFactory, new ResourcePool(), () => ({} as ViewportSettings), () => undefined);

describe('rails with ten fixed-colour garments', () => {
  it('makes both objects discoverable as wardrobe items', () => {
    const found = new AssetSearchIndex(catalog.all()).search({ query: 'rail', category: 'wardrobe_items', source: 'all', collection: 'all' });
    for (const key of keys) expect(found.some(a => a.key === key)).toBe(true);
  });
  for (const key of keys) {
    it(`${key}: has ten hooks, ten differently coloured garments, only a rail finish and a bottom origin`, () => {
      const item = entity(key), root = builder.build(item), all = meshes(root);
      const garmentGroups = root.children.filter(o => /^(shirt|dress)_\d+$/.test(o.name));
      expect(garmentGroups).toHaveLength(10);
      expect(all.filter(o => o.name.startsWith('hanger_hook_'))).toHaveLength(10);
      const colours = garmentGroups.map(g => (meshes(g)[0].material as THREE.MeshStandardMaterial).color.getHexString());
      expect(new Set(colours).size).toBe(10);
      expect(new Set(all.filter(o => !o.userData.fixedFinish).map(o => o.userData.section))).toEqual(new Set(['Rail']));
      expect(all.filter(o => o.userData.fixedFinish).every(o => !o.userData.section)).toBe(true);
      const box = new THREE.Box3().setFromObject(root);
      expect(box.min.y).toBeCloseTo(0, 4); expect(box.max.y).toBeLessThanOrEqual(item.dimensions.y);
      expect(box.getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(item.dimensions.x + .001);
      const fixed = all.filter(o => o.userData.fixedFinish).map(o => o.material);
      const service = appearance(); service.apply(root, item.withFinish(black));
      expect(all.filter(o => o.userData.fixedFinish).map(o => o.material)).toEqual(fixed);
      expect(all.filter(o => !o.userData.fixedFinish).every(o => (o.material as THREE.MeshStandardMaterial).color.getHexString() === '18181b')).toBe(true);
      service.apply(root, item.withFinish(undefined));
      expect(all.filter(o => !o.userData.fixedFinish).every(o => (o.material as THREE.MeshStandardMaterial).metalness > .9)).toBe(true);
    });
    it(`${key}: keeps cabinet support placement and rail finish through save/load`, () => {
      const rail = entity(key), size = { x: 1, y: 2, z: .6 };
      const layout = defaultCabinet({ dimensions: size, assetKey: 'cabinet_wardrobe' }); layout.panels = [];
      layout.contents = [{ id: 'rail', name: rail.displayName, assetKey: key, dimensions: rail.dimensions, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId: 'base', sectionFinishes: { rail: black } }];
      expect(cabinetIssues(layout, size).size).toBe(0);
      expect(resolveContent(layout, size, layout.contents[0]).position.y).toBe(0);
      const cabinet = codec.factory.furniture({ id: 'cabinet', assetKey: 'cabinet_wardrobe', name: 'cabinet', displayName: 'Wardrobe', category: 'storage', dimensions: size, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet: layout });
      const loaded = codec.decode(codec.encode(new PlanDocument([cabinet]))).requireFurniture('cabinet');
      expect(loaded.cabinet!.contents[0]).toEqual(layout.contents[0]);
      const root = builder.build(loaded); appearance().apply(root, loaded);
      const content = root.getObjectByName('cabinet_content_rail')!;
      expect(meshes(content).filter(o => o.userData.section === 'Rail').every(o => (o.material as THREE.MeshStandardMaterial).color.getHexString() === '18181b')).toBe(true);
      expect(new Set(meshes(content).filter(o => o.userData.fixedFinish).map(o => (o.material as THREE.MeshStandardMaterial).color.getHexString())).size).toBeGreaterThanOrEqual(10);
    });
  }
});
