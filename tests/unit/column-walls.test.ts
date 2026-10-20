import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { Column } from '../../src/domain/elements/Column';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';
import { rawPlan } from './fixtures';
const codec = new PlanCodec();
const paint = (color: string) => ({ type: 'paint' as const, color });
function column() {
  return {
    id: 'column', type: 'column', width: 0.6, depth: 0.4, height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: Math.PI / 2,
    finishFront: paint('#111111'), finishBack: paint('#222222'), finishLeft: paint('#333333'), finishRight: paint('#444444')
  };
}
describe('first-class columns with one solid footprint', () => {
  it('imports a rotated column with all face finishes and original dimensions', () => {
    const raw = rawPlan(); Object.assign(raw.plan, { columns: [column()] });
    const document = codec.decode(raw), element = document.columns[0];
    expect(element).toBeInstanceOf(Column); expect(element.width).toBeCloseTo(0.6); expect(element.depth).toBeCloseTo(0.4);
    const shape = element.wallShape(document.totalHeight);
    expect(shape.p1.x).toBeCloseTo(2); expect(shape.p1.y).toBeCloseTo(2.3);
    expect(shape.p2.y).toBeCloseTo(1.7); expect(shape.finishEdgeStart).toEqual(paint('#333333'));
    expect(document.walls.every(wall => wall.id !== element.id)).toBe(true);
  });
  it('removes source stubs once and retains edits across both formats', () => {
    const raw = rawPlan(); raw.plan.walls.wall.holes = {} as any; Object.assign(raw.plan, { columns: [{ ...column(), stubIds: ['wall'] }] });
    const original = codec.decode(raw);
    expect(original.walls).toHaveLength(0);
    let document = original.replace(original.columns[0].withFinish('back', paint('#abcdef')));
    for (const writer of [codec, new LegacyPlanWriter(), codec, new LegacyPlanWriter()]) {
      document = codec.decode(writer.encode(document));
      expect(document.walls).toHaveLength(0); expect(document.columns).toHaveLength(1);
      expect(document.columns[0].finishBack).toEqual(paint('#abcdef'));
    }
  });
  it('detects legacy column outlines once and preserves ordinary short walls on reload', () => {
    const raw = JSON.parse(readFileSync('sample.plan', 'utf8')); delete raw.plan.columns;
    const document = codec.decode(raw);
    expect(document.columns.length).toBeGreaterThan(0);
    const restored = codec.decode(codec.encode(document));
    expect(restored.walls.map(wall => wall.id)).toEqual(document.walls.map(wall => wall.id));
    expect(restored.columns.map(column => column.id)).toEqual(document.columns.map(column => column.id));
  });
  it.each([0.49, 0.5])('converts only interiors below 0.5 m² into solids (%s)', area => {
    const raw: any = rawPlan(); raw.plan.walls = {};
    const corners = [{ x: 100, y: 100 }, { x: 160, y: 100 }, { x: 160, y: 160 }, { x: 100, y: 160 }];
    raw.plan.rooms2 = { small: { title: 'Small space', area, polygon: corners } };
    for (let i = 0; i < 4; i++) raw.plan.walls['outline_' + i] = { p1: corners[i], p2: corners[(i + 1) % 4], depth: 10, height: 300 };
    const document = codec.decode(raw);
    if (area === 0.5) { expect(document.rooms.map(room => room.id)).toEqual(['small']); return; }
    expect(document.rooms).toHaveLength(0); expect(document.walls).toHaveLength(0); expect(document.columns).toHaveLength(1);
    const builder = new WallMeshBuilder({ getMaterial: () => new THREE.MeshStandardMaterial() } as any);
    const group = builder.buildWall(document.columns[0].wallShape(3)); group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(1.3, 4, 1.3), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(group, true).length).toBeGreaterThan(0);
    expect(codec.decode(codec.encode(document)).columns[0].id).toBe('small');
  });
});
