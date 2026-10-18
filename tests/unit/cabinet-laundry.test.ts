import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cabinetBasket, cabinetDoorPose, cabinetLeaves, setCabinetDoorAngle, splitCabinetFront } from '../../src/domain/cabinet/CabinetFronts';
import { cabinetIssues, defaultCabinet, resolveContent, settleContent, validateCabinet, withCabinetFrontSections } from '../../src/domain/cabinet/CabinetLayout';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const size = { x: .6, y: 1.9, z: .35 }, laundry = () => defaultCabinet({ dimensions: size, assetKey: 'cabinet_laundry_tiltout' }, 2);
function entity(c = laundry()) { return codec.factory.furniture({ id: 'laundry', name: 'cabinet_laundry_tiltout', assetKey: 'cabinet_laundry_tiltout', displayName: 'Laundry cabinet', category: 'storage', dimensions: size, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet: c }); }
function meshes(root: THREE.Object3D) { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) result.push(o); }); return result; }

describe('mop sets and stacked laundry fronts', () => {
  it('adds a wider spin bucket set, with separate bucket, mop, handle and wringer geometry', () => {
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    expect(catalog.get('fit_spin_mop_set')!.defaultDimensions.x).toBeGreaterThan(catalog.get('fit_mop_set')!.defaultDimensions.x);
    for (const key of ['fit_flat_mop', 'fit_mop_set', 'fit_spin_mop_set']) {
      const a = catalog.get(key)!, item = codec.factory.furniture({ id: key, name: key, assetKey: key, category: 'decor', displayName: a.name, dimensions: a.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
      const root = builder.build(item), bounds = new THREE.Box3().setFromObject(root), sections = new Set(meshes(root).map(m => m.userData.section));
      expect([...sections].some(s => /Mop Head/.test(s))).toBe(true);
      if (key !== 'fit_flat_mop') { expect(sections.has('Bucket')).toBe(true); expect(sections.has('Mop Handle')).toBe(true); expect(sections.has(key === 'fit_spin_mop_set' ? 'Spin Basket' : 'Wringer')).toBe(true); }
      expect(bounds.min.y).toBeGreaterThanOrEqual(-.001); expect(bounds.max.y).toBeLessThanOrEqual(a.defaultDimensions.y + .001);
      expect(bounds.max.x).toBeLessThanOrEqual(a.defaultDimensions.x / 2 + .001); expect(bounds.min.x).toBeGreaterThanOrEqual(-a.defaultDimensions.x / 2 - .001);
      resources.ownTree(root).dispose();
    }
    palette.dispose(); expect(resources.size).toBe(0);
  });
  it('creates the photo layout with two tilt-out baskets below a pair of upper doors', () => {
    const c = laundry(); validateCabinet(c);
    expect(c.frontSections).toHaveLength(3); expect(cabinetLeaves(c, size).map(l => l.tilt)).toEqual([true, true, false, false]);
    expect(cabinetIssues(c, size).size).toBe(0);
    const opened = setCabinetDoorAngle(c, 0, 40);
    expect(cabinetDoorPose(size, opened, 0).rotationX).toBeCloseTo(40 * Math.PI / 180);
    expect(cabinetDoorPose(size, opened, 0).rotationY).toBe(0);
    expect(cabinetLeaves(opened, size).map(l => l.angle)).toEqual([40, 0, 0, 0]);
  });
  it('splits a front at exact heights without altering interior panels or contents', () => {
    const c = defaultCabinet({ dimensions: size, assetKey: 'cabinet_tall_single' }, 1);
    const split = splitCabinetFront(c, size, undefined, .6, 'upper');
    expect(split.frontSections!.map(s => [s.bottom, s.top])).toEqual([[0, .6], [.6, 'top']]);
    expect(split.panels).toBe(c.panels); expect(split.contents).toBe(c.contents);
    expect(cabinetLeaves(splitCabinetFront(split, size, 'upper', 1.2, 'top'), size)).toHaveLength(3);
    expect(splitCabinetFront(c, size, undefined, 0, 'bad')).toBe(c);
    expect(cabinetIssues(split, { ...size, y: .5 }).get('door_0')).toContain('Front outside cabinet height');
    expect(split.frontSections![0].top).toBe(.6);
  });
  it('settles objects onto basket floors, carries them with the front and preserves them when a basket is removed', () => {
    const c = laundry(), basket = cabinetBasket(c, size, cabinetLeaves(c, size)[0])!;
    const object = { id: 'bottle', name: 'Detergent', assetKey: 'fit_detergent', dimensions: { x: .15, y: .3, z: .09 }, rotationY: 0, position: { x: basket.floor.position.x + .02, y: basket.floor.position.y + .15, z: basket.floor.position.z + .02 } };
    c.contents.push(settleContent(c, size, object)); expect(c.contents[0].supportId).toBe('basket_lower_0'); expect(cabinetIssues(c, size).size).toBe(0);
    const closedPosition = resolveContent(c, size, c.contents[0]).position;
    const root = builder.build(entity(setCabinetDoorAngle(c, 0, 40))), group = root.getObjectByName('cabinet_content_bottle')!;
    expect(group.parent!.name).toBe('cabinet_door_0'); expect(group.parent!.rotation.x).toBeCloseTo(40 * Math.PI / 180);
    const removed = withCabinetFrontSections(c, size, c.frontSections!.slice(1));
    expect(removed.contents[0].supportId).toBeUndefined(); expect(removed.contents[0].position).toEqual(closedPosition); validateCabinet(removed);
    expect(cabinetIssues(removed, size).get('bottle')).toContain('Unsupported');
  });
  it('keeps a floor-level tilt-out leaf above the finished floor without moving its closed basket', () => {
    const c = laundry(); c.frontSections![0].bottom = 0;
    const root = builder.build(entity(c)), pivot = root.getObjectByName('cabinet_door_0')!;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4)); floor.rotation.x = -Math.PI / 2; floor.position.y = .002; floor.updateMatrixWorld(true);
    const feedback = new CollisionFeedback();
    const closed = cabinetDoorPose(size, c, 0, 0);
    expect(closed.position.z + closed.leafOffsetZ).toBeCloseTo(size.z / 2 - c.panelThickness / 2);
    for (let angle = 0; angle <= 60; angle++) {
      const pose = cabinetDoorPose(size, c, 0, angle);
      pivot.position.set(pose.position.x, pose.position.y, pose.position.z); pivot.rotation.x = pose.rotationX; root.updateMatrixWorld(true);
      for (const part of meshes(pivot)) expect(feedback.intersects(part, floor), `${angle} degrees / ${part.userData.section}`).toBe(false);
    }
    feedback.dispose();
  });
  it('retains stacked fronts, basket depth, supported contents and angles in both saved formats', () => {
    const c = laundry(); c.frontSections![0].basketDepth = .27;
    const document = new PlanDocument([entity(setCabinetDoorAngle(c, 1, 35))], 2.7);
    for (const raw of [codec.encode(document), new LegacyPlanWriter().encode(document)]) expect(codec.decode(raw).requireFurniture('laundry').cabinet).toEqual(document.requireFurniture('laundry').cabinet);
    const bad = laundry(); bad.frontSections![0].doors.angles[0] = 61; expect(() => validateCabinet(bad)).toThrow('angle');
  });
  it('clears the carcass while the laundry fronts tilt and detects obstacles crossed by basket panels', () => {
    const c = laundry(), root = builder.build(entity(c)), pivot = root.getObjectByName('cabinet_door_0')!, feedback = new CollisionFeedback();
    const moving = meshes(pivot), shell = meshes(root).filter(m => m.userData.cabinetPart?.startsWith('shell_'));
    for (const angle of [0, 10, 30, 40, 60]) {
      pivot.rotation.x = angle * Math.PI / 180; root.updateMatrixWorld(true);
      for (const a of moving) for (const b of shell) expect(feedback.intersects(a, b), `${angle} / ${a.userData.section} / ${b.userData.cabinetPart}`).toBe(false);
    }
    const obstacle = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .08)); obstacle.position.set(.24, .48, .22); obstacle.updateMatrixWorld(true);
    let basketHit = false;
    for (let angle = 0; angle <= 40; angle += 2) {
      pivot.rotation.x = angle * Math.PI / 180; root.updateMatrixWorld(true);
      if (moving.filter(m => m.userData.section === 'Laundry Basket').some(m => feedback.intersects(m, obstacle))) basketHit = true;
    }
    expect(basketHit).toBe(true); feedback.dispose(); obstacle.geometry.dispose();
  });
});
