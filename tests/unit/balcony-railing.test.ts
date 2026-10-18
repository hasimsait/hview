import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { openRailingRuns, DEFAULT_BALCONY_RAILING } from '../../src/domain/model/BalconyRailing';
import { buildBalconyRailing } from '../../src/engine/geometry/BalconyRailingGeometry';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureBalconyRailing } from '../../src/application/commands/StructuralCommands';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { rawPlan } from './fixtures';

const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }];
const wall = (x: number, y: number, endX: number, endY: number) => ({ p1: { x, y }, p2: { x: endX, y: endY }, thickness: .2 });
const walls = [wall(0, 0, 4, 0), wall(0, 0, 0, 2), wall(4, 0, 4, 2)];
const length = (run: ReturnType<typeof openRailingRuns>[number]) => Math.hypot(run.end.x - run.start.x, run.end.y - run.start.y);

describe('floor-bound balcony railings', () => {
  it('fills only the open front and terminates at the two wall faces', () => {
    const runs = openRailingRuns(polygon, walls);
    expect(runs).toHaveLength(1); expect(runs[0]).toMatchObject({ edge: 2, startAtWall: true, endAtWall: true });
    expect(runs[0].start.x).toBeCloseTo(3.9); expect(runs[0].end.x).toBeCloseTo(.1);
    expect(runs[0].start.y).toBeCloseTo(1.975); expect(length(runs[0])).toBeCloseTo(3.8);
  });
  it('joins three open edges at shared inset corners with single corner posts', () => {
    const runs = openRailingRuns(polygon, walls.slice(0, 1));
    expect(runs.map(run => run.edge)).toEqual([1, 2, 3]);
    expect(runs[0].end).toEqual(runs[1].start); expect(runs[1].end).toEqual(runs[2].start);
    expect(runs[0].end.x).toBeCloseTo(3.975); expect(runs[0].end.y).toBeCloseTo(1.975);
    const root = buildBalconyRailing('balcony', DEFAULT_BALCONY_RAILING, runs), mesh = root.children[0] as THREE.Mesh;
    expect(mesh.userData.postCount).toBe(9);
    const bounds = new THREE.Box3().setFromObject(root); expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(1.05);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-.001); expect(bounds.max.x).toBeLessThanOrEqual(4.001); expect(bounds.max.z).toBeLessThanOrEqual(2.001);
    const resources = new ResourcePool(); resources.ownTree(root).dispose(); expect(resources.size).toBe(0);
  });
  it('supports reversed winding and rotated walls without changing the usable open span', () => {
    expect(openRailingRuns([...polygon].reverse(), walls).reduce((sum, run) => sum + length(run), 0)).toBeCloseTo(3.8);
    const rotate = (p: { x: number; y: number }) => ({ x: p.x * Math.cos(.63) - p.y * Math.sin(.63), y: p.x * Math.sin(.63) + p.y * Math.cos(.63) });
    const runs = openRailingRuns(polygon.map(rotate), walls.map(w => ({ ...w, p1: rotate(w.p1), p2: rotate(w.p2) })));
    expect(runs).toHaveLength(1); expect(length(runs[0])).toBeCloseTo(3.8); expect(runs[0].startAtWall && runs[0].endAtWall).toBe(true);
  });
  it('recognizes polygons drawn at the inside wall face and does not leave a gap at the end walls', () => {
    const inside = [{ x: .1, y: .1 }, { x: 3.9, y: .1 }, { x: 3.9, y: 2 }, { x: .1, y: 2 }];
    const runs = openRailingRuns(inside, walls); expect(runs).toHaveLength(1);
    expect(runs[0].start.x).toBeCloseTo(3.9); expect(runs[0].end.x).toBeCloseTo(.1); expect(length(runs[0])).toBeCloseTo(3.8);
  });
  it('skips partial walls, tiny slivers, disabled edges and zero-length polygon edges', () => {
    const runs = openRailingRuns(polygon, [...walls, wall(1.5, 2, 2.5, 2)]);
    expect(runs).toHaveLength(2); expect(runs.map(length)).toEqual([expect.closeTo(1.4), expect.closeTo(1.4)]);
    expect(openRailingRuns(polygon, walls, [])).toEqual([]);
    expect(openRailingRuns(polygon, walls, [0])).toEqual([]);
    expect(openRailingRuns([...polygon, polygon[0]], walls).map(length)).toEqual([expect.closeTo(3.8)]);
    expect(openRailingRuns(polygon, [...walls, wall(.13, 2, 4, 2)])).toEqual([]);
  });
  it('preserves other room and house edits through undo, both plan formats and railing removal', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    const before = editor.getDocument(), room = before.requireRoom('room');
    editor.execute(new ConfigureBalconyRailing('room', { height: 1.12, color: '#758594', edges: [1, 2] }));
    expect(editor.getDocument().requireRoom('room').polygon).toEqual(room.polygon);
    expect(editor.getDocument().furniture).toEqual(before.furniture); expect(editor.getDocument().walls).toEqual(before.walls);
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded), railing = restored.requireRoom('room').railing;
      expect(railing).toEqual({ height: 1.12, color: '#758594', edges: [1, 2] });
      editor.load(restored); editor.execute(new ConfigureBalconyRailing('room'));
      expect(codec.decode(new LegacyPlanWriter().encode(editor.getDocument())).requireRoom('room').railing).toBeUndefined();
    }
    editor.load(before); editor.execute(new ConfigureBalconyRailing('room', DEFAULT_BALCONY_RAILING)); editor.undo(); expect(editor.getDocument()).toBe(before);
    editor.redo(); expect(editor.getDocument().requireRoom('room').railing).toEqual(DEFAULT_BALCONY_RAILING);
    expect(() => editor.execute(new ConfigureBalconyRailing('room', { ...DEFAULT_BALCONY_RAILING, edges: [99] }))).toThrow('Invalid railing edge');
  });
});
