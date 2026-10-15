import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddFurniture, ConfigureLuminaire, ConfigureShelving, FinishFurniture, RemoveElement, ReplaceFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { ChangeWallMaterial, ConfigureCeiling, FinishColumn, FinishFloor, FinishOpening, FinishWall, FlipDoor, FrameWall, OpenDoor, RenameRoom, RotateDoor, SplitWall } from '../../src/application/commands/StructuralCommands';
import { allDoors, selectedFurniture, selectedOpening, selectedRoom, selectedWall } from '../../src/application/queries/SelectionQueries';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { createEditor, legacyData, type TestEditor } from '../support/editor';
import { rawPlan } from './fixtures';

describe('plan manager', () => {
  const parser = new PlanCodec();
  let manager: TestEditor;
  const persistence = { savePlan: vi.fn(), resetToTemplate: vi.fn(), loadPlan: vi.fn(), getSaveStatus: () => 'idle' as const, onSaveStatusChange: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    persistence.savePlan.mockResolvedValue(true);
    manager = createEditor(persistence, parser);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('starts empty and rejects adding furniture before a plan loads', () => {
    expect(manager.getSnapshot()).toBeNull();
    expect(() => manager.execute(new AddFurniture(parser.decode(rawPlan()).furniture[0].toData()))).toThrow('No plan loaded');
  });
  it('loads without triggering autosave and clears old selection', async () => {
    manager.documents.load(rawPlan());
    manager.selection.select('furniture', manager.getSnapshot()!.furniture[0]);
    manager.documents.load(rawPlan());
    expect(selectedFurniture(manager)).toBeNull();
    expect(manager.isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persistence.savePlan).not.toHaveBeenCalled();
  });
  it('updates canonical selection and notifies subscribers', () => {
    const plan = manager.documents.load(rawPlan());
    manager.selection.select('furniture', plan.furniture[0]);
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.execute(new TransformFurniture('sofa', { x: 3, y: 1, z: 2 }, undefined, undefined));
    expect(selectedFurniture(manager)).toBe(manager.getDocument().furniture[0]);
    expect(plan.furniture[0].position).toEqual({ x: 1.5, y: 0.25, z: 2 });
    expect(manager.getDocument().furniture[0].position).toEqual({ x: 3, y: 1, z: 2 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ document: manager.getDocument(), updated: ['sofa'] }));
    expect(manager.isDirty).toBe(true);
  });
  it('unsubscribes listeners', () => {
    manager.documents.load(rawPlan());
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    unsubscribe(); manager.execute(new RenameRoom('room', 'Office'));
    expect(listener).not.toHaveBeenCalled();
  });
  it('ignores unknown furniture without dirtying the plan', () => {
    manager.documents.load(rawPlan());
    expect(() => manager.execute(new TransformFurniture('missing', undefined, 1, undefined))).toThrow('Unknown element');
    expect(manager.isDirty).toBe(false);
  });
  it('adds furniture, selects it, then removes it from exported JSON', () => {
    manager.documents.load(rawPlan());
    manager.execute(new AddFurniture({ ...parser.decode(rawPlan()).furniture[0].toData(), id: 'new-sofa' }));
    manager.selection.set({ kind: 'furniture', id: 'new-sofa' });
    expect(selectedFurniture(manager)?.id).toBe('new-sofa');
    expect(legacyData(manager.legacy.encode(manager.getDocument())).plan.items).toHaveProperty('new-sofa');
    manager.execute(new RemoveElement('new-sofa'));
    expect(selectedFurniture(manager)).toBeNull();
    expect(legacyData(manager.legacy.encode(manager.getDocument())).plan.items).not.toHaveProperty('new-sofa');
  });
  it('keeps edits unsaved until an explicit save persists the latest values', async () => {
    manager.documents.load(rawPlan());
    manager.execute(new TransformFurniture('sofa', undefined, 1, undefined));
    await vi.advanceTimersByTimeAsync(500);
    manager.execute(new TransformFurniture('sofa', undefined, 2, undefined));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(persistence.savePlan).not.toHaveBeenCalled();
    expect(manager.isDirty).toBe(true);
    await manager.documents.save();
    expect(persistence.savePlan).toHaveBeenCalledTimes(1);
    expect(parser.decode(persistence.savePlan.mock.calls[0][0]).furniture[0].rotationY).toBe(2);
    expect(manager.isDirty).toBe(false);
  });
  it('retains dirty state after a failed save and clears it after retry', async () => {
    manager.documents.load(rawPlan()); manager.execute(new RenameRoom('room', 'Office'));
    persistence.savePlan.mockResolvedValueOnce(false);
    expect(await manager.documents.save()).toBe(false);
    expect(manager.isDirty).toBe(true);
    expect(await manager.documents.save()).toBe(true);
    expect(manager.isDirty).toBe(false);
  });
  it.each([0, 0.05, 3.95, 4, 5])('rejects an invalid wall split distance %s without changes', distance => {
    manager.documents.load(rawPlan());
    expect(() => manager.execute(new SplitWall('wall', distance))).toThrow();
    expect(manager.getSnapshot()!.walls).toHaveLength(1);
    expect(manager.isDirty).toBe(false);
  });
  it('splits a wall, reassigns openings and preserves children on export/reload', () => {
    manager.documents.load(rawPlan());
    manager.execute(new SplitWall('wall', 2));
    const [wall1, wall2] = manager.getDocument().walls;
    const result = { wall1, wall2 };
    expect(result.wall1.p2).toEqual({ x: 2, y: 0 });
    expect(result.wall2.p1).toEqual({ x: 2, y: 0 });
    expect(result.wall1.openings[0]).toMatchObject({ id: 'door', wallId: 'wall_a', distanceAlongWall: 1 });
    expect(result.wall2.openings[0]).toMatchObject({ id: 'window', wallId: 'wall_b', distanceAlongWall: 1 });
    const restored = parser.decode(manager.legacy.encode(manager.getDocument()));
    expect(restored.walls.map(w => w.id)).toEqual(['wall_a', 'wall_b']);
    expect(restored.walls[1].openings[0]).toMatchObject({ id: 'window', distanceAlongWall: 1 });
    expect(manager.isDirty).toBe(true);
  });
  it('resets through persistence and loads the returned template', async () => {
    manager.documents.load(rawPlan()); manager.execute(new RenameRoom('room', 'Office'));
    persistence.resetToTemplate.mockResolvedValue(JSON.stringify(rawPlan()));
    expect((await manager.documents.reset()).rooms[0].name).toBe('Living room');
    expect(manager.isDirty).toBe(false);
  });

  it.each([[-10, 0], [44.6, 45], [250, 180]])('clamps door angle %s to %s and persists it', (input, expected) => {
    const plan = manager.documents.load(rawPlan());
    manager.selection.select('opening', ({ wall: plan.walls[0], opening: plan.walls[0].openings[0] })?.opening);
    manager.execute(new OpenDoor('door', input));
    expect(selectedOpening(manager)!.opening.openAngle).toBe(expected);
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).walls[0].openings[0].openAngle).toBe(expected);
  });
  it('flips door swing and hinge orientation through export and reload', () => {
    manager.documents.load(rawPlan());
    manager.execute(new FlipDoor('door', 'swing')); manager.execute(new FlipDoor('door', 'hinge'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).walls[0].openings[0]).toMatchObject({ swingSide: 'r', hingeSide: 'l' });
    expect(allDoors(manager.getSnapshot()).map(d => d.opening.id)).toEqual(['door']);
  });
  it('rotates doors within their range and treats 180 degrees as a swing flip', () => {
    manager.documents.load(rawPlan());
    manager.execute(new RotateDoor('door', 20));
    expect(allDoors(manager.getSnapshot())[0].opening.openAngle).toBe(60);
    manager.execute(new RotateDoor('door', -100));
    expect(allDoors(manager.getSnapshot())[0].opening.openAngle).toBe(0);
    manager.execute(new RotateDoor('door', 250));
    expect(allDoors(manager.getSnapshot())[0].opening.openAngle).toBe(180);
    manager.execute(new RotateDoor('door', 180));
    expect(allDoors(manager.getSnapshot())[0].opening.swingSide).toBe('r');
  });
  it('selects only one entity type at a time', () => {
    const plan = manager.documents.load(rawPlan());
    manager.selection.select('furniture', plan.furniture[0], 'top');
    expect((manager.selection.getSnapshot()?.subtarget ?? 'all')).toBe('top');
    manager.selection.select('opening', ({ wall: plan.walls[0], opening: plan.walls[0].openings[0] })?.opening);
    expect(selectedFurniture(manager)).toBeNull();
    manager.selection.select('wall', plan.walls[0], 'B');
    expect(selectedOpening(manager)).toBeNull();
    expect((manager.selection.getSnapshot()?.subtarget ?? 'A')).toBe('B');
    manager.selection.select('room', plan.rooms[0]);
    expect(selectedWall(manager)).toBeNull();
    expect(selectedRoom(manager)).toBe(plan.rooms[0]);
  });
  it.each([
    ['A', 'finishSideA'], ['B', 'finishSideB'], ['edge_start', 'finishEdgeStart'],
    ['edge_end', 'finishEdgeEnd'], ['edge_top', 'finishEdgeTop'],
    ['baseboard', 'finishBaseboard'], ['edge_bottom', 'finishBaseboard'], ['edges', 'finishEdges'],
  ] as const)('persists a wall finish on %s independently', (side, property) => {
    const plan = manager.documents.load(rawPlan());
    manager.selection.select('wall', plan.walls[0]);
    manager.execute(new FinishWall('wall', { type: 'paint', color: '#abcdef' }, side));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).walls[0][property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(selectedWall(manager)![property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(manager.isDirty).toBe(true);
  });
  it('preserves the opposite wall finish when changing one side', () => {
    manager.documents.load(rawPlan());
    manager.execute(new FinishWall('wall', { type: 'paint', color: '#111111' }));
    manager.execute(new FinishWall('wall', { type: 'paint', color: '#222222' }, 'A'));
    const wall = parser.decode(manager.legacy.encode(manager.getDocument())).walls[0];
    expect(wall.finishSideA!.color).toBe('#222222');
    expect(wall.finishSideB!.color).toBe('#111111');
    expect(wall.finish).toBeUndefined();
  });
  it('persists wall frames, material and opening finishes', () => {
    const plan = manager.documents.load(rawPlan());
    manager.selection.select('wall', plan.walls[0]);
    manager.execute(new FrameWall('wall', 'grid_4', '#111111'));
    manager.execute(new ChangeWallMaterial('wall', 'brick'));
    manager.execute(new FinishOpening('door', { type: 'wood', variant: 'oak' }));
    const wall = parser.decode(manager.legacy.encode(manager.getDocument())).walls[0];
    expect(wall).toMatchObject({ frameStyle: 'grid_4', frameColor: '#111111', material: 'brick' });
    expect(wall.openings[0].finish).toEqual({ type: 'wood', variant: 'oak' });
  });
  it('persists room floor/ceiling edits and supports clearing floor finishes', () => {
    const plan = manager.documents.load(rawPlan()); manager.selection.select('room', plan.rooms[0]);
    manager.execute(new FinishFloor('room', { type: 'tile', groutWidth: 2 }));
    manager.execute(new ConfigureCeiling('room', 'clip_in'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).rooms[0]).toMatchObject({ floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'clip_in' });
    manager.execute(new FinishFloor('room'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).rooms[0].floorFinish).toBeUndefined();
  });
  it('sets and removes section finishes, and resets them with an overall finish', () => {
    const plan = manager.documents.load(rawPlan()); manager.selection.select('furniture', plan.furniture[0]);
    manager.execute(new FinishFurniture('sofa', { type: 'wood' }, 'top'));
    manager.execute(new FinishFurniture('sofa', { type: 'metal' }, 'legs'));
    manager.execute(new FinishFurniture('sofa', undefined, 'top'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).furniture[0].sectionFinishes).toEqual({ legs: { type: 'metal' } });
    manager.execute(new FinishFurniture('sofa', { type: 'fabric' }));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).furniture[0]).toMatchObject({ finish: { type: 'fabric' } });
    expect(selectedFurniture(manager)!.sectionFinishes).toBeUndefined();
    manager.execute(new FinishFurniture('sofa'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).furniture[0].finish).toBeUndefined();
  });
  it('merges lighting only on a luminaire, and retains false shelving lids', () => {
    manager.documents.load(rawPlan());
    manager.execute(new ReplaceFurniture('sofa', 'chandelier'));
    manager.execute(new ConfigureLuminaire('sofa', { intensity: 0.8, color: '#fff000' }));
    manager.execute(new ConfigureLuminaire('sofa', { enabled: false }));
    expect(parser.decode(manager.codec.encode(manager.getDocument())).furniture[0].lightConfig).toEqual({ intensity: 0.8, color: '#fff000', enabled: false });
    manager.execute(new ReplaceFurniture('sofa', 'open_shelving'));
    manager.execute(new ConfigureShelving('sofa', false));
    expect(parser.decode(manager.codec.encode(manager.getDocument())).furniture[0].hasLids).toBe(false);
    expect(() => manager.execute(new ConfigureLuminaire('sofa', { intensity: 1 }))).toThrow();
  });
  it.each(['front', 'back', 'left', 'right'] as const)('persists a column finish on %s as a column', side => {
    const raw = rawPlan();
    Object.assign(raw.plan, {
      columns: [{
        id: 'column', type: 'column', width: 0.4, depth: 0.3,
        height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0
      }]
    });
    manager.documents.load(raw);
    manager.execute(new FinishColumn('column', { type: 'paint', color: '#abcdef' }, side));
    const restored = parser.decode(manager.legacy.encode(manager.getDocument()));
    expect(restored.columns).toHaveLength(1);
    const field = { front: 'finishFront', back: 'finishBack', left: 'finishLeft', right: 'finishRight' }[side];
    expect((restored.columns[0] as any)[field]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(restored.walls.every(wall => wall.id !== 'column')).toBe(true);
  });
  it('rejects wall-only operations on a column and never resurrects a deleted column', () => {
    const raw = rawPlan();
    Object.assign(raw.plan, {
      columns: [{
        id: 'column', type: 'column', width: 1.2, depth: 0.6,
        height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0
      }]
    });
    manager.documents.load(raw);
    expect(() => manager.execute(new SplitWall('column', 0.6))).toThrow('not a wall');
    manager.execute(new RemoveElement('column'));
    expect(parser.decode(manager.legacy.encode(manager.getDocument())).columns).toHaveLength(0);
  });
});
