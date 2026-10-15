import { describe, expect, it } from 'vitest';
import { ConfigureLuminaire, FinishFurniture, RemoveElement, ReplaceFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { ConfigureCeiling, FinishFloor, FinishWall, FrameWall, OpenDoor, RenameRoom, SplitWall } from '../../src/application/commands/StructuralCommands';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { createEditor } from '../support/editor';
import { rawPlan } from './fixtures';

const codec = new PlanCodec(), legacy = new LegacyPlanWriter();
for (const format of ['canonical', 'legacy'] as const) describe(`${format} document round trips`, () => {
  const encode = format === 'canonical' ? codec.encode.bind(codec) : legacy.encode.bind(legacy);
  it('preserves unknown metadata without mutating input', () => {
    const input = rawPlan(), original = structuredClone(input);
    const result = codec.decode(encode(codec.decode(input)));
    expect(legacy.encode(result)).toContain('preserve me');
    expect(legacy.encode(result)).toContain('regression fixture');
    expect(input).toEqual(original);
  });
  it('round trips moves, elevations, radians and custom dimensions', () => {
    const editor = createEditor(); editor.documents.load(rawPlan());
    editor.execute(new TransformFurniture('sofa', { x: 1.2345, y: 0.4321, z: 3.4567 }, -0.4567, { x: 2.1234, y: 0.7654, z: 0.9876 }));
    const before = editor.getDocument().requireFurniture('sofa'), after = codec.decode(encode(editor.getDocument())).requireFurniture('sofa');
    expect(after.position).toEqual(before.position); expect(after.dimensions).toEqual(before.dimensions); expect(after.rotationY).toBe(before.rotationY);
  });
  it('round trips a real luminaire and clears incompatible settings when replaced', () => {
    const editor = createEditor(); editor.documents.load(rawPlan());
    editor.execute(new ReplaceFurniture('sofa', 'chandelier'));
    editor.execute(new ConfigureLuminaire('sofa', { enabled: false, intensity: 0.5 }));
    expect(codec.decode(encode(editor.getDocument())).requireLuminaire('sofa').intensity).toBe(0.5);
    editor.execute(new ReplaceFurniture('sofa', 'chair'));
    editor.execute(new FinishFurniture('sofa', { type: 'wood', variant: 'oak' }));
    editor.execute(new FinishFurniture('sofa', { type: 'paint', color: '#ff0000' }, 'legs'));
    editor.execute(new FinishFurniture('sofa', undefined, 'legs'));
    editor.execute(new FinishFurniture('sofa'));
    const item = codec.decode(encode(editor.getDocument())).requireFurniture('sofa');
    expect(item.lightConfig).toBeUndefined(); expect(item.finish).toBeUndefined(); expect(Object.keys(item.sectionFinishes ?? {})).toHaveLength(0);
  });
  it('removes deleted walls, furniture and hosted openings without resurrection', () => {
    const editor = createEditor(); editor.documents.load(rawPlan());
    editor.execute(new RemoveElement('door'));
    expect(codec.decode(encode(editor.getDocument())).get('door')).toBeUndefined();
    editor.execute(new RemoveElement('sofa')); editor.execute(new RemoveElement('wall'));
    const restored = codec.decode(encode(editor.getDocument()));
    expect(restored.walls).toHaveLength(0); expect(restored.furniture).toHaveLength(0); expect(restored.get('window')).toBeUndefined();
  });
  it('round trips split walls, retained opening world positions, frames and surfaces', () => {
    const editor = createEditor(); editor.documents.load(rawPlan());
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#123456' }, 'A'));
    editor.execute(new FrameWall('wall', 'grid_3', '#101010'));
    editor.execute(new OpenDoor('door', 85)); editor.execute(new SplitWall('wall', 2));
    const restored = codec.decode(encode(editor.getDocument()));
    expect(restored.walls.map(wall => wall.id)).toEqual(['wall_a', 'wall_b']);
    expect(restored.requireWall('wall_b').openings[0].distanceAlongWall).toBe(1);
    expect(restored.requireWall('wall_a').openings[0].openAngle).toBe(85);
    expect(restored.requireWall('wall_a').finishSideA?.color).toBe('#123456');
    expect(restored.requireWall('wall_a').frameStyle).toBe('grid_3');
  });
  it('round trips room naming, floors, ceilings and window elevation', () => {
    const editor = createEditor(); editor.documents.load(rawPlan());
    editor.execute(new RenameRoom('room', 'Kitchen')); editor.execute(new FinishFloor('room', { type: 'tile', groutWidth: 2 })); editor.execute(new ConfigureCeiling('room', 'gypsum'));
    const restored = codec.decode(encode(editor.getDocument()));
    expect(restored.rooms[0]).toMatchObject({ name: 'Kitchen', floorFinish: { type: 'tile', groutWidth: 2 }, ceilingType: 'gypsum' });
    expect(restored.requireWall('wall').openings.find(opening => opening.id === 'window')!.floorHeight).toBe(0.9);
  });
});
