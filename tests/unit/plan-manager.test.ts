import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanManagerService } from '../../src/services/plan/PlanManagerService';
import { PlanParserService } from '../../src/services/plan/PlanParserService';
import { PlanExportService } from '../../src/services/plan/PlanExportService';
import { rawPlan } from './fixtures';

describe('plan manager', () => {
  const parser = new PlanParserService();
  const exporter = new PlanExportService();
  let manager: PlanManagerService;
  const persistence = { savePlan: vi.fn(), resetToTemplate: vi.fn(), loadPlan: vi.fn(), getSaveStatus: () => 'idle' as const, onSaveStatusChange: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    persistence.savePlan.mockResolvedValue(true);
    manager = new PlanManagerService(parser, exporter, persistence);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('starts empty and rejects adding furniture before a plan loads', () => {
    expect(manager.getPlan()).toBeNull();
    expect(manager.exportPlanJson()).toBe('{}');
    expect(() => manager.addFurniture(parser.parse(rawPlan()).furniture[0])).toThrow('No plan loaded');
  });
  it('loads without triggering autosave and clears old selection', async () => {
    manager.loadPlan(rawPlan());
    manager.setSelectedFurniture(manager.getPlan()!.furniture[0]);
    manager.loadPlan(rawPlan());
    expect(manager.getSelectedFurniture()).toBeNull();
    expect(manager.hasUnsavedChanges()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persistence.savePlan).not.toHaveBeenCalled();
  });
  it('updates canonical selection and notifies subscribers', () => {
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedFurniture(plan.furniture[0]);
    const listener = vi.fn();
    manager.onPlanChange(listener);
    manager.updateFurniture('sofa', { position: { x: 3, y: 1, z: 2 } });
    expect(manager.getSelectedFurniture()).toBe(plan.furniture[0]);
    expect(plan.furniture[0].position).toEqual({ x: 3, y: 1, z: 2 });
    expect(listener).toHaveBeenCalledWith(plan);
    expect(manager.hasUnsavedChanges()).toBe(true);
  });
  it('unsubscribes listeners', () => {
    manager.loadPlan(rawPlan());
    const listener = vi.fn();
    const unsubscribe = manager.onPlanChange(listener);
    unsubscribe(); manager.updateRoomName('room', 'Office');
    expect(listener).not.toHaveBeenCalled();
  });
  it('ignores unknown furniture without dirtying the plan', () => {
    manager.loadPlan(rawPlan());
    manager.updateFurniture('missing', { rotationY: 1 });
    expect(manager.hasUnsavedChanges()).toBe(false);
  });
  it('adds furniture, selects it, then removes it from exported JSON', () => {
    manager.loadPlan(rawPlan());
    const added = manager.addFurniture({ ...parser.parse(rawPlan()).furniture[0], id: 'new-sofa' });
    expect(manager.getSelectedFurniture()).toBe(added);
    expect(JSON.parse(manager.exportPlanJson()).plan.items).toHaveProperty('new-sofa');
    manager.deleteFurniture('new-sofa');
    expect(manager.getSelectedFurniture()).toBeNull();
    expect(JSON.parse(manager.exportPlanJson()).plan.items).not.toHaveProperty('new-sofa');
  });
  it('debounces edits and persists the latest values only', async () => {
    manager.loadPlan(rawPlan());
    manager.updateFurniture('sofa', { rotationY: 1 });
    await vi.advanceTimersByTimeAsync(500);
    manager.updateFurniture('sofa', { rotationY: 2 });
    await vi.advanceTimersByTimeAsync(599);
    expect(persistence.savePlan).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(persistence.savePlan).toHaveBeenCalledTimes(1);
    expect(parser.parse(persistence.savePlan.mock.calls[0][0]).furniture[0].rotationY).toBe(2);
    expect(manager.hasUnsavedChanges()).toBe(false);
  });
  it('retains dirty state after a failed save and clears it after retry', async () => {
    manager.loadPlan(rawPlan()); manager.updateRoomName('room', 'Office');
    persistence.savePlan.mockResolvedValueOnce(false);
    expect(await manager.saveCurrentPlan()).toBe(false);
    expect(manager.hasUnsavedChanges()).toBe(true);
    expect(await manager.saveCurrentPlan()).toBe(true);
    expect(manager.hasUnsavedChanges()).toBe(false);
  });
  it.each([0, 0.05, 3.95, 4, 5])('rejects an invalid wall split distance %s without changes', distance => {
    manager.loadPlan(rawPlan());
    expect(manager.splitWall('wall', distance)).toBeNull();
    expect(manager.getPlan()!.walls).toHaveLength(1);
    expect(manager.hasUnsavedChanges()).toBe(false);
  });
  it('splits a wall, reassigns openings and preserves children on export/reload', () => {
    manager.loadPlan(rawPlan());
    const result = manager.splitWall('wall', 2)!;
    expect(result.wall1.p2).toEqual({ x: 2, y: 0 });
    expect(result.wall2.p1).toEqual({ x: 2, y: 0 });
    expect(result.wall1.openings[0]).toMatchObject({ id: 'door', wallId: 'wall_a', distanceAlongWall: 1 });
    expect(result.wall2.openings[0]).toMatchObject({ id: 'window', wallId: 'wall_b', distanceAlongWall: 1 });
    const restored = parser.parse(manager.exportPlanJson());
    expect(restored.walls.map(w => w.id)).toEqual(['wall_a', 'wall_b']);
    expect(restored.walls[1].openings[0]).toMatchObject({ id: 'window', distanceAlongWall: 1 });
    expect(manager.hasUnsavedChanges()).toBe(true);
  });
  it('resets through persistence and loads the returned template', async () => {
    manager.loadPlan(rawPlan()); manager.updateRoomName('room', 'Office');
    persistence.resetToTemplate.mockResolvedValue(JSON.stringify(rawPlan()));
    expect((await manager.resetToTemplate()).rooms[0].name).toBe('Living room');
    expect(manager.hasUnsavedChanges()).toBe(false);
  });

  it.each([[-10, 0], [44.6, 45], [250, 180]])('clamps door angle %s to %s and persists it', (input, expected) => {
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedOpening({ wall: plan.walls[0], opening: plan.walls[0].openings[0] });
    manager.setDoorAngle('door', input);
    expect(manager.getSelectedOpening()!.opening.openAngle).toBe(expected);
    expect(parser.parse(manager.exportPlanJson()).walls[0].openings[0].openAngle).toBe(expected);
  });
  it('flips door swing and hinge orientation through export and reload', () => {
    manager.loadPlan(rawPlan());
    manager.flipDoor('door', 'swing'); manager.flipDoor('door', 'hinge');
    expect(parser.parse(manager.exportPlanJson()).walls[0].openings[0]).toMatchObject({ swingSide: 'r', hingeSide: 'l' });
    expect(manager.getAllDoors().map(d => d.opening.id)).toEqual(['door']);
  });
  it('rotates doors within their range and treats 180 degrees as a swing flip', () => {
    manager.loadPlan(rawPlan());
    manager.rotateDoor('door', 20);
    expect(manager.getAllDoors()[0].opening.openAngle).toBe(60);
    manager.rotateDoor('door', -100);
    expect(manager.getAllDoors()[0].opening.openAngle).toBe(0);
    manager.rotateDoor('door', 250);
    expect(manager.getAllDoors()[0].opening.openAngle).toBe(180);
    manager.rotateDoor('door', 180);
    expect(manager.getAllDoors()[0].opening.swingSide).toBe('r');
  });
  it('selects only one entity type at a time', () => {
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedFurniture(plan.furniture[0], 'top');
    expect(manager.getSelectedFurnitureSection()).toBe('top');
    manager.setSelectedOpening({ wall: plan.walls[0], opening: plan.walls[0].openings[0] });
    expect(manager.getSelectedFurniture()).toBeNull();
    manager.setSelectedWall(plan.walls[0], 'B');
    expect(manager.getSelectedOpening()).toBeNull();
    expect(manager.getSelectedWallSide()).toBe('B');
    manager.setSelectedRoom(plan.rooms[0]);
    expect(manager.getSelectedWall()).toBeNull();
    expect(manager.getSelectedRoom()).toBe(plan.rooms[0]);
  });
  it.each([
    ['A', 'finishSideA'], ['B', 'finishSideB'], ['edge_start', 'finishEdgeStart'],
    ['edge_end', 'finishEdgeEnd'], ['edge_top', 'finishEdgeTop'],
    ['baseboard', 'finishBaseboard'], ['edge_bottom', 'finishBaseboard'], ['edges', 'finishEdges'],
  ] as const)('persists a wall finish on %s independently', (side, property) => {
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedWall(plan.walls[0]);
    manager.setWallFinish('wall', { type: 'paint', color: '#abcdef' }, side);
    expect(parser.parse(manager.exportPlanJson()).walls[0][property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(manager.getSelectedWall()![property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(manager.hasUnsavedChanges()).toBe(true);
  });
  it('preserves the opposite wall finish when changing one side', () => {
    manager.loadPlan(rawPlan());
    manager.setWallFinish('wall', { type: 'paint', color: '#111111' });
    manager.setWallFinish('wall', { type: 'paint', color: '#222222' }, 'A');
    const wall = parser.parse(manager.exportPlanJson()).walls[0];
    expect(wall.finishSideA!.color).toBe('#222222');
    expect(wall.finishSideB!.color).toBe('#111111');
    expect(wall.finish).toBeUndefined();
  });
  it('persists wall frames, material and opening finishes', () => {
    const plan = manager.loadPlan(rawPlan());
    manager.setSelectedWall(plan.walls[0]);
    manager.setWallFrame('wall', 'grid_4', '#111111');
    manager.setWallMaterial('wall', 'brick');
    manager.setOpeningFinish('door', { type: 'wood', variant: 'oak' });
    const wall = parser.parse(manager.exportPlanJson()).walls[0];
    expect(wall).toMatchObject({ frameStyle: 'grid_4', frameColor: '#111111', material: 'brick' });
    expect(wall.openings[0].finish).toEqual({ type: 'wood', variant: 'oak' });
  });
  it('persists room floor/ceiling edits and supports clearing floor finishes', () => {
    const plan = manager.loadPlan(rawPlan()); manager.setSelectedRoom(plan.rooms[0]);
    manager.setRoomFloorFinish('room', { type: 'tile', groutWidth: 2 });
    manager.setRoomCeiling('room', 'clip_in');
    expect(parser.parse(manager.exportPlanJson()).rooms[0]).toMatchObject({ floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'clip_in' });
    manager.setRoomFloorFinish('room');
    expect(parser.parse(manager.exportPlanJson()).rooms[0].floorFinish).toBeUndefined();
  });
  it('sets and removes section finishes, and resets them with an overall finish', () => {
    const plan = manager.loadPlan(rawPlan()); manager.setSelectedFurniture(plan.furniture[0]);
    manager.setFurnitureSectionFinish('sofa', 'top', { type: 'wood' });
    manager.setFurnitureSectionFinish('sofa', 'legs', { type: 'metal' });
    manager.setFurnitureSectionFinish('sofa', 'top', undefined);
    expect(parser.parse(manager.exportPlanJson()).furniture[0].sectionFinishes).toEqual({ legs: { type: 'metal' } });
    manager.setFurnitureFinish('sofa', { type: 'fabric' });
    expect(parser.parse(manager.exportPlanJson()).furniture[0]).toMatchObject({ finish: { type: 'fabric' } });
    expect(manager.getSelectedFurniture()!.sectionFinishes).toBeUndefined();
    manager.setFurnitureFinish('sofa');
    expect(parser.parse(manager.exportPlanJson()).furniture[0].finish).toBeUndefined();
  });
  it('merges light settings and persists false lids values', () => {
    const plan = manager.loadPlan(rawPlan()); manager.setSelectedFurniture(plan.furniture[0]);
    manager.setFurnitureLightConfig('sofa', { intensity: 0.8, color: '#fff000' });
    manager.setFurnitureLightConfig('sofa', { enabled: false });
    manager.setFurnitureHasLids('sofa', false);
    expect(parser.parse(manager.exportPlanJson()).furniture[0]).toMatchObject({ lightConfig: { intensity: 0.8, color: '#fff000', enabled: false }, hasLids: false });
  });
  it.each(['A', 'B', 'edge_start', 'edge_end'] as const)('persists a thick column wall finish on %s', side => {
    const raw = rawPlan();
    Object.assign(raw.plan, { columns: [{ id: 'column', type: 'column', width: 0.4, depth: 0.3,
      height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0 }] });
    const plan = manager.loadPlan(raw);
    const wall = plan.walls.find(w => w.id === 'column')!;
    manager.setSelectedWall(wall, side);
    manager.setWallFinish('column', { type: 'paint', color: '#abcdef' }, side);
    const restored = parser.parse(manager.exportPlanJson());
    expect(restored.columns).toEqual([]);
    const column = restored.walls.find(w => w.id === 'column')!;
    const field = { A: 'finishSideA', B: 'finishSideB', edge_start: 'finishEdgeStart', edge_end: 'finishEdgeEnd' }[side];
    expect((column as any)[field]).toEqual({ type: 'paint', color: '#abcdef' });
  });
  it('supports a recess and wall splitting on a column without recreating it on reload', () => {
    const raw = rawPlan();
    Object.assign(raw.plan, { columns: [{ id: 'column', type: 'column', width: 1.2, depth: 0.6,
      height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0 }] });
    manager.loadPlan(raw);
    const recess = manager.addWallRecess('column', { width: 0.2, height: 0.5, elevation: 0.7, depth: 0.1, distanceAlongWall: 0.3 });
    expect(recess).not.toBeNull();
    expect(manager.getWallRecesses('column').map(r => r.id)).toContain(recess!.id);
    const restored = parser.parse(manager.exportPlanJson());
    expect(restored.furniture.find(f => f.id === recess!.id)?.rawItem?.wallId).toBe('column');
    expect(manager.splitWall('column', 0.6)).not.toBeNull();
    const split = parser.parse(manager.exportPlanJson());
    expect(split.walls.some(w => w.id === 'column')).toBe(false);
    expect(split.walls.filter(w => w.id.startsWith('column_')).map(w => w.id)).toEqual(['column_a', 'column_b']);
  });

});
