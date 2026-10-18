import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { defaultCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { configureCabinetPlinth, DEFAULT_CABINET_PLINTH } from '../../src/domain/cabinet/CabinetPlinth';
import { interior, interiorOrigin, cabinetIssues, validateCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { cabinetLeaves } from '../../src/domain/cabinet/CabinetFronts';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { cabinetDoorCount } from '../../src/domain/catalog/Cabinets';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { StandardFurniture } from '../../src/domain/elements/Furniture';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureCabinet } from '../../src/application/commands/CabinetCommands';
import { AddFurniture, FinishFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';
import type { ViewportSettings } from '../../src/core/types/services';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const green: SurfaceFinishConfig = { type: 'paint', color: '#94a395', roughness: .85 };
const stone: SurfaceFinishConfig = { type: 'tile', variant: 'canakkale_diadem_bej_59x59', color: '#d3c7b8', groutWidth: 0 };
const cabinet = (assetKey = 'kitchen_box_door_double') => new StandardFurniture({ id: 'cabinet', name: assetKey, displayName: 'Kitchen cabinet', assetKey, category: 'kitchen', dimensions: { x: .8, y: .85, z: .58 }, position: { x: 2, y: 0, z: 3 }, rotationY: .1, sectionFinishes: { cabinet: green, countertop: stone }, rawItem: { keep: 'original metadata' } });
function meshes(root: THREE.Object3D) { const values: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) values.push(o); }); return values; }
function rendered(item: StandardFurniture) {
  const resources = new ResourcePool(), root = builder.build(item);
  const finishes = { getMaterial: (f: SurfaceFinishConfig) => { const m = new THREE.MeshStandardMaterial({ color: f.color && f.color !== 'invisible' ? f.color : '#ffffff' }); m.userData.finish = f; return m; }, ensureLocalMetricBounds: () => {} } as unknown as SurfaceMaterialFactory;
  new FurnitureAppearance(finishes, resources, () => ({} as ViewportSettings), () => undefined).apply(root, item);
  return root;
}
function top(root: THREE.Object3D) { return meshes(root).filter(m => m.userData.section === 'Countertop'); }
const colour = (m: THREE.Mesh) => (m.material as THREE.MeshStandardMaterial).color.getHexString();

describe('independent worktops and retained kitchen cabinet appearance', () => {
  it('keeps cabinet colour and the same countertop when the first door edit creates a layout', () => {
    const original = cabinet(), old = rendered(original), editor = new EditorSession(codec.factory); editor.load(new PlanDocument([original]));
    const layout = defaultCabinet(original.toData(), 2); layout.doors.angles = [75, 0]; editor.execute(new ConfigureCabinet(original.id, layout));
    const edited = editor.getDocument().requireFurniture(original.id) as StandardFurniture, root = rendered(edited);
    expect(top(root)).toHaveLength(1); expect(top(old)).toHaveLength(1);
    expect(new THREE.Box3().setFromObject(top(root)[0])).toEqual(new THREE.Box3().setFromObject(top(old)[0]));
    expect(colour(top(root)[0])).toBe('d3c7b8'); expect((top(root)[0].material as THREE.Material).userData.finish.variant).toBe(stone.variant);
    const parts = meshes(root).filter(m => m.userData.cabinetPart && m.userData.section !== 'Handles');
    expect(parts.length).toBeGreaterThan(5); expect(parts.every(m => colour(m) === '94a395')).toBe(true);
    expect(meshes(root).filter(m => m.userData.section === 'Handles').every(m => colour(m) !== '94a395')).toBe(true);
    expect(edited.sectionFinishes).toEqual(original.sectionFinishes); expect(edited.position).toEqual(original.position); expect(edited.dimensions).toEqual(original.dimensions);
    editor.undo(); expect(editor.getDocument().requireFurniture(original.id)).toBe(original); editor.redo(); expect(editor.getDocument().requireFurniture(original.id).cabinet).toEqual(layout);
  });
  it('retains edited stacked fronts, shelves, finishes, metadata and dimensions through both plan formats', () => {
    const original = cabinet(), layout = defaultCabinet(original.toData(), 2);
    layout.frontSections = [{ id: 'lower', bottom: 0, top: .4, opening: 'swing', doors: { count: 1, hinge: 'right', angles: [37, 0] } }, { id: 'upper', bottom: .4, top: 'top', opening: 'swing', doors: { count: 2, hinge: 'left', angles: [0, 62] } }];
    layout.panels[0].at = .31; layout.panels[0].depth = { mode: 'fixed', value: .42 }; layout.panels[0].finish = { type: 'paint', color: '#778899' };
    const data = original.withCabinet(layout).withSectionFinish('Door 1', { type: 'paint', color: '#334455' });
    const root = rendered(data as StandardFurniture); expect(colour(meshes(root).find(m => m.userData.section === 'Door 1')!)).toBe('334455');
    expect(colour(meshes(root).find(m => m.userData.cabinetPanel?.id === layout.panels[0].id)!)).toBe('778899');
    for (const encoded of [codec.encode(new PlanDocument([data])), new LegacyPlanWriter().encode(new PlanDocument([data]))]) {
      const saved = codec.decode(encoded).requireFurniture(data.id);
      expect(saved.cabinet).toEqual(layout); expect(saved.sectionFinishes).toEqual(data.sectionFinishes); expect(saved.dimensions).toEqual(data.dimensions); expect(saved.position).toEqual(data.position); expect(saved.rotationY).toBe(data.rotationY);
      expect(top(rendered(saved as StandardFurniture))).toHaveLength(1);
    }
  });
  it('keeps upper cabinets coloured without inventing a worktop and leaves hidden countertops hidden', () => {
    const upper = cabinet('kitchen_box_wall'), layout = defaultCabinet(upper.toData(), 2), root = rendered(upper.withCabinet(layout) as StandardFurniture);
    expect(top(root)).toHaveLength(0); expect(meshes(root).filter(m => m.userData.section === 'Frame').every(m => colour(m) === '94a395')).toBe(true);
    const base = cabinet(), hidden = base.withCabinet(layout).withSectionFinish('Countertop', { type: 'invisible' });
    // The real material factory handles invisibility; the finish identity must reach it independently of the cabinet colour.
    const surface = top(rendered(hidden as StandardFurniture))[0]; expect((surface.material as THREE.Material).userData.finish.type).toBe('invisible');
  });
  it('retains the original default material for unpainted kitchen modules on conversion', () => {
    const item = cabinet().withSectionFinish('cabinet') as StandardFurniture;
    const before = meshes(rendered(item)).find(m => m.userData.section === 'Cabinet')!;
    const after = meshes(rendered(item.withCabinet(defaultCabinet(item.toData(), 2)) as StandardFurniture)).find(m => m.userData.section === 'Frame')!;
    expect(colour(after)).toBe(colour(before));
  });
  it('adds a recessed 10 cm plinth inside the total height while retaining the countertop and base supports', () => {
    const original = cabinet(), layout = configureCabinetPlinth(defaultCabinet(original.toData(), 2), original.dimensions.y, DEFAULT_CABINET_PLINTH);
    layout.contents = [{ id: 'bottle', name: 'Bottle', assetKey: 'fit_detergent', dimensions: { x: .15, y: .2, z: .09 }, position: { x: .02, y: 0, z: .01 }, rotationY: 0, supportId: 'base' }];
    const data = original.withCabinet(layout) as StandardFurniture, root = rendered(data), before = rendered(original);
    expect(interiorOrigin(data.dimensions, layout).y).toBeCloseTo(.118);
    expect(interior(data.dimensions, layout).y).toBeCloseTo(.714);
    expect([...cabinetIssues(layout, data.dimensions)]).toEqual([]);
    expect(new THREE.Box3().setFromObject(top(root)[0])).toEqual(new THREE.Box3().setFromObject(top(before)[0]));
    const base = new THREE.Box3().setFromObject(root.getObjectByName('cabinet_part_shell_base')!);
    expect(base.min.y).toBeCloseTo(.10); expect(base.max.y).toBeCloseTo(.118);
    const plinth = new THREE.Box3().setFromObject(root.getObjectByName('cabinet_part_plinth_front')!);
    expect(plinth.min.y).toBeCloseTo(0); expect(plinth.max.y).toBeCloseTo(.10); expect(plinth.max.z).toBeCloseTo(data.dimensions.z / 2 - .05);
    const bottle = root.getObjectByName('cabinet_content_bottle')!; expect(bottle.position.y).toBeCloseTo(.118);
    const doors = cabinetLeaves(layout, data.dimensions); expect(doors.every(leaf => leaf.bottom === .1)).toBe(true);
    expect(meshes(root).filter(m => m.userData.section === 'Plinth').every(m => colour(m) === '94a395')).toBe(true);
    const painted = data.withSectionFinish('Plinth', { type: 'paint', color: '#222222' });
    expect(meshes(rendered(painted as StandardFurniture)).filter(m => m.userData.section === 'Plinth').every(m => colour(m) === '222222')).toBe(true);
    const feedback = new CollisionFeedback();
    for (const angle of [0, 45, 90, 170]) {
      const opened = rendered(data.withCabinet({ ...layout, doors: { ...layout.doors, angles: [angle, 0] } }) as StandardFurniture);
      const pivot = opened.getObjectByName('cabinet_door_0')!; opened.updateMatrixWorld(true);
      for (const moving of meshes(pivot)) for (const obstacle of meshes(opened).filter(m => m.userData.section === 'Plinth')) expect(feedback.intersects(moving, obstacle)).toBe(false);
    }
    feedback.dispose();
  });
  it('resizes stacked drawer fronts proportionally and retains plinth settings through undo and both exports', () => {
    const asset = catalog.get('cabinet_drawers_three')!, item = new StandardFurniture({ ...cabinet().toData(), assetKey: asset.key, dimensions: asset.defaultDimensions });
    const original = defaultCabinet(item.toData(), 1), layout = configureCabinetPlinth(original, item.dimensions.y, { height: .1, setback: .04 });
    const leaves = cabinetLeaves(layout, item.dimensions);
    expect(leaves[0].bottom).toBeCloseTo(.1); expect(leaves[0].top - leaves[0].bottom).toBeCloseTo((item.dimensions.y - .1) * .25);
    expect(cabinetIssues(layout, item.dimensions).size).toBe(0);
    const editor = new EditorSession(codec.factory); editor.load(new PlanDocument([item])); editor.execute(new ConfigureCabinet(item.id, layout));
    editor.undo(); expect(editor.getDocument().requireFurniture(item.id).cabinet).toBeUndefined(); editor.redo();
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) expect(codec.decode(encoded).requireFurniture(item.id).cabinet).toEqual(layout);
    const removed = configureCabinetPlinth(layout, item.dimensions.y);
    expect(removed.plinth).toBeUndefined();
    for (let i = 0; i < original.frontSections!.length; i++) expect(removed.frontSections![i].bottom).toBeCloseTo(original.frontSections![i].bottom);
    expect(meshes(rendered(item.withCabinet(removed) as StandardFurniture)).some(m => m.userData.section === 'Plinth')).toBe(false);
    for (const plinth of [{ height: 0, setback: .05 }, { height: .51, setback: .05 }, { height: NaN, setback: .05 }, { height: .1, setback: -.01 }]) expect(() => validateCabinet({ ...original, plinth })).toThrow();
    expect(cabinetIssues({ ...original, plinth: { height: .1, setback: 1 } }, item.dimensions).get('plinth_front')).toBeDefined();
  });
  it('adds a separate resizable slab with no cabinet behaviour and independent finishes and elevation', () => {
    const asset = catalog.get('kitchen_worktop')!; expect(asset.defaultDimensions).toEqual({ x: 2.4, y: .04, z: .62 }); expect(asset.placement).toMatchObject({ mount: 'surface', defaultElevation: .85 });
    for (const alias of ['counter', 'countertop', 'worktop']) expect(catalog.canonicalKey(alias)).toBe(asset.key);
    expect(cabinetDoorCount(asset)).toBeUndefined(); const editor = new EditorSession(codec.factory), original = cabinet(); editor.load(new PlanDocument([original]));
    editor.execute(new AddFurniture({ id: 'top', name: asset.key, assetKey: asset.key, displayName: asset.name, category: 'kitchen', position: { x: 1, y: .85, z: 3 }, rotationY: .2, dimensions: asset.defaultDimensions }));
    editor.execute(new TransformFurniture('top', undefined, undefined, { x: 3.1, y: .03, z: .65 })); editor.execute(new FinishFurniture('top', stone));
    const item = editor.getDocument().requireFurniture('top'), root = rendered(item as StandardFurniture), bounds = new THREE.Box3().setFromObject(root);
    expect(item.cabinet).toBeUndefined(); expect(meshes(root)).toHaveLength(1); expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(.03); expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(3.1); expect(bounds.getSize(new THREE.Vector3()).z).toBeCloseTo(.65);
    expect(editor.getDocument().requireFurniture(original.id)).toBe(original);
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) expect(codec.decode(encoded).requireFurniture('top').toData()).toMatchObject({ dimensions: { x: 3.1, y: .03, z: .65 }, position: { y: .85 }, finish: stone });
  });
});
