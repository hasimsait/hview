import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession';
import { AddBillyExtension, DuplicateFurniture, FinishFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { BILLY_FINISHES } from '../../src/domain/catalog/BillyFinishes';
import { cabinetLeaves } from '../../src/domain/cabinet/CabinetFronts';
import { interior, interiorOrigin, resolveContent } from '../../src/domain/cabinet/CabinetLayout';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import type { ViewportSettings } from '../../src/core/types/services';

const codec = new PlanCodec(), factory = codec.factory;
function bookcase(key = 'ikea_billy_oxberg_80_walnut_effect') {
  const asset = factory.catalog.get(key)!;
  return factory.furniture({ id: 'bookcase', name: asset.key, assetKey: asset.key, displayName: asset.name, category: 'storage', dimensions: { ...asset.defaultDimensions }, position: { x: 1, y: 0, z: 2 }, rotationY: Math.PI / 2, roomId: 'room' });
}

describe('duplicate assets', () => {
  it('copies layout, nested objects, finishes and placement independently, selects the copy and supports undo/redo', () => {
    const original = bookcase(), layout = structuredClone(original.cabinet!);
    layout.contents.push({ id: 'vase', name: 'Vase', assetKey: 'chair', dimensions: { x: .1, y: .2, z: .1 }, position: { x: .1, y: 0, z: .05 }, rotationY: 0, supportId: 'base' });
    const source = original.withCabinet(layout).withFinish(BILLY_FINISHES[1].finish).withSectionFinish('back_panel', { type: 'paint', color: '#884422' });
    const editor = new EditorSession(factory); editor.load(new PlanDocument([source])); editor.selection.select('furniture', source);
    editor.execute(new DuplicateFurniture(source.id, 'copy'));
    const copy = editor.getDocument().requireFurniture('copy');
    expect(editor.selection.getSnapshot()?.id).toBe('copy');
    expect(copy.dimensions).toEqual(source.dimensions); expect(copy.rotationY).toBe(source.rotationY);
    expect(copy.position.x).toBeCloseTo(source.position.x); expect(copy.position.z).toBeCloseTo(source.position.z - .15);
    expect(copy.roomId).toBe(source.roomId); expect(copy.cabinet).toEqual(source.cabinet); expect(copy.cabinet).not.toBe(source.cabinet);
    expect(copy.sectionFinishes).toEqual(source.sectionFinishes); expect(copy.finish).toEqual(source.finish);
    editor.undo(); expect(editor.getDocument().get('copy')).toBeUndefined(); editor.redo(); expect(editor.getDocument().get('copy')).toBe(copy);
    editor.execute(new FinishFurniture('copy', BILLY_FINISHES[0].finish)); editor.execute(new TransformFurniture('copy', { x: 3, y: 0, z: 2 }));
    expect(editor.getDocument().requireFurniture(source.id)).toBe(source);
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded); expect(restored.requireFurniture('copy').cabinet).toEqual(copy.cabinet);
      expect(restored.requireFurniture(source.id).finish).toEqual(source.finish);
    }
  });
  it('retains fixture output and rejects identity collisions without editing the source', () => {
    const lamp = factory.furniture({ id: 'lamp', name: 'Lamp', displayName: 'Lamp', assetKey: 'chandelier', category: 'decor', dimensions: { x: .5, y: .6, z: .5 }, position: { x: 1, y: 2, z: 1 }, rotationY: 0, lightConfig: { lumens: 806, temperatureKelvin: 3500, intensity: .5 } });
    const plan = new PlanDocument([lamp]), copy = new DuplicateFurniture('lamp', 'copy').execute(plan, { factory });
    expect(copy.requireLuminaire('copy').lightConfig).toEqual(lamp.lightConfig);
    expect(() => new DuplicateFurniture('lamp', 'lamp').execute(plan, { factory })).toThrow('Duplicate element ID');
    expect(plan.furniture).toHaveLength(1);
  });
});

describe('BILLY / OXBERG bookcase', () => {
  it('builds full glass doors in all BILLY finishes and preserves their opening style through both formats', () => {
    const builder = new FurnitureMeshBuilder(factory.catalog);
    for (const finish of BILLY_FINISHES) {
      const item = bookcase(`ikea_billy_oxberg_glass_80_${finish.id.replace('billy_', '')}`);
      const root = builder.build(item), panes: THREE.Mesh[] = [];
      root.traverse(part => { if (part instanceof THREE.Mesh && part.userData.isGlazing) panes.push(part); });
      expect(panes).toHaveLength(4);
      expect(panes.filter(p => p.position.y < .96)).toHaveLength(2);
      for (const pane of panes) { expect((pane.material as THREE.MeshPhysicalMaterial).transmission).toBe(0); expect(pane.material).toHaveProperty('opacity', .16); }
      for (const encoded of [codec.encode(new PlanDocument([item])), new LegacyPlanWriter().encode(new PlanDocument([item]))]) {
        const restored = codec.decode(encoded).requireFurniture(item.id);
        expect(restored.cabinet?.doorStyle).toBe('full_glass');
        expect(restored.cabinet?.plinth?.height).toBe(.1); expect(restored.cabinet?.panels).toHaveLength(5);
      }
    }
  });
  it('places independent open and glazed extensions on rotated bookcases, retains finishes and supports undo/redo', () => {
    for (const glass of [false, true]) for (const rotation of [0, .7, Math.PI / 2]) {
      const source = bookcase().withTransform({ x: 1, y: .2, z: 2 }, rotation).withFinish(BILLY_FINISHES[2].finish).withSectionFinish('Frame', { type: 'paint', color: '#dddccc' });
      const editor = new EditorSession(factory); editor.load(new PlanDocument([source])); editor.selection.select('furniture', source);
      editor.execute(new AddBillyExtension(source.id, 'extension', glass));
      const extension = editor.getDocument().requireFurniture('extension'), depth = glass ? .3 : .28, offset = (depth - .3) / 2;
      expect(editor.selection.getSnapshot()?.id).toBe('extension'); expect(extension.position.y + extension.dimensions.y).toBeCloseTo(.2 + 2.37);
      expect(extension.position.x).toBeCloseTo(source.position.x + Math.sin(rotation) * offset);
      expect(extension.position.z).toBeCloseTo(source.position.z + Math.cos(rotation) * offset);
      expect(extension.dimensions).toEqual({ x: .8, y: .35, z: depth }); expect(extension.rotationY).toBe(rotation); expect(extension.roomId).toBe(source.roomId);
      expect(extension.finish).toEqual(source.finish); expect(extension.sectionFinishes).toEqual(source.sectionFinishes);
      expect(extension.cabinet?.openBottom).toBe(true); expect(extension.cabinet?.plinth).toBeUndefined(); expect(extension.cabinet?.panels).toHaveLength(0);
      const root = new FurnitureMeshBuilder(factory.catalog).build(extension), panes: THREE.Mesh[] = [];
      expect(root.getObjectByName('cabinet_part_shell_base')).toBeUndefined(); expect(root.getObjectByName('cabinet_part_plinth_front')).toBeUndefined();
      root.traverse(part => { if (part instanceof THREE.Mesh && part.userData.isGlazing) panes.push(part); });
      expect(panes).toHaveLength(glass ? 2 : 0);
      const layout = extension.cabinet!; expect(interiorOrigin(extension.dimensions, layout).y).toBe(0);
      expect(interior(extension.dimensions, layout).y).toBeCloseTo(.35 - .018);
      const content = { id: 'vase', name: 'Vase', assetKey: 'chair', dimensions: { x: .1, y: .2, z: .1 }, position: { x: .1, y: 0, z: .05 }, rotationY: 0, supportId: 'base' };
      expect(resolveContent(layout, extension.dimensions, content).position.y).toBe(0);
      if (glass) {
        expect(cabinetLeaves(layout, extension.dimensions).map(leaf => leaf.top - leaf.bottom)).toEqual([.35, .35]);
        const openLayout = structuredClone(layout); openLayout.doors.angles[0] = 70;
        expect(new FurnitureMeshBuilder(factory.catalog).build(extension.withCabinet(openLayout)).getObjectByName('cabinet_door_0')!.rotation.y).not.toBe(0);
      }
      for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
        const restored = codec.decode(encoded).requireFurniture('extension'); expect(restored.cabinet).toEqual(layout);
        for (const axis of ['x', 'y', 'z'] as const) expect(restored.position[axis]).toBeCloseTo(extension.position[axis], 4);
      }
      expect(editor.getDocument().requireFurniture(source.id)).toBe(source);
      editor.undo(); expect(editor.getDocument().get('extension')).toBeUndefined(); editor.redo(); expect(editor.getDocument().requireFurniture('extension')).toBe(extension);
      expect(() => new AddBillyExtension('extension', 'extra', glass).execute(editor.getDocument(), { factory })).toThrow('Select a BILLY bookcase');
    }
  });
  it('has 80 × 30 × 202 cm nominal dimensions, two 192 cm opening doors and a 10 cm recessed plinth', () => {
    const item = bookcase(); expect(item.dimensions).toEqual({ x: .8, y: 2.02, z: .3 });
    expect(item.cabinet?.plinth).toEqual({ height: .1, setback: .03 }); expect(item.cabinet?.panels).toHaveLength(5);
    for (const leaf of cabinetLeaves(item.cabinet!, item.dimensions)) { expect(leaf.bottom).toBe(.1); expect(leaf.top - leaf.bottom).toBeCloseTo(1.92); }
    const builder = new FurnitureMeshBuilder(factory.catalog), closed = builder.build(item), panes: THREE.Mesh[] = [], handles: THREE.Mesh[] = [];
    closed.traverse(object => { if (object instanceof THREE.Mesh && object.userData.isGlazing) panes.push(object); if (object instanceof THREE.Mesh && object.userData.section === 'Handles') handles.push(object); });
    expect(panes).toHaveLength(2); expect(handles).toHaveLength(2);
    for (const pane of panes) { const mat = pane.material as THREE.MeshPhysicalMaterial; expect(mat.transmission).toBe(0); expect(mat.opacity).toBeLessThan(.3); expect(mat.depthWrite).toBe(false); expect(pane.castShadow).toBe(false); }
    const layout = structuredClone(item.cabinet!); layout.doors.angles = [70, 0]; const opened = builder.build(item.withCabinet(layout));
    expect(opened.getObjectByName('cabinet_door_0')!.rotation.y).not.toBe(0);
    for (const encoded of [codec.encode(new PlanDocument([item])), new LegacyPlanWriter().encode(new PlanDocument([item]))]) expect(codec.decode(encoded).requireFurniture(item.id).cabinet?.doorStyle).toBe('panel_glass');
  });
  it('keeps glass transparent when applying a BILLY wood finish to the whole bookcase', () => {
    const item = bookcase().withFinish(BILLY_FINISHES[2].finish), root = new FurnitureMeshBuilder(factory.catalog).build(item), resources = new ResourcePool();
    const service = { getMaterial: () => new THREE.MeshStandardMaterial({ color: '#c0b099' }) } as unknown as SurfaceMaterialFactory;
    new FurnitureAppearance(service, resources, () => ({} as ViewportSettings), () => undefined).apply(root, item);
    const panes: THREE.Mesh[] = []; root.traverse(object => { if (object instanceof THREE.Mesh && object.userData.isGlazing) panes.push(object); });
    expect(panes).toHaveLength(2); expect(panes.every(pane => (pane.material as THREE.Material).opacity < .3)).toBe(true);
    resources.ownTree(root).dispose();
  });
});
