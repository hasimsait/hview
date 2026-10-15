import { describe, expect, it, vi } from 'vitest';
import { AddWallRecess } from '../../src/application/commands/AddWallRecess';
import { RemoveElement, ReplaceFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { SplitColumn, SplitWall } from '../../src/application/commands/StructuralCommands';
import { EditorSession } from '../../src/application/EditorSession';
import { wallRecesses } from '../../src/application/queries/WallQueries';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { Column } from '../../src/domain/elements/Column';
import { Wall } from '../../src/domain/elements/Wall';
import { WallRecess } from '../../src/domain/elements/WallRecess';
import { PlanDocument } from '../../src/domain/model/PlanDocument';

function wall(id: string, z = 0): Wall {
  return new Wall({ id, p1: { x: 0, y: z }, p2: { x: 4, y: z }, height: 2.7, thickness: 0.1, material: 'a_block', openings: [] }, []);
}

function fixture() {
  const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
  editor.load(new PlanDocument([wall('wall'), wall('neighbor', 0.2)]));
  editor.execute(new AddWallRecess('niche', 'wall', { width: 0.6, distanceAlongWall: 1 }));
  const recess = () => editor.getDocument().requireFurniture('niche') as WallRecess;
  return { codec, editor, recess };
}

describe('recess behavior and aggregate ownership', () => {
  it('creates a behavioral recess and derives its cut from its single host', () => {
    const { editor, recess } = fixture();
    expect(recess()).toBeInstanceOf(WallRecess);
    expect(recess().hostId).toBe('wall');
    expect(recess().rawItem).toBeUndefined();
    expect(recess().cutFor(editor.getDocument().requireWall('wall'))).toEqual({ start: 0.7, end: 1.3, floorHeight: 0.7, topHeight: 2.4 });
    expect(recess().cutFor(editor.getDocument().requireWall('neighbor'))).toBeUndefined();
    expect(wallRecesses(editor.getDocument(), 'neighbor')).toHaveLength(0);
    expect(editor.getDocument().recessesFor('wall')[0]).toBe(recess());
  });

  it.each([
    { width: 5 }, { height: 3 }, { elevation: -0.1 }, { distanceAlongWall: NaN }, { distanceAlongWall: 0 },
  ])('rejects an invalid creation atomically: %j', options => {
    const { editor } = fixture(), before = editor.getDocument();
    const listener = vi.fn(); editor.subscribe(listener);
    expect(() => editor.execute(new AddWallRecess('invalid', 'wall', options))).toThrow();
    expect(editor.getDocument()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects missing hosts, nonstructural hosts, and unowned top-level openings', () => {
    const { editor, recess } = fixture();
    expect(() => new PlanDocument([recess()])).toThrow(/Unknown element/);
    expect(() => editor.execute(new AddWallRecess('other', 'niche'))).toThrow(/wall or column/);
    const opening = editor.factory.opening({ id: 'door', type: 'door', width: 0.8, height: 2, floorHeight: 0, wallId: 'wall', position: { x: 1, y: 0 }, distanceAlongWall: 1 });
    expect(() => new PlanDocument([wall('wall'), opening])).toThrow(/owned by a wall/);
  });

  it('rehomes a gesture once, then moves away without leaving a stale cut', () => {
    const { editor, recess } = fixture();
    editor.execute(new TransformFurniture('niche', { x: 2, y: 0.7, z: 0.2 }));
    expect(recess().hostId).toBe('neighbor');
    expect(editor.getDocument().recessesFor('wall')).toHaveLength(0);
    editor.execute(new TransformFurniture('niche', { x: 2, y: 0.7, z: 5 }));
    expect(recess().hostId).toBeUndefined();
    expect(editor.getDocument().recessesFor('neighbor')).toHaveLength(0);
    editor.undo(); expect(recess().hostId).toBe('neighbor');
    editor.undo(); expect(recess().hostId).toBe('wall');
    editor.redo(); expect(recess().hostId).toBe('neighbor');
  });

  it('preserves a chosen host on resize even if another wall is coincident', () => {
    const { editor, recess } = fixture();
    editor.load(new PlanDocument([wall('neighbor'), wall('wall'), recess()]));
    editor.execute(new TransformFurniture('niche', undefined, undefined, { x: 0.8, y: 1.6, z: 0.2 }));
    expect(recess().hostId).toBe('wall');
    editor.execute(new ReplaceFurniture('niche', 'wall_recess', '/models/niche.glb'));
    expect(recess().hostId).toBe('wall');
  });

  it('rejects a wall split through a recess and rehosts a clear split without moving it', () => {
    const { editor, recess, codec } = fixture(), before = editor.getDocument();
    expect(() => editor.execute(new SplitWall('wall', 1))).toThrow(/recess/);
    expect(editor.getDocument()).toBe(before);
    editor.execute(new SplitWall('wall', 2));
    expect(recess().hostId).toBe('wall_a');
    expect(recess().position).toEqual(before.requireFurniture('niche').position);
    expect((codec.decode(codec.encode(editor.getDocument())).requireFurniture('niche') as WallRecess).hostId).toBe('wall_a');
    editor.undo(); expect(recess().hostId).toBe('wall');
  });

  it('uses the same split constraint for rotated columns, including hidden recesses', () => {
    const { editor, codec } = fixture();
    const column = new Column({ id: 'column', name: 'Column', type: 'column', width: 4, depth: 0.3, worldPos: { x: 0, y: 0, z: 0 }, rotationY: Math.PI / 2 });
    editor.load(new PlanDocument([column]));
    editor.execute(new AddWallRecess('niche', 'column', { width: 0.6, distanceAlongWall: 3 }));
    const recess = editor.getDocument().requireFurniture('niche') as WallRecess;
    editor.load(editor.getDocument().replace(recess.withVisibility(false)));
    expect(() => editor.execute(new SplitColumn('column', 3))).toThrow(/recess/);
    editor.execute(new SplitColumn('column', 2));
    for (const json of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(json);
      expect((restored.requireFurniture('niche') as WallRecess).hostId).toBe('column_b');
      expect(restored.requireFurniture('niche').position.x).toBeCloseTo(recess.position.x, 4);
      expect(restored.requireFurniture('niche').position.z).toBeCloseTo(recess.position.z, 4);
      expect(restored.requireFurniture('niche').visible).toBe(false);
    }
  });

  it('deletes dependent recesses with their host in one undoable operation', () => {
    const { editor, codec } = fixture(), before = editor.getDocument();
    editor.selection.select('furniture', before.requireFurniture('niche'));
    editor.execute(new RemoveElement('wall'));
    expect(editor.getDocument().get('niche')).toBeUndefined();
    expect(editor.selection.getSnapshot()).toBeNull();
    expect(codec.decode(codec.encode(editor.getDocument())).recesses).toHaveLength(0);
    editor.undo(); expect(editor.getDocument()).toBe(before);
  });

  it('replacement removes obsolete host behavior and round-trips the new subtype', () => {
    const { editor, codec } = fixture();
    editor.execute(new ReplaceFurniture('niche', 'chair'));
    expect(editor.getDocument().recesses).toHaveLength(0);
    expect(codec.decode(codec.encode(editor.getDocument())).recesses).toHaveLength(0);
    editor.execute(new ReplaceFurniture('niche', 'wall_recess'));
    expect(editor.getDocument().recesses).toHaveLength(1);
  });
});

describe('recess file boundaries', () => {
  it('round-trips canonical and legacy exports without runtime metadata ownership', () => {
    const { codec, editor } = fixture(), document = editor.getDocument();
    for (const json of [codec.encode(document), new LegacyPlanWriter().encode(document)]) {
      const restored = codec.decode(json), recess = restored.requireFurniture('niche') as WallRecess;
      expect(recess).toBeInstanceOf(WallRecess);
      expect(recess.hostId).toBe('wall');
      expect(recess.position).toEqual(document.requireFurniture('niche').position);
      expect(recess.rawItem?.wallId).toBeUndefined();
      expect(recess.rawItem?.wallThickness).toBeUndefined();
      const once = codec.encode(restored);
      expect(codec.encode(codec.decode(once))).toBe(once);
    }
  });

  it('migrates the previous canonical standard-furniture representation once', () => {
    const { codec, editor } = fixture(), value = JSON.parse(codec.encode(editor.getDocument()));
    const entry = value.document.elements.find((entry: { data: { id: string } }) => entry.data.id === 'niche');
    entry.kind = 'furniture.standard';
    entry.data.rawItem = { wallId: 'neighbor', wallThickness: 0.9, vendor: 'retained' };
    delete entry.data.recessHostId;
    const restored = codec.decode(value), recess = restored.requireFurniture('niche') as WallRecess;
    expect(recess.hostId).toBe('neighbor');
    expect(recess.position.z).toBe(0.2);
    expect(recess.rawItem).toEqual({ vendor: 'retained' });
    expect(JSON.parse(codec.encode(restored)).document.elements.find((entry: { data: { id: string } }) => entry.data.id === 'niche').kind).toBe('furniture.recess');
  });

  it('rejects dangling canonical host IDs rather than silently finding a different wall', () => {
    const { codec, editor } = fixture(), value = JSON.parse(codec.encode(editor.getDocument()));
    value.document.elements.find((entry: { data: { id: string } }) => entry.data.id === 'niche').data.recessHostId = 'missing';
    expect(() => codec.decode(value)).toThrow(/Unknown element/);
  });
});
