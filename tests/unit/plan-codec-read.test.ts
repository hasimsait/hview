import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { rawPlan } from './fixtures';

const parser = new PlanCodec();

describe('plan parsing', () => {
  it('accepts JSON and objects with the same result', () => {
    expect(parser.decode(JSON.stringify(rawPlan()))).toEqual(parser.decode(rawPlan()));
  });
  it('rejects malformed JSON', () => {
    expect(() => parser.decode('{broken')).toThrow(SyntaxError);
  });
  it('converts wall and room coordinates from centimeters to meters', () => {
    const plan = parser.decode(rawPlan());
    expect(plan.totalHeight).toBe(3);
    expect(plan.walls[0]).toMatchObject({ p2: { x: 4, y: 0 }, thickness: 0.2, height: 3 });
    expect(plan.rooms[0]).toMatchObject({ name: 'Living room', polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] });
  });
  it('sorts openings and restores height, position and hinge orientation', () => {
    const [door, window] = parser.decode(rawPlan()).walls[0].openings;
    expect(door).toMatchObject({ id: 'door', type: 'door', distanceAlongWall: 1, width: 0.8, height: 2.1, swingSide: 'l', hingeSide: 'r' });
    expect(window).toMatchObject({ id: 'window', type: 'window', distanceAlongWall: 3, floorHeight: 0.9 });
  });
  it('maps furniture axes, elevation, dimensions and rotation', () => {
    expect(parser.decode(rawPlan()).furniture[0]).toMatchObject({
      position: { x: 1.5, y: 0.25, z: 2 }, dimensions: { x: 1.8, y: 0.75, z: 0.8 }, rotationY: Math.PI / 2, category: 'seating',
    });
  });
  it('prefers exact 3D values over legacy rounded coordinates', () => {
    const raw = rawPlan();
    Object.assign(raw.plan.items.sofa, { position: { x: 1.2345, y: 0.1234, z: 3.4567 }, dimensions: { x: 1.2345, y: 0.5678, z: 0.9876 }, rotationY: 0.321 });
    expect(parser.decode(raw).furniture[0]).toMatchObject({ position: { x: 1.2345, y: 0.1234, z: 3.4567 }, dimensions: { x: 1.2345, y: 0.5678, z: 0.9876 }, rotationY: 0.321 });
  });
  it.each(['archive', 'demount'])('excludes %s walls', flag => {
    const raw = rawPlan();
    Object.assign(raw.plan.walls.wall, { [flag]: 1 });
    expect(parser.decode(raw).walls).toHaveLength(0);
  });
  it('excludes superseded parent walls after splitting', () => {
    const raw = rawPlan();
    Object.assign(raw.plan.walls, { wall_a: { ...raw.plan.walls.wall, p2: { x: 200, y: 0 } } });
    expect(parser.decode(raw).walls.map(w => w.id)).toEqual(['wall_a']);
  });
  it('loads a serialized PlanDocument without converting meters again', () => {
    const first = parser.decode(rawPlan());
    const restored = parser.decode(parser.encode(first));
    expect(restored.walls[0].p2).toEqual({ x: 4, y: 0 });
    expect(restored.furniture[0].position).toEqual(first.furniture[0].position);
  });
  it.each([['sample.plan', 47, 119], ['public/sample.plan', undefined, undefined]] as const)('loads %s with finite geometry', (file, walls, furniture) => {
    const plan = parser.decode(readFileSync(new URL('../../' + file, import.meta.url), 'utf8'));
    // Working plans are user data; only the fixed reset baseline pins counts.
    if (walls !== undefined) expect(plan.walls.length + plan.columns.length).toBe(walls);
    else expect(plan.walls.length + plan.columns.length).toBeGreaterThan(0);
    expect(plan.rooms).toHaveLength(10);
    if (furniture !== undefined) expect(plan.furniture).toHaveLength(furniture);
    else expect(plan.furniture.length).toBeGreaterThan(0);
    for (const item of plan.furniture) {
      expect(Object.values(item.position).every(Number.isFinite)).toBe(true);
      expect(Object.values(item.dimensions).every(n => Number.isFinite(n) && n > 0)).toBe(true);
    }
  });
});
