import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SlidingDoor } from '../../src/domain/elements/Opening';
import { Wall } from '../../src/domain/elements/Wall';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { SceneEngine } from '../../src/engine/SceneEngine';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';

function fixture(right = true) {
  const door = new SlidingDoor({ id: 'door', wallId: 'wall', type: 'door_coupe', width: .8, height: 2.1, floorHeight: 0, distanceAlongWall: 1, position: { x: 1, y: 0 }, swingSide: 'r', hingeSide: right ? 'r' : 'l', openAngle: 90 });
  const wall = new Wall({ id: 'wall', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: .1, height: 2.7, material: 'a_block', openings: [door.toData()] }, [door]);
  const builder = new OpeningMeshBuilder(), root = builder.buildOpening(door, wall), scene = new THREE.Scene(), picking = new PickRegistry(), feedback = new CollisionFeedback();
  scene.add(root); picking.register(root, { kind: 'opening', id: 'door' });
  const slider = builder.interactionTarget(root)!;
  const engine = Object.assign(Object.create(SceneEngine.prototype), { currentPlan: new PlanDocument([wall]), scene, picking, collisionFeedback: feedback, getRenderObject: () => root, getTransformTarget: () => slider, invalidate() {} }) as SceneEngine;
  return { door, wall, builder, root, scene, picking, feedback, slider, engine };
}

describe('sliding room door collision paths', () => {
  it.each([true, false])('checks handle travel between clear endpoint poses (right=%s)', right => {
    const { slider, scene, picking, feedback, engine } = fixture(right);
    const handle = slider.children.find(o => o.userData.isSwingCollider) as THREE.Mesh;
    const obstacle = new THREE.Mesh(new THREE.BoxGeometry(.01, .02, .001), new THREE.MeshBasicMaterial());
    obstacle.position.set(1 + handle.position.x + slider.position.x / 2, 1, handle.position.z + .0218);
    scene.add(obstacle); picking.register(obstacle, { kind: 'furniture', id: 'obstacle' }); scene.updateMatrixWorld(true);
    const pose = slider.matrixWorld.clone();
    expect(feedback.intersects(handle, obstacle)).toBe(false);
    expect(engine.checkDoorCollision('door', undefined, 0)).toBe(true);
    expect(slider.matrixWorld.equals(pose)).toBe(true); feedback.clear();
    expect(engine.checkDoorCollision('door')).toBe(false); feedback.dispose();
  });

  it('keeps the leaf and handle together without colliding with its own jamb', () => {
    const { door, root, wall, builder, slider, feedback, engine } = fixture();
    const leaf = root.getObjectByName('doorLeaf_door')!, closedLocal = leaf.position.clone(), handle = slider.children.find(o => o.userData.isSwingCollider)!;
    const handleLocal = handle.position.clone();
    expect(engine.checkDoorCollision('door', undefined, 0)).toBe(false);
    builder.update(root, new SlidingDoor({ ...door.toData(), openAngle: 0 }));
    expect(slider.position.x).toBe(0); expect(leaf.position.equals(closedLocal)).toBe(true); expect(handle.position.equals(handleLocal)).toBe(true);
    builder.update(root, new SlidingDoor({ ...door.toData(), openAngle: 180 }));
    expect(slider.position.x).toBeCloseTo(slider.userData.slideDistance);
    expect(builder.interactionTarget(root)).toBe(slider); expect(wall.openings[0]).toBe(door); feedback.dispose();
  });
});
