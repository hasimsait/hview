import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cabinetDoorPose, cabinetIssues, defaultCabinet, footprint, interior, interiorOrigin, moveCabinetPart, penetrates, removeCabinetPart, resolveContent, resolvePanel, settleContent, shelfClearances, splitDivider, validateCabinet, type CabinetContent, type CabinetLayout, type CabinetPanel, type CabinetHinge } from '../../src/domain/cabinet/CabinetLayout';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureCabinet } from '../../src/application/commands/CabinetCommands';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import type { ViewportSettings } from '../../src/core/types/services';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog), size = { x: .6, y: 1.9, z: .4 };
function layout(): CabinetLayout { return { ...defaultCabinet({ dimensions: size, assetKey: 'cabinet_tall_single' }, 1), panels: [], contents: [] }; }
const shelf = (id: string, at: number, patch: Partial<CabinetPanel> = {}): CabinetPanel => ({ id, name: id, kind: 'shelf', at, start: 'left', end: 'right', depth: { mode: 'fit', value: .02 }, ...patch });
const detergent = (supportId = 'base'): CabinetContent => ({ id: 'bottle', name: 'Detergent', assetKey: 'fit_detergent', dimensions: { x: .15, y: .3, z: .09 }, position: { x: .02, y: 0, z: .01 }, rotationY: 0, supportId });
function entity(c = layout()) { return codec.factory.furniture({ id: 'cabinet', name: 'cabinet', displayName: 'Cabinet', assetKey: 'cabinet_tall_single', category: 'storage', dimensions: size, position: { x: 2, y: 0, z: 1 }, rotationY: .4, cabinet: c }); }
function meshes(root: THREE.Object3D) { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) result.push(o); }); return result; }

describe('cabinet layout and fit rules', () => {
  it('measures from inside left/base/back with independent back thickness', () => {
    const c = layout(); expect(interior(size, c).x).toBeCloseTo(.564); expect(interior(size, c).y).toBeCloseTo(1.864); expect(interior(size, c).z).toBeCloseTo(.376);
    expect(interiorOrigin(size, c)).toEqual({ x: -.282, y: .018, z: -.194 });
    expect(interior(size, { ...c, backThickness: .012 }).z).toBeCloseTo(.370);
  });
  it('fits width and depth while preserving shelf height and reversible resize intentions', () => {
    const c = layout(), s = shelf('shelf', .9); c.panels.push(s);
    const original = resolvePanel(c, size, s), shrunk = resolvePanel(c, { ...size, x: .4, y: .7, z: .3 }, s);
    expect(shrunk.position.y).toBe(.9); expect(shrunk.dimensions.x).toBeCloseTo(.364); expect(shrunk.dimensions.z).toBeCloseTo(.256);
    expect(cabinetIssues(c, { ...size, y: .7 }).get(s.id)).toContain('Outside usable interior');
    expect(resolvePanel(c, size, s)).toEqual(original); expect(c.panels).toHaveLength(1);
    expect(resolvePanel(c, { ...size, z: .6 }, { ...s, depth: { mode: 'fixed', value: .2 } }).dimensions.z).toBe(.2);
  });
  it('moves partial shelf endpoints with a divider while leaving stored object dimensions unchanged', () => {
    const c = layout(), divider: CabinetPanel = { ...shelf('partition', .3), kind: 'divider', start: 'bottom', end: 'top' }, s = shelf('left_shelf', .7, { end: divider.id });
    c.panels.push(divider, s); c.contents.push(detergent(s.id));
    expect(resolvePanel(c, size, s).dimensions.x).toBe(.3);
    c.panels[0] = { ...divider, at: .25 };
    expect(resolvePanel(c, size, s).dimensions.x).toBe(.25); expect(resolveContent(c, size, c.contents[0]).dimensions).toEqual(detergent().dimensions);
    expect(resolveContent(c, size, c.contents[0]).position.y).toBeCloseTo(.718);
  });
  it('builds the irregular cleaning cabinet by splitting and removing only the bottom divider segment', () => {
    let c = layout();
    c.panels = [shelf('bucket_roof', .48, { end: 'divider' }), { ...shelf('divider', .35), kind: 'divider', start: 'bottom', end: 'top' }, shelf('left_1', .85, { end: 'divider' }), shelf('left_2', 1.2, { end: 'divider' }), shelf('top_shelf', 1.6)];
    c = splitDivider(c, size, 'divider'); expect(c.panels.filter(p => p.kind === 'divider')).toHaveLength(5);
    c = removeCabinetPart(c, size, 'divider'); validateCabinet(c);
    expect(resolvePanel(c, size, c.panels.find(p => p.id === 'bucket_roof')!).dimensions.x).toBeCloseTo(.35);
    c.contents = [{ ...detergent(), id: 'mop', name: 'Mop', assetKey: 'fit_mop', dimensions: { x: .15, y: 1.4, z: .12 }, position: { x: .39, y: 0, z: .05 } }];
    expect(resolvePanel(c, size, c.panels.find(p => p.id === 'left_1')!).dimensions.x).toBeCloseTo(.35);
    expect(cabinetIssues(c, size).size).toBe(0);
    expect(c.panels.some(p => p.id === 'left_2')).toBe(true);
  });
  it('measures clear height between actual overlapping shelves, including board thickness', () => {
    const c = layout(); c.panels = [shelf('left_low', .3, { end: .25 }), shelf('right_only', .5, { start: .3 }), shelf('selected', .7, { end: .25 }), shelf('upper', 1.2)];
    expect(shelfClearances(c, size, 'selected').below).toBeCloseTo(.382);
    expect(shelfClearances(c, size, 'selected').above).toBeCloseTo(.482);
  });
  it('settles on the highest available shelf and uses offsets from its left/back/top', () => {
    const c = layout(); c.panels = [shelf('low', .4, { start: .1 }), shelf('high', .9)];
    const placed = settleContent(c, size, detergent(), { x: .15, y: .8, z: .03 });
    expect(placed.supportId).toBe('low'); expect(placed.position).toEqual({ x: .04999999999999999, y: 0, z: .03 });
    expect(cabinetIssues({ ...c, contents: [placed] }, size).has(placed.id)).toBe(false);
    c.panels[0] = { ...c.panels[0], at: .5 };
    expect(resolveContent(c, size, placed).position.y).toBeCloseTo(.518);
  });
  it('previews movement without changing saved data, then settles only on release', () => {
    const c = layout(); c.panels = [shelf('shelf', .5)]; c.contents = [detergent('shelf')];
    const f = footprint(c.contents[0].dimensions), origin = interiorOrigin(size, c), center = { x: origin.x + .03 + f.x / 2, y: origin.y + .8, z: origin.z + .01 + f.z / 2 };
    const preview = moveCabinetPart(c, size, 'bottle', center, 0, false);
    expect(preview.contents[0].position.y).toBeCloseTo(.8); expect(cabinetIssues(preview, size).get('bottle')).toContain('Unsupported');
    const committed = moveCabinetPart(c, size, 'bottle', center, 0);
    expect(committed.contents[0].supportId).toBe('shelf'); expect(committed.contents[0].position.y).toBe(0); expect(c.contents[0].position.y).toBe(0);
    expect(resolveContent(c, size, c.contents[0]).position.y).toBeCloseTo(.518);
  });
  it('never applies gravity on load, shell resize, support deletion or shelf depth changes', () => {
    let c = layout(); c.panels = [shelf('support', .6)]; c.contents = [detergent('support')];
    const position = resolveContent(c, size, c.contents[0]).position;
    c = removeCabinetPart(c, size, 'support');
    expect(c.contents[0].supportId).toBeUndefined(); expect(c.contents[0].position).toEqual(position);
    expect(cabinetIssues(c, size).get('bottle')).toContain('Unsupported');
    expect(cabinetIssues(c, { ...size, y: .3 }).get('bottle')).toContain('Outside usable interior');
    expect(c.contents[0].position).toEqual(position);
  });
  it('highlights unsupported overhang after support shrink without moving the object', () => {
    const c = layout(); c.panels = [shelf('shelf', .4, { depth: { mode: 'fixed', value: .03 } })]; c.contents = [{ ...detergent('shelf'), position: { x: .02, y: 0, z: .08 } }];
    expect(cabinetIssues(c, size).get('bottle')).toContain('Unsupported'); expect(c.contents[0].position.z).toBe(.08);
  });
  it('permits contact but detects penetration and respects rotated footprints', () => {
    const c = layout(); c.contents = [detergent(), { ...detergent(), id: 'second', position: { x: .17, y: 0, z: .01 } }];
    expect(cabinetIssues(c, size).size).toBe(0);
    c.contents[1].position.x -= .01; expect(cabinetIssues(c, size).get('bottle')).toContain('Intersects Detergent');
    const a = resolveContent(c, size, c.contents[0]), b = { ...a, position: { x: .02, y: .3, z: .01 } };
    expect(penetrates(a, b)).toBe(false); b.position.y = .29; expect(penetrates(a, b)).toBe(true);
    expect(footprint({ x: .2, y: .1, z: .1 }, Math.PI / 2).x).toBeCloseTo(.1);
  });
  it('retains invalid contents, linked panels, independent finishes and angles in both saved formats', () => {
    const c = layout(); c.panels = [shelf('shelf', 2.2, { finish: { type: 'paint', color: '#778899' } })]; c.contents = [detergent('shelf')]; c.doors.angles = [76, 0];
    c.doors.hinges = [{ type: 'fully-cranked', travel: .02 }, { type: 'straight-arm', travel: .03 }];
    const editor = new EditorSession(codec.factory); editor.load(new PlanDocument([entity()])); editor.execute(new ConfigureCabinet('cabinet', c));
    for (const raw of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) expect(codec.decode(raw).requireFurniture('cabinet').cabinet).toEqual(c);
    editor.undo(); expect(editor.getDocument().requireFurniture('cabinet').cabinet?.panels).toHaveLength(0); editor.redo(); expect(editor.getDocument().requireFurniture('cabinet').cabinet).toEqual(c);
  });
  it('rejects broken references, duplicate identities, invalid sizes and more than two doors', () => {
    const c = layout(); c.panels.push(shelf('shelf', .2, { start: 'missing' })); expect(() => validateCabinet(c)).toThrow('endpoint');
    expect(() => validateCabinet({ ...layout(), doors: { count: 3 as 2, hinge: 'left', angles: [0, 0] } })).toThrow('two doors');
    expect(() => validateCabinet({ ...layout(), backThickness: NaN })).toThrow('finite');
    expect(() => validateCabinet({ ...layout(), contents: [detergent('missing')] })).toThrow('support');
    expect(() => validateCabinet({ ...layout(), contents: [detergent(), detergent()] })).toThrow('Duplicate');
    expect(() => validateCabinet({ ...layout(), panels: [shelf('shell_left', .4)] })).toThrow('Duplicate');
    expect(cabinetIssues(layout(), { x: .01, y: .01, z: .01 }).has('shell_left')).toBe(true);
  });
  it('validates hinge settings while allowing older layouts without them', () => {
    expect(validateCabinet(layout()).doors.hinges).toBeUndefined();
    for (const bad of [null, [], [{ type: 'pivot', travel: 0 }], [{ type: 'unknown', travel: .02 }, { type: 'pivot', travel: 0 }], [{ type: 'half-cranked', travel: -.001 }, { type: 'pivot', travel: 0 }], [{ type: 'straight-arm', travel: .051 }, { type: 'pivot', travel: 0 }], [{ type: 'fully-cranked', travel: NaN }, { type: 'pivot', travel: 0 }]]) {
      const c = layout(); c.doors.hinges = bad as [CabinetHinge, CabinetHinge]; expect(() => validateCabinet(c)).toThrow();
    }
  });
});

describe('cabinet rendering and collision feedback', () => {
  it('keeps the closed position and independently translates mirrored concealed hinges', () => {
    const c = layout(); c.doors.count = 2; c.doors.hinges = [{ type: 'half-cranked', travel: .02 }, { type: 'fully-cranked', travel: .03 }];
    const closed = [cabinetDoorPose(size, c, 0), cabinetDoorPose(size, c, 1)];
    const legacy = layout(); legacy.doors.count = 2;
    expect(closed).toEqual([cabinetDoorPose(size, legacy, 0), cabinetDoorPose(size, legacy, 1)]);
    c.doors.angles = [90, 90]; const root = builder.build(entity(c));
    const left = root.getObjectByName('cabinet_door_0')!, right = root.getObjectByName('cabinet_door_1')!;
    expect(left.position.x - closed[0].position.x).toBeCloseTo(.02); expect(left.position.z - closed[0].position.z).toBeCloseTo(.02);
    expect(right.position.x - closed[1].position.x).toBeCloseTo(-.03); expect(right.position.z - closed[1].position.z).toBeCloseTo(.03);
    expect(left.rotation.y).toBeCloseTo(-Math.PI / 2); expect(right.rotation.y).toBeCloseTo(Math.PI / 2);
    c.doors.angles = [45, 0]; expect(cabinetDoorPose(size, c, 1)).toEqual(closed[1]);
    expect(cabinetDoorPose(size, c, 0).position.x - closed[0].position.x).toBeCloseTo(.02 * Math.sin(Math.PI / 4));
  });
  it('clears a flush neighbouring enclosure on either side with 20 mm travel, but reports insufficient travel', () => {
    const feedback = new CollisionFeedback(), obstacle = new THREE.Mesh(new THREE.BoxGeometry(.1, size.y, .6));
    for (const side of ['left', 'right'] as const) {
      const c = layout(); c.doors.hinge = side;
      obstacle.position.set((side === 'left' ? -1 : 1) * (size.x / 2 + .05), size.y / 2, size.z / 2 + .3); obstacle.updateMatrixWorld(true);
      for (const type of ['straight-arm', 'half-cranked', 'fully-cranked'] as const) {
        c.doors.hinges = [{ type, travel: .02 }, { type: 'pivot', travel: 0 }];
        const root = builder.build(entity(c)), pivot = root.getObjectByName('cabinet_door_0')!, leaf = meshes(pivot).find(m => m.userData.isSwingLeaf)!;
        for (let angle = 0; angle <= 90; angle += 2) {
          const pose = cabinetDoorPose(size, c, 0, angle); pivot.position.set(pose.position.x, pose.position.y, pose.position.z); pivot.rotation.y = pose.rotationY; root.updateMatrixWorld(true);
          expect(feedback.intersects(leaf, obstacle), `${side}, ${type}, ${angle} degrees`).toBe(false);
          for (const shell of meshes(root).filter(m => m.userData.cabinetPart?.startsWith('shell_'))) expect(feedback.intersects(leaf, shell)).toBe(false);
        }
      }
      c.doors.hinges![0].travel = .002; c.doors.angles[0] = 90;
      const insufficient = builder.build(entity(c)); insufficient.updateMatrixWorld(true);
      expect(feedback.intersects(meshes(insufficient).find(m => m.userData.isSwingLeaf)!, obstacle)).toBe(true);
      c.doors.hinges = undefined;
      const fixed = builder.build(entity(c)); fixed.updateMatrixWorld(true);
      expect(feedback.intersects(meshes(fixed).find(m => m.userData.isSwingLeaf)!, obstacle)).toBe(true);
    }
    feedback.dispose(); obstacle.geometry.dispose();
  });
  it('opens each door independently about its actual hinge without moving the shell or contents', () => {
    const c = layout(); c.doors.count = 2; c.contents = [detergent()];
    const closed = builder.build(entity(c)), open = builder.build(entity({ ...c, doors: { ...c.doors, angles: [90, 0] } }));
    expect(open.getObjectByName('cabinet_door_0')!.rotation.y).toBeCloseTo(-Math.PI / 2); expect(open.getObjectByName('cabinet_door_1')!.rotation.y).toBe(0);
    expect(new THREE.Box3().setFromObject(open.getObjectByName('cabinet_part_shell_left')!)).toEqual(new THREE.Box3().setFromObject(closed.getObjectByName('cabinet_part_shell_left')!));
    expect(open.getObjectByName('cabinet_content_bottle')!.position).toEqual(closed.getObjectByName('cabinet_content_bottle')!.position);
  });
  it('keeps a normal cabinet door clear of its own carcass throughout its swing', () => {
    const c = layout(), feedback = new CollisionFeedback();
    for (const angle of [0, 10, 45, 90, 115, 170]) {
      c.doors.angles[0] = angle; const root = builder.build(entity(c)); root.updateMatrixWorld(true);
      const leaf = meshes(root).find(m => m.userData.isSwingLeaf)!;
      for (const obstacle of meshes(root).filter(m => m.userData.cabinetPart?.startsWith('shell_'))) expect(feedback.intersects(leaf, obstacle), `${angle} degrees / ${obstacle.userData.cabinetPart}`).toBe(false);
    }
    feedback.dispose();
  });
  it('preserves content finishes separately from the cabinet finish', () => {
    const c = layout(); c.panels = [shelf('shelf', .4, { finish: { type: 'paint', color: '#334455' } })]; c.contents = [{ ...detergent(), finish: { type: 'paint', color: '#778899' } }];
    const e = entity(c).withFinish({ type: 'paint', color: '#aabbcc' }), root = builder.build(e), resources = new ResourcePool();
    const appearance = new FurnitureAppearance({ getMaterial: (finish: SurfaceFinishConfig) => new THREE.MeshStandardMaterial({ color: finish.color }) } as unknown as SurfaceMaterialFactory, resources, () => ({} as ViewportSettings), () => undefined);
    appearance.apply(root, e);
    expect((meshes(root.getObjectByName('cabinet_content_bottle')!)[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('778899');
    expect((meshes(root.getObjectByName('cabinet_part_shelf')!)[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('334455');
  });
  it('detects a moving door crossing an obstacle, allows touching and restores original finishes', () => {
    const feedback = new CollisionFeedback(), material = new THREE.MeshStandardMaterial({ color: '#abcdef' });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.4, 1, .018), material), obstacle = new THREE.Mesh(new THREE.BoxGeometry(.1, .5, .1), material);
    leaf.position.y = .5; obstacle.position.set(.25, .5, 0); leaf.updateMatrixWorld(); obstacle.updateMatrixWorld();
    expect(feedback.intersects(leaf, obstacle)).toBe(false); obstacle.position.x = .24; obstacle.updateMatrixWorld(); expect(feedback.intersects(leaf, obstacle)).toBe(true);
    feedback.mark(leaf); expect((leaf.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff2424'); expect(obstacle.material).toBe(material);
    feedback.clear(); expect(leaf.material).toBe(material); feedback.dispose(); leaf.geometry.dispose(); obstacle.geometry.dispose(); material.dispose();
  });
  it('does not mistake a doorway hole for solid wall', () => {
    const shape = new THREE.Shape(); shape.moveTo(-1, 0); shape.lineTo(1, 0); shape.lineTo(1, 2); shape.lineTo(-1, 2); shape.closePath();
    const hole = new THREE.Path(); hole.moveTo(-.4, .001); hole.lineTo(-.4, 1.5); hole.lineTo(.4, 1.5); hole.lineTo(.4, .001); hole.closePath(); shape.holes.push(hole);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: false })), leaf = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.4, .018)); leaf.position.set(0, .75, .1); wall.updateMatrixWorld(); leaf.updateMatrixWorld();
    const feedback = new CollisionFeedback(); expect(feedback.intersects(leaf, wall, true)).toBe(false); leaf.position.x = .2; leaf.updateMatrixWorld(); expect(feedback.intersects(leaf, wall, true)).toBe(true); feedback.dispose();
  });
  it('releases cabinet panel, door and nested-content resources repeatedly', () => {
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette })), baseline = resources.size;
    const c = layout(); c.panels = [shelf('shelf', .5)]; c.contents = [detergent('shelf')];
    for (let i = 0; i < 5; i++) { resources.ownTree(builder.build(entity({ ...c, doors: { ...c.doors, angles: [i * 20, 0] } })) ).dispose(); expect(resources.size).toBe(baseline); }
    palette.dispose(); expect(resources.size).toBe(0);
  });
});
