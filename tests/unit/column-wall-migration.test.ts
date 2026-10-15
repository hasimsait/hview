import { describe, expect, it } from 'vitest';
import { migrateColumnWalls } from '../../src/domain/codec/LegacyColumnMigration';
import type { ColumnData as ColumnEntity, PlanData as PlanDocument } from '../../src/domain/model/PlanData';

const paint = (color: string) => ({ type: 'paint' as const, color });
const inherited = ['#111111', '#222222', '#333333', '#444444'].map(paint);

function tinySpace(): PlanDocument {
  const polygon = [{ x: 1, y: 1 }, { x: 1.6, y: 1 }, { x: 1.6, y: 1.6 }, { x: 1, y: 1.6 }];
  const walls = polygon.map((p1, i) => ({
    id: `outline_${i}`, p1, p2: polygon[(i + 1) % polygon.length],
    thickness: 0.1, height: 2.8, material: 'brick', openings: [], roomIds: ['small'],
    // The polygon is counterclockwise, so side B faces outward.
    finishSideA: paint('#ffffff'), finishSideB: inherited[i],
  }));
  return {
    version: 3, totalHeight: 3, walls, columns: [], furniture: [], rawPlan: {},
    rooms: [{
      id: 'small', name: 'Chimney', area: 0.36, height: 2.8, polygon,
      rawRoom: { edges: walls.map(wall => ({ pid: wall.id })) }
    }],
  };
}

function storedColumn(plan: PlanDocument): ColumnEntity {
  return {
    id: 'small', name: 'Column', type: 'column', width: 0.7, depth: 0.7,
    worldPos: { x: 1.3, y: 0, z: 1.3 }, rotationY: 0,
    stubIds: plan.walls.map(wall => wall.id),
  };
}

describe('legacy column wall migration', () => {
  it('fills a stored chimney from its perimeter and retains saved finishes', () => {
    const plan = tinySpace();
    plan.columns = [{
      ...storedColumn(plan), type: 'chimney', width: 0.1, depth: 0.1,
      worldPos: { x: 1, y: 0, z: 1 }, finishFront: paint('#abcdef'), finish: paint('#fedcba')
    }];
    migrateColumnWalls(plan, false);
    expect(plan.columns).toEqual([]);
    expect(plan.walls).toHaveLength(1);
    const wall = plan.walls[0];
    expect(wall).toMatchObject({
      id: 'small', isColumn: true, height: 2.8,
      finish: paint('#fedcba'), finishSideA: paint('#abcdef'), finishSideB: inherited[0],
      finishEdgeStart: inherited[3], finishEdgeEnd: inherited[1]
    });
    expect(wall.p1.x).toBeCloseTo(0.95);
    expect(wall.p2.x).toBeCloseTo(1.65);
    expect(wall.p1.y).toBeCloseTo(1.3);
    expect(wall.thickness).toBeCloseTo(0.7);
  });

  it('preserves geometry, finishes and unique IDs when migration runs repeatedly', () => {
    const plan = tinySpace();
    migrateColumnWalls(plan, false);
    plan.walls[0].finishSideA = paint('#abcdef');
    plan.walls[0].thickness = 0.9;
    const migrated = structuredClone(plan);
    migrateColumnWalls(plan);
    migrateColumnWalls(plan, false);
    expect(plan).toEqual(migrated);
    expect(plan.walls.map(wall => wall.id)).toEqual(['small']);
  });

  it('keeps split wall children without recreating the original tiny-space wall', () => {
    const plan = tinySpace();
    migrateColumnWalls(plan, false);
    const wall = plan.walls[0];
    const midpoint = { x: (wall.p1.x + wall.p2.x) / 2, y: wall.p1.y };
    plan.walls = [{ ...wall, id: 'small_a', p2: midpoint }, { ...wall, id: 'small_b', p1: midpoint }];
    const split = structuredClone(plan);
    migrateColumnWalls(plan);
    expect(plan).toEqual(split);
    expect(plan.walls.map(wall => wall.id)).toEqual(['small_a', 'small_b']);
  });

  it.each([
    ['finishFront', 'finishSideA', 2], ['finishBack', 'finishSideB', 0],
    ['finishLeft', 'finishEdgeStart', 3], ['finishRight', 'finishEdgeEnd', 1],
  ] as const)('inherits the exterior finish when a saved %s is explicitly undefined', (face, surface, edge) => {
    const plan = tinySpace();
    plan.columns = [{ ...storedColumn(plan), [face]: undefined }];
    migrateColumnWalls(plan, false);
    expect(plan.walls).toHaveLength(1);
    expect(plan.walls[0][surface]).toEqual(inherited[edge]);
  });

  it('prefers explicitly saved face finishes over the perimeter finishes', () => {
    const plan = tinySpace();
    const saved = paint('#abcdef');
    plan.columns = [{
      ...storedColumn(plan), finishFront: saved, finishBack: saved,
      finishLeft: saved, finishRight: saved
    }];
    migrateColumnWalls(plan, false);
    expect(plan.walls[0]).toMatchObject({
      finishSideA: saved, finishSideB: saved,
      finishEdgeStart: saved, finishEdgeEnd: saved
    });
  });
});
