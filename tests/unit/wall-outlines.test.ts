import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Wall } from '../../src/domain/elements/Wall';
import { Door } from '../../src/domain/elements/Opening';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';

const builder = new WallMeshBuilder({ getMaterial: () => new THREE.MeshStandardMaterial() } as unknown as SurfaceMaterialFactory);
const wall = (id: string, x1: number, x2: number) => new Wall({ id, p1: { x: x1, y: 0 }, p2: { x: x2, y: 0 }, thickness: .1, height: 2.7, material: 'a_block', openings: [] }, []);
const build = (item: Wall, neighbors: Wall[]) => builder.buildWall(item, undefined, undefined, undefined, undefined, undefined, neighbors);
function verticals(root: THREE.Group, x: number, z: number) {
  const result: number[][] = [];
  root.updateMatrixWorld(true);
  root.traverse(line => {
    if (!(line instanceof THREE.LineSegments) || line.name !== 'wallOutline') return;
    const positions = line.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(line.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1).applyMatrix4(line.matrixWorld);
      if ([a, b].every(point => Math.abs(point.x - x) < .002 && Math.abs(point.z - z) < .002) && Math.abs(a.y - b.y) > .002) result.push([Math.min(a.y, b.y), Math.max(a.y, b.y)]);
    }
  });
  return result;
}

describe('joined wall outlines', () => {
  it('removes a split seam while keeping exterior contours and independent wall meshes', () => {
    const first = wall('first', 0, 2), second = wall('second', 2, 4);
    for (const item of [first, second]) {
      const root = build(item, [first, second]);
      expect(verticals(root, 2, .05)).toEqual([]);
      expect(verticals(root, 2, -.05)).toEqual([]);
      expect(verticals(root, item === first ? 0 : 4, .05)).toHaveLength(1);
      const mesh = root.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
      expect(mesh.geometry.attributes.position.count).toBe(24);
      expect(mesh.userData.id).toBe(item.id);
    }
  });

  it('matches case-insensitive colors and reversed wall directions', () => {
    const finish = (color: string) => ({ type: 'paint' as const, color, roughness: .85 });
    const first = wall('first', 0, 2).withFinish('A', finish('#DFCBAF'));
    const second = wall('second', 4, 2).withFinish('B', finish('#dfcbaf'));
    expect(verticals(build(first, [first, second]), 2, .05)).toEqual([]);
    expect(verticals(build(second, [first, second]), 2, .05)).toEqual([]);
  });

  it('retains real corners, thickness/height steps and finish changes on the affected face', () => {
    const first = wall('first', 0, 2), second = wall('second', 2, 4);
    const variants = [
      new Wall({ ...second.toData(), p2: { x: 2, y: 2 } }, []),
      new Wall({ ...second.toData(), thickness: .2 }, []),
      new Wall({ ...second.toData(), height: 2 }, []),
    ];
    for (const other of variants) expect(verticals(build(first, [first, other]), 2, .05)).toHaveLength(1);
    const painted = second.withFinish('A', { type: 'paint', color: '#333333' });
    const root = build(first, [first, painted]);
    expect(verticals(root, 2, .05)).toHaveLength(1);
    expect(verticals(root, 2, -.05)).toEqual([]);
  });

  it('keeps the exposed jamb below a neighboring lintel rather than removing its whole border', () => {
    const first = wall('first', 0, 2), second = wall('second', 2, 4);
    const opened = second.withOpenings([new Door({ id: 'door', wallId: second.id, type: 'door', floorHeight: 0, height: 2.1, width: 1, distanceAlongWall: .5, position: { x: 2.5, y: 0 } })]);
    const intervals = verticals(build(first, [first, opened]), 2, .05);
    expect(intervals).toHaveLength(1);
    expect(intervals[0][0]).toBeCloseTo(0);
    expect(intervals[0][1]).toBeCloseTo(2.1);
  });
});
