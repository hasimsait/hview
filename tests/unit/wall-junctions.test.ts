import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { Wall } from '../../src/domain/elements/Wall';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { WallJunctions } from '../../src/domain/model/WallJunctions';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';

const codec = new PlanCodec();
function wall(id: string, p1: [number, number], p2: [number, number]) {
  return new Wall({ id, p1: { x: p1[0], y: p1[1] }, p2: { x: p2[0], y: p2[1] }, thickness: 0.1, height: 2.7, material: 'a_block', openings: [] }, []);
}
function junction() {
  return [
    wall('stub', [0, 0], [0, -0.05]),
    wall('left', [-3, 0], [0, 0]),
    wall('right', [0.05, 0], [2, 0]),
    wall('door', [0, 0.05], [0, 2]),
  ];
}

describe('wall junction geometry', () => {
  it.each(['sample.plan', 'tests/fixtures/reported-geometry.json'])('keeps the door-wall corner solid in %s', file => {
    const document = codec.decode(readFileSync(file, 'utf8'));
    const doorWall = document.requireWall(file === 'sample.plan' ? '_w5f7a' : '_w5f7a_a');
    const builder = new WallMeshBuilder({ getMaterial: () => new THREE.MeshStandardMaterial() } as any);
    const mesh = builder.buildWall(doorWall);
    mesh.updateMatrixWorld(true);
    // Above the original wall start, before the door opening: this strip was
    // incorrectly removed when a 5 cm stub became its own through-wall pair.
    for (const distance of [0.005, 0.015, 0.025, 0.035, 0.045]) {
      const point = new THREE.Vector3(doorWall.p1.x, 4, doorWall.p1.y + distance);
      const hits = new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0)).intersectObject(mesh, true);
      expect(hits.some(hit => hit.object instanceof THREE.Mesh), `missing wall ${distance} m after p1`).toBe(true);
    }
  });

  it('uses actual through-walls instead of a tiny stub, regardless of input order', () => {
    const walls = junction();
    for (const order of [walls, [...walls].reverse(), [walls[2], walls[3], walls[0], walls[1]]]) {
      const offsets = WallJunctions.resolve(order);
      expect(offsets.get('door')?.startOffset).toBeCloseTo(0);
      expect(offsets.get('left')?.endOffset).toBeCloseTo(0.025);
      expect(offsets.get('right')?.startOffset).toBeCloseTo(0.025);
    }
  });

  it('repairs stale canonical junction offsets without moving coordinates or losing finishes', () => {
    const source = codec.decode(readFileSync('tests/fixtures/reported-geometry.json', 'utf8'));
    const saved = JSON.parse(codec.encode(source));
    const entry = saved.document.elements.find((element: { data: { id: string } }) => element.data.id === '_w5f7a_a');
    entry.data.startOffset = -0.04958251372095414;
    const restored = codec.decode(saved).requireWall('_w5f7a_a');
    expect(restored.startOffset ?? 0).toBeCloseTo(0);
    expect(restored.p1).toEqual(entry.data.p1);
    expect(restored.p2).toEqual(entry.data.p2);
    expect(restored.finishSideB).toEqual(entry.data.finishSideB);
    expect(restored.openings.map(opening => opening.id)).toEqual(['_p52jo']);
  });

  it('recalculates neighbors after deletion and preserves unchanged wall identity on finish edits', () => {
    const first = wall('first', [0, 0], [2, 0]);
    const second = wall('second', [0, 0], [0, 1]);
    const document = new PlanDocument([first, second]);
    expect(document.requireWall('first').startOffset).toBeCloseTo(0.05);
    const edited = document.replace(document.requireWall('second').withFinish('A', { type: 'paint', color: '#ffffff' }));
    expect(edited.requireWall('first')).toBe(document.requireWall('first'));
    expect(document.remove('second').requireWall('first').startOffset ?? 0).toBeCloseTo(0);
  });
});
