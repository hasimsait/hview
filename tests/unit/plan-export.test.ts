import { describe, expect, it } from 'vitest';
import { PlanParserService } from '../../src/services/plan/PlanParserService';
import { PlanExportService } from '../../src/services/plan/PlanExportService';
import { rawPlan } from './fixtures';

const parser = new PlanParserService();
const exporter = new PlanExportService();

describe('plan export round trips', () => {
  it('preserves unknown metadata and does not mutate source JSON', () => {
    const raw = rawPlan();
    const before = structuredClone(raw);
    const exported = JSON.parse(exporter.exportPlan(parser.parse(raw)));
    expect(exported.metadata).toEqual(raw.metadata);
    expect(exported.plan.items.sofa.vendorData).toBe('preserve me');
    expect(raw).toEqual(before);
  });
  it('round trips moved, elevated, rotated and resized furniture', () => {
    const plan = parser.parse(rawPlan());
    Object.assign(plan.furniture[0], { position: { x: 2.3456, y: 1.2345, z: 0.8765 }, dimensions: { x: 1.1111, y: 2.2222, z: 3.3333 }, rotationY: -0.4567 });
    const restored = parser.parse(exporter.exportPlan(plan)).furniture[0];
    expect(restored.position).toEqual(plan.furniture[0].position);
    expect(restored.dimensions).toEqual(plan.furniture[0].dimensions);
    expect(restored.rotationY).toBe(-0.4567);
  });
  it('round trips furniture finishes, section finishes and lighting', () => {
    const plan = parser.parse(rawPlan());
    Object.assign(plan.furniture[0], { finish: { type: 'wood', variant: 'oak' }, sectionFinishes: { door: { type: 'paint', color: '#ff0000' } }, lightConfig: { enabled: false, intensity: 0.5 }, hasLids: false, customModelUrl: '/models/chair.glb' });
    expect(parser.parse(exporter.exportPlan(plan)).furniture[0]).toMatchObject({ finish: plan.furniture[0].finish, sectionFinishes: plan.furniture[0].sectionFinishes, lightConfig: plan.furniture[0].lightConfig, hasLids: false, customModelUrl: '/models/chair.glb' });
  });
  it('removes cleared optional properties instead of restoring stale finishes', () => {
    const raw = rawPlan();
    Object.assign(raw.plan.items.sofa, { finish: { type: 'paint' }, sectionFinishes: { top: { type: 'wood' } }, customModelUrl: '/old.glb', lightConfig: { enabled: true }, hasLids: true });
    const plan = parser.parse(raw);
    Object.assign(plan.furniture[0], { finish: undefined, sectionFinishes: {}, customModelUrl: undefined, lightConfig: undefined, hasLids: undefined });
    const item = JSON.parse(exporter.exportPlan(plan)).plan.items.sofa;
    for (const key of ['finish', 'sectionFinishes', 'customModelUrl', 'lightConfig', 'hasLids']) expect(item).not.toHaveProperty(key);
  });
  it('prunes deleted furniture and walls from the saved plan', () => {
    const plan = parser.parse(rawPlan());
    plan.furniture = []; plan.walls = [];
    const saved = JSON.parse(exporter.exportPlan(plan)).plan;
    expect(saved.items).toEqual({}); expect(saved.walls).toEqual({});
  });
  it('round trips wall finishes, frames, cavities and opening angle', () => {
    const plan = parser.parse(rawPlan());
    Object.assign(plan.walls[0], { finishSideA: { type: 'paint', color: '#123456' }, frameStyle: 'grid_3', cavities: [{ id: 'recess', distanceAlongWall: 2, floorElevation: 1, width: 0.5, height: 0.5, depth: 0.1 }] });
    plan.walls[0].openings[0].openAngle = 85;
    const restored = parser.parse(exporter.exportPlan(plan));
    expect(restored.walls[0]).toMatchObject({ finishSideA: plan.walls[0].finishSideA, frameStyle: 'grid_3', cavities: plan.walls[0].cavities });
    expect(restored.walls[0].openings[0].openAngle).toBe(85);
  });
  it('round trips room naming, floor finishes and ceiling settings', () => {
    const plan = parser.parse(rawPlan());
    Object.assign(plan.rooms[0], { name: 'Kitchen', floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'gypsum' });
    expect(parser.parse(exporter.exportPlan(plan)).rooms[0]).toMatchObject({ name: 'Kitchen', floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'gypsum' });
  });
});
