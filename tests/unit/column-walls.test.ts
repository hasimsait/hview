import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PlanParserService } from '../../src/services/plan/PlanParserService';
import { PlanExportService } from '../../src/services/plan/PlanExportService';
import { ThreeSceneService } from '../../src/services/rendering/ThreeSceneService';
import { AssetRegistryService } from '../../src/services/rendering/AssetRegistryService';
import { rawPlan } from './fixtures';

vi.mock('../../src/services/rendering/FloorGeometryService', () => ({ FloorGeometryService: class {} }));
const parser = new PlanParserService();
const paint = (color: string) => ({ type: 'paint' as const, color });
function legacyColumn() {
  return {
    id: 'old_column', type: 'column', width: 0.6, depth: 0.4, height: 3,
    worldPos: { x: 2, y: 0, z: 2 }, rotationY: Math.PI / 2,
    finishFront: paint('#111111'), finishBack: paint('#222222'),
    finishLeft: paint('#333333'), finishRight: paint('#444444'),
  };
}

describe('columns as single thick walls', () => {
  it('converts a rotated box into one solid wall with its original dimensions and face finishes', () => {
    const raw = rawPlan(); Object.assign(raw.plan, { columns: [legacyColumn()] });
    const plan = parser.parse(raw);
    expect(plan.columns).toEqual([]);
    const wall = plan.walls.find(w => w.id === 'old_column')!;
    expect(wall).toMatchObject({ isColumn: true, thickness: 0.4, height: 3,
      finishSideA: paint('#111111'), finishSideB: paint('#222222'),
      finishEdgeStart: paint('#333333'), finishEdgeEnd: paint('#444444') });
    expect(wall.p1.x).toBeCloseTo(2); expect(wall.p1.y).toBeCloseTo(2.3);
    expect(wall.p2.x).toBeCloseTo(2); expect(wall.p2.y).toBeCloseTo(1.7);
    expect(wall.roomIds).toContain('room');
  });

  it('replaces source stubs with one wall, preserving a column surface edit through repeated reloads', () => {
    const raw = rawPlan();
    raw.plan.walls.wall.holes = {} as any;
    const col = legacyColumn(); Object.assign(raw.plan, { columns: [{ ...col, stubIds: ['wall'] }] });
    const plan = parser.parse(raw);
    expect(plan.walls).toHaveLength(1);
    expect(plan.walls[0].id).toBe('old_column');
    plan.walls[0].finishSideB = paint('#abcdef');
    const exporter = new PlanExportService();
    const saved = exporter.exportPlan(plan);
    expect(JSON.parse(saved).plan.columns).toBeUndefined();
    expect(JSON.parse(saved).plan.walls.wall).toBeUndefined();
    const twice = parser.parse(exporter.exportPlan(parser.parse(saved)));
    expect(twice.walls).toHaveLength(1);
    expect(twice.walls[0]).toMatchObject({ id: col.id, thickness: col.depth, finishSideB: paint('#abcdef') });
    expect(parser.parse(JSON.stringify(plan)).walls).toHaveLength(1);
  });

  it('detects unsaved outlines once, rather than converting ordinary short walls again on reload', () => {
    const raw = JSON.parse(readFileSync('public/sample.plan', 'utf8'));
    delete raw.plan.columns;
    const plan = parser.parse(raw);
    const columns = plan.walls.filter(w => w.isColumn);
    expect(columns.length).toBeGreaterThan(0);
    const reload = parser.parse(new PlanExportService().exportPlan(plan));
    expect(reload.walls.map(w => w.id)).toEqual(plan.walls.map(w => w.id));
  });

  it.each([0.49, 0.5])('fills tiny interiors as one solid wall, with 0.5 m² remaining a room (%s)', area => {
    const raw: any = rawPlan();
    raw.plan.walls = {};
    const corners = [{ x: 100, y: 100 }, { x: 160, y: 100 }, { x: 160, y: 160 }, { x: 100, y: 160 }];
    raw.plan.rooms2 = { small: { title: 'Small space', area, polygon: corners } };
    for (let i = 0; i < 4; i++) raw.plan.walls['outline_' + i] = {
      p1: corners[i], p2: corners[(i + 1) % 4], depth: 10, height: 300,
    };
    raw.plan.walls.outline_0.finishSideB = paint('#123456');
    const plan = parser.parse(raw);
    if (area < 0.5) {
      expect(plan.rooms).toHaveLength(0);
      expect(plan.walls).toHaveLength(1);
      expect(plan.walls[0]).toMatchObject({ id: 'small', isColumn: true, finishSideB: paint('#123456') });
      const scene = new ThreeSceneService(new AssetRegistryService(), {
        getMaterial: () => new THREE.MeshStandardMaterial(), setForegroundMode: vi.fn(), setForegroundOpacity: vi.fn(),
      } as any);
      scene.rebuildWalls(plan);
      const group = scene.getScene().getObjectByName('wallsGroup')!;
      group.updateMatrixWorld(true);
      // A ray straight through the former void hits a solid top face.
      const ray = new THREE.Raycaster(new THREE.Vector3(1.3, 4, 1.3), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(group, true).length).toBeGreaterThan(0);
      const restored = parser.parse(new PlanExportService().exportPlan(plan));
      expect(restored.walls.map(w => w.id)).toEqual(['small']);
      expect(parser.parse(JSON.stringify(plan)).walls.map(w => w.id)).toEqual(['small']);
    } else expect(plan.rooms.map(r => r.id)).toEqual(['small']);
  });

  it('renders columns and chimneys as ordinary selectable wall meshes', () => {
    const plan = parser.parse(readFileSync('public/sample.plan', 'utf8'));
    const geometry = plan.walls.map(w => [w.id, w.p1, w.p2, w.thickness]);
    const scene = new ThreeSceneService(new AssetRegistryService(), { getMaterial: () => new THREE.MeshStandardMaterial(), setForegroundMode: vi.fn(), setForegroundOpacity: vi.fn() } as any);
    scene.rebuildWalls(plan);
    const group = scene.getScene().getObjectByName('wallsGroup')!;
    expect(group.children).toHaveLength(plan.walls.length);
    expect(group.children.every(w => w.userData.type === 'wall')).toBe(true);
    for (const column of plan.walls.filter(w => w.isColumn)) {
      expect(group.children.some(w => w.userData.id === column.id)).toBe(true);
    }
    scene.rebuildWalls(plan);
    expect(plan.walls.map(w => [w.id, w.p1, w.p2, w.thickness])).toEqual(geometry);
    expect(plan.columns).toEqual([]);
  });
});
