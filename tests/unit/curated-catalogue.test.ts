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
import type { FurnitureCategory, SurfaceFinishConfig } from '../../src/domain/model/PlanData';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { ViewportSettings } from '../../src/core/types/services';
import { defaultCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
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
        // Catalogue case depth excludes projecting cabinet knobs and pulls.
        const bounds = new THREE.Box3(); mesh.updateMatrixWorld(true);
        mesh.traverse(part => { if (part instanceof THREE.Mesh && part.userData.section !== 'Handles') { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!.clone().applyMatrix4(part.matrixWorld)); } });
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
    expect(colors['Back Panel']).toBe(colors.Top); expect(colors.Shelves).toBe(colors.Top);
  });

  it('keeps a smooth HEMNES back and independent back, shelf, frame and top finishes in layouts and saved plans', () => {
    const builder = new FurnitureMeshBuilder(catalog), codec = new PlanCodec(catalog);
    const original = item('ikea_hemnes_90_white_light_brown');
    const backMeshes: THREE.Mesh[] = []; builder.build(original).traverse(mesh => { if (mesh instanceof THREE.Mesh && mesh.userData.section === 'Back Panel') backMeshes.push(mesh); });
    expect(backMeshes).toHaveLength(1); expect(backMeshes[0].geometry.type).toBe('BoxGeometry');
    const finishes = { Frame: '#e8e5dc', 'Back Panel': '#b98753', Shelves: '#d2b58c', Top: '#a67542' };
    let painted = original;
    for (const [section, color] of Object.entries(finishes)) painted = painted.withSectionFinish(section, { type: 'paint', color });
    for (const entity of [painted, painted.withCabinet(defaultCabinet(painted.toData(), 0))]) {
      const resources = new ResourcePool(), root = builder.build(entity);
      const service = { getMaterial: (finish: SurfaceFinishConfig) => new THREE.MeshStandardMaterial({ color: finish.color }) } as unknown as SurfaceMaterialFactory;
      new FurnitureAppearance(service, resources, () => ({} as ViewportSettings), () => undefined).apply(root, entity);
      const colours: Record<string, string[]> = {};
      root.traverse(mesh => { if (mesh instanceof THREE.Mesh) (colours[mesh.userData.section] ??= []).push((mesh.material as THREE.MeshStandardMaterial).color.getHexString()); });
      for (const [section, color] of Object.entries(finishes)) expect(colours[section].every(value => value === color.slice(1))).toBe(true);
      for (const encoded of [codec.encode(new PlanDocument([entity])), new LegacyPlanWriter().encode(new PlanDocument([entity]))]) {
        const restored = codec.decode(encoded).requireFurniture(entity.id); expect(restored.sectionFinishes).toEqual(painted.sectionFinishes); expect(restored.cabinet).toEqual(entity.cabinet);
      }
      resources.ownTree(root).dispose(); expect(resources.size).toBe(0);
    }
  });

  it('migrates window cornices to their host wall and keeps curtain edits independent', () => {
    const codec = new PlanCodec(), doc = codec.decode(rawPlan()), window = doc.get('window') as WindowOpening;
    expect(doc.requireWall('wall').cornice).toMatchObject({ profile: 'cove', height: .12, depth: .12, offset: .17 });
    expect(new OpeningMeshBuilder().buildOpening(window, doc.requireWall('wall')).getObjectByName('curtain_pelmet_window')).toBeUndefined();
    const editor = new EditorSession(codec.factory); editor.load(doc);
    editor.execute(new SetWindowCurtains(window.id, 'removed'));
    expect(editor.getDocument().requireWall('wall').cornice?.profile).toBe('cove');
    for (const state of ['hidden', 'removed'] as const) {
      editor.execute(new SetWindowPelmet(window.id, state));
      for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
        const restored = codec.decode(encoded);
        expect(restored.requireWall('wall').cornice).toMatchObject({ profile: state === 'removed' ? 'none' : 'cove', hidden: state === 'hidden' });
        expect((restored.get('window') as WindowOpening).curtainState).toBe('removed');
        expect((restored.get('window') as WindowOpening).toData().pelmetState).toBeUndefined();
      }
    }
    editor.undo(); expect(editor.getDocument().requireWall('wall').cornice?.hidden).toBe(true);
  });
});
