import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddFurniture, ConfigureLuminaire, ConfigureShelving, FinishFurniture, RemoveElement, ReplaceFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { ChangeWallMaterial, ConfigureCeiling, FinishColumn, FinishFloor, FinishOpening, FinishWall, FlipDoor, FrameWall, OpenDoor, RenameRoom, RotateDoor, SplitWall } from '../../src/application/commands/StructuralCommands';
import { allDoors, selectedFurniture, selectedOpening, selectedRoom, selectedWall } from '../../src/application/queries/SelectionQueries';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { createEditor, legacyData, type TestEditor } from '../support/editor';
import { rawPlan } from './fixtures';

describe('editor session', () => {
  const parser = new PlanCodec();
  let editor: TestEditor;
  const persistence = { savePlan: vi.fn(), resetToTemplate: vi.fn(), loadPlan: vi.fn(), getSaveStatus: () => 'idle' as const, onSaveStatusChange: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    persistence.savePlan.mockResolvedValue(true);
    editor = createEditor(persistence, parser);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('starts empty and rejects adding furniture before a plan loads', () => {
    expect(editor.getSnapshot()).toBeNull();
    expect(() => editor.execute(new AddFurniture(parser.decode(rawPlan()).furniture[0].toData()))).toThrow('No plan loaded');
  });
  it('loads without triggering autosave and clears old selection', async () => {
    editor.documents.load(rawPlan());
    editor.selection.select('furniture', editor.getSnapshot()!.furniture[0]);
    editor.documents.load(rawPlan());
    expect(selectedFurniture(editor)).toBeNull();
    expect(editor.isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(persistence.savePlan).not.toHaveBeenCalled();
  });
  it('updates canonical selection and notifies subscribers', () => {
    const plan = editor.documents.load(rawPlan());
    editor.selection.select('furniture', plan.furniture[0]);
    const listener = vi.fn();
    editor.subscribe(listener);
    editor.execute(new TransformFurniture('sofa', { x: 3, y: 1, z: 2 }, undefined, undefined));
    expect(selectedFurniture(editor)).toBe(editor.getDocument().furniture[0]);
    expect(plan.furniture[0].position).toEqual({ x: 1.5, y: 0.25, z: 2 });
    expect(editor.getDocument().furniture[0].position).toEqual({ x: 3, y: 1, z: 2 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ document: editor.getDocument(), updated: ['sofa'] }));
    expect(editor.isDirty).toBe(true);
  });
  it('unsubscribes listeners', () => {
    editor.documents.load(rawPlan());
    const listener = vi.fn();
    const unsubscribe = editor.subscribe(listener);
    unsubscribe(); editor.execute(new RenameRoom('room', 'Office'));
    expect(listener).not.toHaveBeenCalled();
  });
  it('ignores unknown furniture without dirtying the plan', () => {
    editor.documents.load(rawPlan());
    expect(() => editor.execute(new TransformFurniture('missing', undefined, 1, undefined))).toThrow('Unknown element');
    expect(editor.isDirty).toBe(false);
  });
  it('adds furniture, selects it, then removes it from exported JSON', () => {
    editor.documents.load(rawPlan());
    editor.execute(new AddFurniture({ ...parser.decode(rawPlan()).furniture[0].toData(), id: 'new-sofa' }));
    editor.selection.set({ kind: 'furniture', id: 'new-sofa' });
    expect(selectedFurniture(editor)?.id).toBe('new-sofa');
    expect(legacyData(editor.legacy.encode(editor.getDocument())).plan.items).toHaveProperty('new-sofa');
    editor.execute(new RemoveElement('new-sofa'));
    expect(selectedFurniture(editor)).toBeNull();
    expect(legacyData(editor.legacy.encode(editor.getDocument())).plan.items).not.toHaveProperty('new-sofa');
  });
  it('keeps edits unsaved until an explicit save persists the latest values', async () => {
    editor.documents.load(rawPlan());
    editor.execute(new TransformFurniture('sofa', undefined, 1, undefined));
    await vi.advanceTimersByTimeAsync(500);
    editor.execute(new TransformFurniture('sofa', undefined, 2, undefined));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(persistence.savePlan).not.toHaveBeenCalled();
    expect(editor.isDirty).toBe(true);
    await editor.documents.save();
    expect(persistence.savePlan).toHaveBeenCalledTimes(1);
    expect(parser.decode(persistence.savePlan.mock.calls[0][0]).furniture[0].rotationY).toBe(2);
    expect(editor.isDirty).toBe(false);
  });
  it('retains dirty state after a failed save and clears it after retry', async () => {
    editor.documents.load(rawPlan()); editor.execute(new RenameRoom('room', 'Office'));
    persistence.savePlan.mockResolvedValueOnce(false);
    expect(await editor.documents.save()).toBe(false);
    expect(editor.isDirty).toBe(true);
    expect(await editor.documents.save()).toBe(true);
    expect(editor.isDirty).toBe(false);
  });
  it.each([0, 0.05, 3.95, 4, 5])('rejects an invalid wall split distance %s without changes', distance => {
    editor.documents.load(rawPlan());
    expect(() => editor.execute(new SplitWall('wall', distance))).toThrow();
    expect(editor.getSnapshot()!.walls).toHaveLength(1);
    expect(editor.isDirty).toBe(false);
  });
  it('splits a wall, reassigns openings and preserves children on export/reload', () => {
    editor.documents.load(rawPlan());
    editor.execute(new SplitWall('wall', 2));
    const [wall1, wall2] = editor.getDocument().walls;
    const result = { wall1, wall2 };
    expect(result.wall1.p2).toEqual({ x: 2, y: 0 });
    expect(result.wall2.p1).toEqual({ x: 2, y: 0 });
    expect(result.wall1.openings[0]).toMatchObject({ id: 'door', wallId: 'wall_a', distanceAlongWall: 1 });
    expect(result.wall2.openings[0]).toMatchObject({ id: 'window', wallId: 'wall_b', distanceAlongWall: 1 });
    const restored = parser.decode(editor.legacy.encode(editor.getDocument()));
    expect(restored.walls.map(w => w.id)).toEqual(['wall_a', 'wall_b']);
    expect(restored.walls[1].openings[0]).toMatchObject({ id: 'window', distanceAlongWall: 1 });
    expect(editor.isDirty).toBe(true);
  });
  it('resets through persistence and loads the returned template', async () => {
    editor.documents.load(rawPlan()); editor.execute(new RenameRoom('room', 'Office'));
    persistence.resetToTemplate.mockResolvedValue(JSON.stringify(rawPlan()));
    expect((await editor.documents.reset()).rooms[0].name).toBe('Living room');
    expect(editor.isDirty).toBe(false);
  });

  it.each([[-10, 0], [44.6, 45], [250, 180]])('clamps door angle %s to %s and persists it', (input, expected) => {
    const plan = editor.documents.load(rawPlan());
    editor.selection.select('opening', ({ wall: plan.walls[0], opening: plan.walls[0].openings[0] })?.opening);
    editor.execute(new OpenDoor('door', input));
    expect(selectedOpening(editor)!.opening.openAngle).toBe(expected);
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).walls[0].openings[0].openAngle).toBe(expected);
  });
  it('flips door swing and hinge orientation through export and reload', () => {
    editor.documents.load(rawPlan());
    editor.execute(new FlipDoor('door', 'swing')); editor.execute(new FlipDoor('door', 'hinge'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).walls[0].openings[0]).toMatchObject({ swingSide: 'r', hingeSide: 'l' });
    expect(allDoors(editor.getSnapshot()).map(d => d.opening.id)).toEqual(['door']);
  });
  it('rotates doors within their range and treats 180 degrees as a swing flip', () => {
    editor.documents.load(rawPlan());
    editor.execute(new RotateDoor('door', 20));
    expect(allDoors(editor.getSnapshot())[0].opening.openAngle).toBe(60);
    editor.execute(new RotateDoor('door', -100));
    expect(allDoors(editor.getSnapshot())[0].opening.openAngle).toBe(0);
    editor.execute(new RotateDoor('door', 250));
    expect(allDoors(editor.getSnapshot())[0].opening.openAngle).toBe(180);
    editor.execute(new RotateDoor('door', 180));
    expect(allDoors(editor.getSnapshot())[0].opening.swingSide).toBe('r');
  });
  it('selects only one entity type at a time', () => {
    const plan = editor.documents.load(rawPlan());
    editor.selection.select('furniture', plan.furniture[0], 'top');
    expect((editor.selection.getSnapshot()?.subtarget ?? 'all')).toBe('top');
    editor.selection.select('opening', ({ wall: plan.walls[0], opening: plan.walls[0].openings[0] })?.opening);
    expect(selectedFurniture(editor)).toBeNull();
    editor.selection.select('wall', plan.walls[0], 'B');
    expect(selectedOpening(editor)).toBeNull();
    expect((editor.selection.getSnapshot()?.subtarget ?? 'A')).toBe('B');
    editor.selection.select('room', plan.rooms[0]);
    expect(selectedWall(editor)).toBeNull();
    expect(selectedRoom(editor)).toBe(plan.rooms[0]);
  });
  it.each([
    ['A', 'finishSideA'], ['B', 'finishSideB'], ['edge_start', 'finishEdgeStart'],
    ['edge_end', 'finishEdgeEnd'], ['edge_top', 'finishEdgeTop'],
    ['baseboard', 'finishBaseboard'], ['edge_bottom', 'finishBaseboard'], ['edges', 'finishEdges'],
  ] as const)('persists a wall finish on %s independently', (side, property) => {
    const plan = editor.documents.load(rawPlan());
    editor.selection.select('wall', plan.walls[0]);
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#abcdef' }, side));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).walls[0][property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(selectedWall(editor)![property]).toEqual({ type: 'paint', color: '#abcdef' });
    expect(editor.isDirty).toBe(true);
  });
  it('preserves the opposite wall finish when changing one side', () => {
    editor.documents.load(rawPlan());
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#111111' }));
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#222222' }, 'A'));
    const wall = parser.decode(editor.legacy.encode(editor.getDocument())).walls[0];
    expect(wall.finishSideA!.color).toBe('#222222');
    expect(wall.finishSideB!.color).toBe('#111111');
    expect(wall.finish).toBeUndefined();
  });
  it('persists wall frames, material and opening finishes', () => {
    const plan = editor.documents.load(rawPlan());
    editor.selection.select('wall', plan.walls[0]);
    editor.execute(new FrameWall('wall', 'grid_4', '#111111'));
    editor.execute(new ChangeWallMaterial('wall', 'brick'));
    editor.execute(new FinishOpening('door', { type: 'wood', variant: 'oak' }));
    const wall = parser.decode(editor.legacy.encode(editor.getDocument())).walls[0];
    expect(wall).toMatchObject({ frameStyle: 'grid_4', frameColor: '#111111', material: 'brick' });
    expect(wall.openings[0].finish).toEqual({ type: 'wood', variant: 'oak' });
  });
  it('persists room floor/ceiling edits and supports clearing floor finishes', () => {
    const plan = editor.documents.load(rawPlan()); editor.selection.select('room', plan.rooms[0]);
    editor.execute(new FinishFloor('room', { type: 'tile', groutWidth: 2 }));
    editor.execute(new ConfigureCeiling('room', 'clip_in'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).rooms[0]).toMatchObject({ floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'clip_in' });
    editor.execute(new FinishFloor('room'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).rooms[0].floorFinish).toBeUndefined();
  });
  it('sets and removes section finishes, and resets them with an overall finish', () => {
    const plan = editor.documents.load(rawPlan()); editor.selection.select('furniture', plan.furniture[0]);
    editor.execute(new FinishFurniture('sofa', { type: 'wood' }, 'top'));
    editor.execute(new FinishFurniture('sofa', { type: 'metal' }, 'legs'));
    editor.execute(new FinishFurniture('sofa', undefined, 'top'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).furniture[0].sectionFinishes).toEqual({ legs: { type: 'metal' } });
    editor.execute(new FinishFurniture('sofa', { type: 'fabric' }));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).furniture[0]).toMatchObject({ finish: { type: 'fabric' } });
    expect(selectedFurniture(editor)!.sectionFinishes).toBeUndefined();
    editor.execute(new FinishFurniture('sofa'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).furniture[0].finish).toBeUndefined();
  });
  it('merges lighting only on a luminaire, and retains false shelving lids', () => {
    editor.documents.load(rawPlan());
    editor.execute(new ReplaceFurniture('sofa', 'chandelier'));
    editor.execute(new ConfigureLuminaire('sofa', { intensity: 0.8, color: '#fff000' }));
    editor.execute(new ConfigureLuminaire('sofa', { enabled: false }));
    expect(parser.decode(editor.codec.encode(editor.getDocument())).furniture[0].lightConfig).toEqual({ intensity: 0.8, color: '#fff000', enabled: false });
    editor.execute(new ReplaceFurniture('sofa', 'open_shelving'));
    editor.execute(new ConfigureShelving('sofa', false));
    expect(parser.decode(editor.codec.encode(editor.getDocument())).furniture[0].hasLids).toBe(false);
    expect(() => editor.execute(new ConfigureLuminaire('sofa', { intensity: 1 }))).toThrow();
  });
  it.each(['front', 'back', 'left', 'right'] as const)('persists a column finish on %s as a column', side => {
    const raw = rawPlan();
    Object.assign(raw.plan, {
      columns: [{
        id: 'column', type: 'column', width: 0.4, depth: 0.3,
        height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0
      }]
    });
    editor.documents.load(raw);
    editor.execute(new FinishColumn('column', { type: 'paint', color: '#abcdef' }, side));
    const restored = parser.decode(editor.legacy.encode(editor.getDocument()));
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
    editor.documents.load(raw);
    expect(() => editor.execute(new SplitWall('column', 0.6))).toThrow('not a wall');
    editor.execute(new RemoveElement('column'));
    expect(parser.decode(editor.legacy.encode(editor.getDocument())).columns).toHaveLength(0);
  });
});
