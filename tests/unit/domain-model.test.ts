import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession';
import { CommandBatch } from '../../src/application/commands/EditorCommand';
import { FinishFurniture, ReplaceFurniture, SetLightIntensity, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { FinishWall, SplitWall } from '../../src/application/commands/StructuralCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { Column } from '../../src/domain/elements/Column';
import { Luminaire, Shelving, StandardFurniture } from '../../src/domain/elements/Furniture';
import { Door, SlidingDoor } from '../../src/domain/elements/Opening';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanElementFactory } from '../../src/domain/factories/PlanElementFactory';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { rawPlan } from './fixtures';

function lightPlan() {
  return {
    plan: {
      total_height: 270, items: {
        light: {
          name: 'wall_spot', pc: { x: 100, y: 200 },
          width: 10, height: 14, self_height: 15, lightConfig: { intensity: 1, enabled: true }
        }
      }
    }
  };
}

describe('class-based document and editing', () => {
  it('keeps the full supported shelf range through both codecs and subsequent edits', () => {
    const codec = new PlanCodec();
    const data = codec.decode(lightPlan()).furniture[0].toData();
    const shelves = new Shelving({ ...data, assetKey: 'open_shelving', shelfCount: Shelving.maxShelves, hasLids: true });
    const document = new PlanDocument([shelves.withFinish({ type: 'paint', color: '#abcdef' })]);
    for (const json of [codec.encode(document), new LegacyPlanWriter().encode(document)]) {
      const restored = codec.decode(json).requireFurniture(shelves.id) as Shelving;
      expect(restored).toBeInstanceOf(Shelving);
      expect(restored.shelfCount).toBe(Shelving.maxShelves);
      expect(restored.hasLids).toBe(true);
    }
    expect(() => shelves.withShelfConfiguration(11)).toThrow(/shelves/);
  });
  it('keeps door input and rotation rules on the door classes', () => {
    const opening = new PlanCodec().decode(rawPlan()).walls[0].openings[0] as Door;
    expect(opening.withOpenAngle(44.6).openAngle).toBe(45);
    expect(opening.withOpenAngle(-1).openAngle).toBe(0);
    expect(opening.rotatedBy(250).openAngle).toBe(180);
    expect(opening.rotatedBy(180).swingSide).not.toBe(opening.swingSide);
    expect(() => opening.withOpenAngle(NaN)).toThrow(/finite/);
    const sliding = new SlidingDoor({ ...opening.toData(), type: 'door_coupe' });
    expect(sliding.withOpenAngle(250).openAngle).toBe(180);
  });
  it('constructs behavioral light instances without a DOM or renderer', () => {
    const document = new PlanCodec().decode(lightPlan());
    const light = document.requireLuminaire('light');
    expect(light).toBeInstanceOf(Luminaire);
    expect(light.withIntensity(2).intensity).toBe(2);
    expect(light.intensity).toBe(1);
    expect(() => light.withIntensity(4)).toThrow(/intensity/);
    expect(() => light.withIntensity(NaN)).toThrow(/finite/);
  });
  it('electrical socket category does not make an object a luminaire', () => {
    const input = lightPlan(); input.plan.items.light.name = 'socket';
    expect(new PlanCodec().decode(input).requireFurniture('light')).toBeInstanceOf(StandardFurniture);
  });
  it('does not alias or mutate input metadata or geometry', () => {
    const input = lightPlan();
    const document = new PlanCodec().decode(input);
    input.plan.items.light.pc.x = 900;
    expect(document.requireLuminaire('light').position.x).toBe(1);
    expect(Reflect.set(document.requireLuminaire('light').position, 'x', 4)).toBe(false);
  });
  it('round-trips concrete types, lighting, and extensions through a versioned codec', () => {
    const codec = new PlanCodec();
    const before = codec.decode({ ...lightPlan(), extra: { vendor: 'keep' } });
    const edited = before.replace(before.requireLuminaire('light').withIntensity(2.5));
    const restored = codec.decode(codec.encode(edited));
    expect(restored.requireLuminaire('light').intensity).toBe(2.5);
    expect(restored.requireLuminaire('light')).toBeInstanceOf(Luminaire);
    expect(restored.rawPlan).toMatchObject({ extra: { vendor: 'keep' } });
    expect(JSON.parse(codec.encode(restored))).toEqual(JSON.parse(codec.encode(edited)));
  });
  it('reports paths in malformed canonical input and rejects future versions', () => {
    const codec = new PlanCodec();
    const value = JSON.parse(codec.encode(codec.decode(lightPlan())));
    value.document.elements[0].data.position.x = null;
    expect(() => codec.decode(value)).toThrow(/position/);
    expect(() => codec.decode({ schemaVersion: 999 })).toThrow(/Unsupported/);
  });
  it('commits a meaningful command, restores snapshots on undo and redo, and becomes clean at the saved snapshot', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    editor.load(codec.decode(lightPlan()));
    const original = editor.getDocument();
    editor.execute(new SetLightIntensity('light', 2));
    const edited = editor.getDocument();
    expect(editor.isDirty).toBe(true);
    editor.markSaved(edited);
    editor.undo();
    expect(editor.getDocument()).toBe(original);
    expect(editor.isDirty).toBe(true);
    editor.redo();
    expect(editor.getDocument()).toBe(edited);
    expect(editor.isDirty).toBe(false);
  });
  it('publishes an atomic batch once and rejects an invalid batch without partial edits or history', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    editor.load(codec.decode(lightPlan()));
    let events = 0; editor.subscribe(() => events++);
    const before = editor.getDocument();
    expect(() => editor.execute(new CommandBatch('Invalid', [new SetLightIntensity('light', 2), new SetLightIntensity('light', -1)]))).toThrow();
    expect(editor.getDocument()).toBe(before);
    expect(editor.history.canUndo).toBe(false);
    expect(events).toBe(0);
    editor.execute(new CommandBatch('Adjust light', [new SetLightIntensity('light', 2), new SetLightIntensity('light', 2.5)]));
    expect(events).toBe(1);
    editor.undo(); expect(editor.getDocument()).toBe(before);
  });
  it('preserves identity, customized size and elevation when replacing a subtype', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    editor.load(codec.decode(lightPlan()));
    const previous = editor.getDocument().requireLuminaire('light');
    editor.execute(new ReplaceFurniture('light', 'chair'));
    const chair = editor.getDocument().requireFurniture('light');
    expect(chair).toBeInstanceOf(StandardFurniture);
    expect(chair.id).toBe(previous.id);
    expect(chair.position).toEqual(previous.position);
    expect(chair.dimensions).toEqual(previous.dimensions);
    expect(chair.lightConfig).toBeUndefined();
    expect(codec.decode(codec.encode(editor.getDocument())).requireFurniture('light').assetKey).toBe('chair');
  });
  it('does not publish no-op transforms or intensity changes', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    editor.load(codec.decode(lightPlan()));
    const previous = editor.getDocument(), item = previous.requireLuminaire('light');
    editor.execute(new SetLightIntensity('light', 1));
    editor.execute(new TransformFurniture('light', item.position, item.rotationY, item.dimensions));
    expect(editor.getDocument()).toBe(previous);
    expect(editor.history.canUndo).toBe(false);
    expect(editor.isDirty).toBe(false);
  });
  it('owns independent wall faces and refuses a split through an opening', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    editor.load(codec.decode(rawPlan()));
    const wall = editor.getDocument().walls.find(item => item.openings.length)!;
    editor.execute(new FinishWall(wall.id, { type: 'paint', color: '#123456' }, 'A'));
    const edited = editor.getDocument().requireWall(wall.id);
    expect(edited.finishSideA?.color).toBe('#123456');
    expect(edited.finishSideB?.color).not.toBe('#123456');
    expect(() => editor.execute(new SplitWall(wall.id, wall.openings[0].distanceAlongWall))).toThrow(/opening/);
  });
  it('stores actual columns and deleting the final column cannot resurrect it', () => {
    const codec = new PlanCodec(), factory = new PlanElementFactory();
    const column = factory.column({ id: 'column', name: 'Column', type: 'column', width: 0.3, depth: 0.2, worldPos: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const document = codec.decode(lightPlan()).add(column);
    expect(codec.decode(codec.encode(document)).require('column')).toBeInstanceOf(Column);
    expect(codec.decode(codec.encode(document.remove('column'))).columns).toHaveLength(0);
  });
});

describe('column topology', () => {
  it('splits a column into two columns while preserving footprint and finishes', async () => {
    const { SplitColumn, FinishColumn } = await import('../../src/application/commands/StructuralCommands');
    const codec = new PlanCodec(), factory = codec.factory, editor = new EditorSession(factory);
    const column = factory.column({ id: 'column', name: 'Column', type: 'column', width: 1.2, depth: 0.4, height: 3, worldPos: { x: 2, y: 0, z: 2 }, rotationY: 0 });
    editor.load(new PlanDocument([column]));
    editor.selection.select('column', column, 'front');
    editor.execute(new FinishColumn('column', { type: 'paint', color: '#123456' }, 'front'));
    editor.execute(new SplitColumn('column', 0.5));
    expect(editor.getDocument().columns.map(column => column.width)).toEqual([0.5, 0.7]);
    expect(editor.getDocument().columns.map(column => column.worldPos.x)).toEqual([1.65, 2.25]);
    expect(editor.selection.getSnapshot()?.id).toBe('column_a');
    expect(codec.decode(codec.encode(editor.getDocument())).columns.every(column => column.finishFront?.color === '#123456')).toBe(true);
    editor.undo(); expect(editor.getDocument().columns).toHaveLength(1);
  });
});

describe('canonical surface identity', () => {
  it('normalizes legacy case aliases and clearing a surface cannot restore its old alias', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory), raw = rawPlan();
    Object.assign(raw.plan.items.sofa, { sectionFinishes: { Wood: { type: 'paint', color: '#123456' } } });
    editor.load(codec.decode(raw));
    expect(editor.getDocument().requireFurniture('sofa').sectionFinishes).toEqual({ wood: { type: 'paint', color: '#123456' } });
    editor.execute(new FinishFurniture('sofa', undefined, 'Wood'));
    expect(codec.decode(codec.encode(editor.getDocument())).requireFurniture('sofa').sectionFinishes).toEqual({});
  });
  it('stores a recess surface once even when the historical alias is edited', () => {
    const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
    const data = { ...codec.decode(rawPlan()).furniture[0].toData(), assetKey: 'wall_recess', sectionFinishes: {
      girinti_wall: { type: 'paint' as const, color: '#111111' }, recess_wall: { type: 'paint' as const, color: '#222222' },
      corners: { type: 'plaster' as const }, sides: { type: 'paint' as const, color: '#333333' },
    } };
    editor.load(new PlanDocument([codec.factory.furniture(data)]));
    expect(Object.keys(editor.getDocument().furniture[0].sectionFinishes!)).toEqual(['recess_wall', 'sides']);
    editor.execute(new FinishFurniture(data.id, { type: 'paint', color: '#abcdef' }, 'girinti_wall'));
    expect(editor.getDocument().furniture[0].sectionFinishes?.recess_wall.color).toBe('#abcdef');
    expect(editor.getDocument().furniture[0].sectionFinishes?.girinti_wall).toBeUndefined();
  });
});
