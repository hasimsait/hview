import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FloorMeshBuilder } from '../../src/engine/geometry/FloorMeshBuilder';
import { floorDoorwayPolygons } from '../../src/engine/geometry/FloorDoorways';
import { Room } from '../../src/domain/elements/Room';
import { Wall } from '../../src/domain/elements/Wall';
import { Door } from '../../src/domain/elements/Opening';
import type { CanvasFactory } from '../../src/engine/materials/CanvasFactory';

const canvas = { create: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {} }) }) } as unknown as CanvasFactory;
const builder = new FloorMeshBuilder(undefined, canvas);
const room = (side: number) => new Room({ id: `room_${side}`, name: 'Room', area: 12, height: 2.7, polygon: [{ x: 0, y: side * .05 }, { x: 4, y: side * .05 }, { x: 4, y: side * 3 }, { x: 0, y: side * 3 }] });
const door = (floorHeight = 0, distance = 2) => new Door({ id: 'door', wallId: 'wall', type: 'door', width: 1, height: 2.1, floorHeight, distanceAlongWall: distance, position: { x: distance, y: 0 } });
const wall = (opening = door()) => new Wall({ id: 'wall', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: .1, height: 2.7, material: 'a_block', openings: [] }, [opening]);
const covered = (root: THREE.Object3D, x: number, z: number) => {
  root.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true).some(hit => hit.object instanceof THREE.Mesh);
};

describe('floors through doorways', () => {
  it('fills both halves of a doorway without filling the solid wall or changing the room polygon', () => {
    for (const side of [-1, 1]) {
      const original = room(side), polygon = structuredClone(original.polygon);
      const floor = builder.buildFloor(original, false, [wall()]);
      for (const z of [.001, .02, .049, .06]) expect(covered(floor, 2, side * z)).toBe(true);
      expect(covered(floor, .5, side * .02)).toBe(false);
      expect(covered(floor, 2, -side * .02)).toBe(false);
      expect(original.polygon).toEqual(polygon);
      expect(floor.children.filter(child => child instanceof THREE.Mesh)).toHaveLength(1);
    }
  });

  it('does not extend through raised openings, across unrelated rooms or beyond the jambs', () => {
    expect(floorDoorwayPolygons(room(1), [wall(door(.85))])).toEqual([]);
    const distant = new Room({ ...room(1).toData(), polygon: room(1).polygon.map(point => ({ x: point.x, y: point.y + 1 })) });
    expect(floorDoorwayPolygons(distant, [wall()])).toEqual([]);
    const floor = builder.buildFloor(room(1), false, [wall()]);
    expect(covered(floor, 1.49, .02)).toBe(false);
    expect(covered(floor, 2.51, .02)).toBe(false);
  });

  it('uses actual room boundaries when a long wall has incorrect room-side metadata', () => {
    const original = wall().toData();
    const misleading = new Wall({ ...original, roomSideA: 'elsewhere', roomSideB: 'elsewhere' }, [door()]);
    expect(covered(builder.buildFloor(room(1), false, [misleading]), 2, .02)).toBe(true);
  });

  it('keeps rotated doorway coverage and texture coordinates continuous with its room', () => {
    const angle = .37, rotate = (x: number, y: number) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) });
    const original = room(1), rotated = new Room({ ...original.toData(), polygon: original.polygon.map(point => rotate(point.x, point.y)) });
    const rotatedWall = new Wall({ ...wall().toData(), p1: rotate(0, 0), p2: rotate(4, 0) }, [door()]);
    const floor = builder.buildFloor(rotated, false, [rotatedWall]), point = rotate(2, .02);
    expect(covered(floor, point.x, point.y)).toBe(true);
    const mesh = floor.children[0] as THREE.Mesh, geometry = mesh.geometry;
    const minX = Math.min(...rotated.polygon.map(p => p.x)), minY = Math.min(...rotated.polygon.map(p => p.y));
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      expect(geometry.attributes.uv.getX(i)).toBeCloseTo(geometry.attributes.position.getX(i) - minX);
      expect(geometry.attributes.uv.getY(i)).toBeCloseTo(-geometry.attributes.position.getY(i) - minY);
    }
  });
});
