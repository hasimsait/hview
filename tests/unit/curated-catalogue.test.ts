import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { CURATED_ASSETS } from '../../src/domain/catalog/CuratedAssets';
import { PlanElementFactory } from '../../src/domain/factories/PlanElementFactory';
import { Shelving } from '../../src/domain/elements/Furniture';
import { WindowOpening } from '../../src/domain/elements/Opening';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, ConfigureShelving } from '../../src/application/commands/FurnitureCommands';
import { SetWindowCurtains, SetWindowPelmet } from '../../src/application/commands/StructuralCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import type { FurnitureCategory } from '../../src/domain/model/PlanData';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog();
const factory = new PlanElementFactory(catalog);
function item(key: string) {
  const asset = catalog.get(key)!;
  return factory.furniture({ id: key, name: key, displayName: key, assetKey: key,
    category: asset.category as FurnitureCategory, dimensions: asset.defaultDimensions,
    position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
}

describe('sourced catalogue', () => {
  it('uses English names and real recipes for every sourced item without duplicate fallback entries', () => {
    const builder = new FurnitureMeshBuilder(catalog);
    for (const asset of CURATED_ASSETS) {
      expect(catalog.recipe(asset.key)).toBe(asset.recipe);
      expect(asset.name).not.toMatch(/sabun|firca|havlu|alcipan|kitaplik|cop kovasi/i);
      expect(item(asset.key).displayName).toBe(asset.name);
      const mesh = builder.build(item(asset.key));
      let count = 0;
      mesh.traverse(child => { if (child instanceof THREE.Mesh) count++; });
      expect(count, asset.key).toBeGreaterThanOrEqual(asset.recipe === 'curtain_pelmet' ? 1 : 2);
      if (asset.recipe !== 'towel_bar') {
        const bounds = new THREE.Box3().setFromObject(mesh);
        expect(bounds.min.y, asset.key).toBeGreaterThanOrEqual(-0.00001);
        expect(bounds.max.y, asset.key).toBeLessThanOrEqual(asset.defaultDimensions.y + .00001);
        expect(bounds.getSize(new THREE.Vector3()).x, asset.key).toBeCloseTo(asset.defaultDimensions.x, 2);
        expect(bounds.getSize(new THREE.Vector3()).z, asset.key).toBeLessThanOrEqual(asset.defaultDimensions.z + .00001);
      }
    }
    expect(catalog.all().filter(asset => asset.key === 'hemnes_bookcase')).toHaveLength(0);
    expect(CURATED_ASSETS.filter(asset => asset.source?.retailer === 'BAUHAUS')).toHaveLength(7);
    expect(CURATED_ASSETS.filter(asset => asset.name.includes('HEMNES'))).toHaveLength(4);
  });

  it('preserves HEMNES dimensions, finishes, adjustable shelves and names through both export formats', () => {
    const codec = new PlanCodec(catalog);
    const editor = new EditorSession(factory);
    editor.load(codec.decode(rawPlan()));
    const bookcase = item('ikea_hemnes_90_black_brown_light_brown');
    expect(bookcase).toBeInstanceOf(Shelving);
    expect(bookcase.dimensions).toEqual({ x: .9, y: 1.97, z: .37 });
    editor.execute(new AddFurniture(bookcase.toData()));
    editor.execute(new ConfigureShelving(bookcase.id, true, 8));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      expect(codec.decode(encoded).get(bookcase.id)).toMatchObject({ shelfCount: 8, hasLids: true, displayName: bookcase.displayName, dimensions: bookcase.dimensions });
    }
    editor.undo();
    expect(editor.getDocument().get(bookcase.id)).toMatchObject({ shelfCount: 6 });
    const model = new FurnitureMeshBuilder().build(bookcase);
    const colors: Record<string, string> = {};
    model.traverse(child => {
      if (child instanceof THREE.Mesh && child.userData.section) colors[child.userData.section] = (child.material as THREE.MeshStandardMaterial).color.getHexString();
    });
    expect(colors.Frame).not.toBe(colors.Top);
  });

  it('places 12 cm cornices in front of rails on either interior side and keeps them independent of curtains', () => {
    const codec = new PlanCodec();
    const doc = codec.decode(rawPlan()), wall = doc.requireWall('wall'), window = doc.get('window') as WindowOpening;
    const builder = new OpeningMeshBuilder();
    for (const side of [-1, 1] as const) {
      const model = builder.buildOpening(window, wall, { ceilingHeight: 3.2, interiorSide: side });
      const pelmet = model.getObjectByName('curtain_pelmet_window')!;
      const bounds = new THREE.Box3().setFromObject(pelmet);
      const rail = new THREE.Box3().setFromObject(model.getObjectByName('curtain_track_window')!);
      expect(bounds.max.y).toBeCloseTo(3.2, 5);
      expect(bounds.getSize(new THREE.Vector3()).y).toBeCloseTo(.12, 5);
      expect(bounds.getSize(new THREE.Vector3()).z).toBeCloseTo(.12, 5);
      expect(side === 1 ? bounds.min.z > rail.max.z : bounds.max.z < rail.min.z).toBe(true);
    }
    const editor = new EditorSession(codec.factory); editor.load(doc);
    editor.execute(new SetWindowCurtains(window.id, 'removed'));
    expect(builder.buildOpening(editor.getDocument().get('window') as WindowOpening, wall).getObjectByName('curtain_pelmet_window')?.visible).toBe(true);
    for (const state of ['hidden', 'removed'] as const) {
      editor.execute(new SetWindowPelmet(window.id, state));
      for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
        const restored = codec.decode(encoded).get('window') as WindowOpening;
        expect(restored.pelmetState).toBe(state);
        expect(restored.curtainState).toBe('removed');
        const pelmet = builder.buildOpening(restored, wall).getObjectByName('curtain_pelmet_window');
        expect(pelmet?.visible ?? null).toBe(state === 'removed' ? null : false);
      }
    }
    editor.undo(); expect((editor.getDocument().get('window') as WindowOpening).pelmetState).toBe('hidden');
  });
});
