import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cabinetDoorPose, cabinetDrawer, cabinetDrawerTrays, cabinetInternalDrawer, cabinetLeaves, setCabinetDoorAngle } from '../../src/domain/cabinet/CabinetFronts';
import { cabinetIssues, defaultCabinet, removeCabinetPart, resolveContent, stackContent, validateCabinet, type CabinetLayout } from '../../src/domain/cabinet/CabinetLayout';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
const size = { x: .6, y: .8, z: .6 }, codec = new PlanCodec(), builder = new FurnitureMeshBuilder();
const layout = () => defaultCabinet({ dimensions: size, assetKey: 'cabinet_drawers_three' }, 1);
function entity(c: CabinetLayout) { return codec.factory.furniture({ id: 'cabinet', name: 'cabinet', assetKey: 'cabinet_drawers_three', displayName: 'Cabinet', category: 'storage', dimensions: size, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet: c }); }
describe('pull-out drawers', () => {
  it('translates a front and box along telescopic travel without rotation and preserves other drawers', () => {
    const c = layout(), closed = cabinetDoorPose(size, c, 0), open = setCabinetDoorAngle(c, 0, 100), pose = cabinetDoorPose(size, open, 0);
    expect(pose.position.z - closed.position.z).toBeCloseTo(cabinetDrawer(c, size, cabinetLeaves(c, size)[0])!.travel);
    expect(pose.rotationX).toBe(0); expect(pose.rotationY).toBe(0);
    expect(cabinetLeaves(open, size)[0].extension).toBe(1);
    expect(cabinetLeaves(open, size)[1].extension).toBe(0);
    expect(cabinetIssues(c, size).size).toBe(0);
  });
  it('keeps drawer box height separate from its facade and reports panel-subtracted usable volume', () => {
    const c = layout(); c.frontSections![0].drawerBoxHeight = .10;
    const tray = cabinetDrawer(c, size, cabinetLeaves(c, size)[0])!;
    expect(c.frontSections![0].top).toBe(.2);
    expect(tray.usable.y).toBeCloseTo(.092); expect(tray.usable.x).toBeLessThan(tray.floor.dimensions.x); expect(tray.usable.z).toBeLessThan(tray.floor.dimensions.z);
  });
  it('moves supported objects and their stacks with the sliding drawer', () => {
    let c = layout(); const tray = cabinetDrawerTrays(c, size)[0];
    c.contents = [{ id: 'roll', name: 'Roll', assetKey: 'fit_toilet_roll', dimensions: { x: .12, y: .04, z: .12 }, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId: tray.floor.id }];
    c = stackContent(c, 'roll', ['upper']); validateCabinet(c);
    const closed = builder.build(entity(c)), open = builder.build(entity(setCabinetDoorAngle(c, 0, 100)));
    closed.updateMatrixWorld(true); open.updateMatrixWorld(true);
    for (const id of ['roll', 'upper']) {
      const a = closed.getObjectByName(`cabinet_content_${id}`)!.getWorldPosition(new THREE.Vector3()), b = open.getObjectByName(`cabinet_content_${id}`)!.getWorldPosition(new THREE.Vector3());
      expect(b.z - a.z).toBeCloseTo(tray.travel); expect(b.y).toBeCloseTo(a.y);
    }
    expect(cabinetIssues(c, size).size).toBe(0);
  });
  it('supports internal drawers, serialization and removing a loaded drawer without moving contents', () => {
    const c = layout(); c.internalDrawers = [{ id: 'inside', name: 'Internal drawer', bottom: .6, height: .10, depth: .4, setback: .02, extension: .7 }];
    const tray = cabinetInternalDrawer(c, size, c.internalDrawers[0]);
    c.contents = [{ id: 'shirt', name: 'Shirt', assetKey: 'fit_folded_tshirt', dimensions: { x: .28, y: .025, z: .32 }, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId: tray.floor.id }];
    const restored = codec.decode(codec.encode(new PlanDocument([entity(c)], 2.7))).requireFurniture('cabinet').cabinet!;
    expect(restored).toEqual(c);
    expect(codec.decode(new LegacyPlanWriter().encode(new PlanDocument([entity(c)], 2.7))).requireFurniture('cabinet').cabinet).toEqual(c);
    const before = resolveContent(c, size, c.contents[0]).position;
    const removed = removeCabinetPart(c, size, tray.floor.id);
    validateCabinet(removed); expect(removed.internalDrawers).toEqual([]); expect(removed.contents[0].supportId).toBeUndefined(); expect(removed.contents[0].position).toEqual(before);
    const closed = builder.build(entity({ ...c, internalDrawers: [{ ...c.internalDrawers[0], extension: 0 }] })), open = builder.build(entity(c));
    closed.updateMatrixWorld(true); open.updateMatrixWorld(true);
    expect(open.getObjectByName('cabinet_content_shirt')!.getWorldPosition(new THREE.Vector3()).z - closed.getObjectByName('cabinet_content_shirt')!.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(.4 * .9 * .7);
  });
  it('rejects invalid extension and box dimensions', () => {
    const c = layout(); c.frontSections![0].drawerExtensions = [1.5, 0]; expect(() => validateCabinet(c)).toThrow('extension');
    c.frontSections![0].drawerExtensions = [0, 0]; c.frontSections![0].drawerBoxHeight = -.1; expect(() => validateCabinet(c)).toThrow();
    const internal = { ...layout(), frontSections: undefined, internalDrawers: [{ id: 'bad', name: 'Bad', bottom: 0, height: .16, depth: .3, setback: .02, extension: 2 }] };
    expect(() => validateCabinet(internal)).toThrow('Invalid internal drawer');
  });
});
