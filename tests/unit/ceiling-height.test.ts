import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureCeiling, SetCeilingHeight } from '../../src/application/commands/StructuralCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { Room } from '../../src/domain/elements/Room';
import { roomCeilingHeight } from '../../src/domain/model/Ceiling';
import { CeilingMeshBuilder } from '../../src/engine/geometry/CeilingMeshBuilder';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { rawPlan } from './fixtures';

function setup() {
  const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
  editor.load(codec.decode(rawPlan()));
  return { codec, editor };
}
const material = new THREE.MeshBasicMaterial();
const builder = new CeilingMeshBuilder({ getMaterial: () => material, applyOutlineOcclusion() {} } as unknown as SurfaceMaterialFactory);

describe('finished ceiling elevations', () => {
  it('gives clip-in ceilings a 15 cm default drop and leaves smooth ceilings at room height', () => {
    const { editor } = setup(), room = editor.getDocument().rooms[0];
    expect(roomCeilingHeight(room, 3)).toBe(3);
    expect(roomCeilingHeight(room.withCeiling('clip_in'), 3)).toBeCloseTo(2.85);
    expect(roomCeilingHeight(room.renamed('Shower room'), 3)).toBeCloseTo(2.85);
    expect(roomCeilingHeight(room.withCeiling('clip_in'), 2.7)).toBeCloseTo(2.55);
  });
  it('keeps independent room heights, structural walls and the shared maximum intact with undo', () => {
    const { editor } = setup(), original = editor.getDocument(), room = original.rooms[0];
    editor.load(original.add(new Room({ ...room.toData(), id: 'other', name: 'Other room' })));
    editor.execute(new SetCeilingHeight('room', 2.6));
    expect(roomCeilingHeight(editor.getDocument().requireRoom('room'), 3)).toBe(2.6);
    expect(roomCeilingHeight(editor.getDocument().requireRoom('other'), 3)).toBe(3);
    expect(editor.getDocument().walls[0]).toBe(original.walls[0]);
    expect(editor.getDocument().rooms[0].height).toBe(3); expect(editor.getDocument().totalHeight).toBe(3);
    editor.undo(); expect(editor.getDocument().rooms[0].ceilingHeight).toBeUndefined();
    editor.redo(); expect(editor.getDocument().rooms[0].ceilingHeight).toBe(2.6);
  });
  it('retains explicit heights through finish changes and resets to the current finish default', () => {
    const { editor } = setup();
    editor.execute(new SetCeilingHeight('room', 2.5)); editor.execute(new ConfigureCeiling('room', 'clip_in'));
    expect(roomCeilingHeight(editor.getDocument().rooms[0], 3)).toBe(2.5);
    editor.execute(new SetCeilingHeight('room')); expect(roomCeilingHeight(editor.getDocument().rooms[0], 3)).toBeCloseTo(2.85);
  });
  it('round trips metres in canonical plans and centimetres in legacy plans, including clearing a prior override', () => {
    const { codec, editor } = setup(); editor.execute(new ConfigureCeiling('room', 'clip_in')); editor.execute(new SetCeilingHeight('room', 2.62));
    const writer = new LegacyPlanWriter(), legacy = writer.encode(editor.getDocument());
    expect(JSON.parse(legacy).plan.rooms2.room.ceilingHeight).toBe(262);
    for (const raw of [legacy, codec.encode(editor.getDocument())]) expect(codec.decode(raw).rooms[0]).toMatchObject({ ceilingHeight: 2.62, height: 3, ceilingType: 'clip_in' });
    editor.load(codec.decode(legacy)); editor.execute(new SetCeilingHeight('room'));
    const restored = codec.decode(writer.encode(editor.getDocument())); expect(restored.rooms[0].ceilingHeight).toBeUndefined();
    expect(roomCeilingHeight(restored.rooms[0], restored.totalHeight)).toBeCloseTo(2.85);
  });
  it.each([0, -.1, NaN, Infinity, 3.01])('rejects invalid height %s without changing the document', height => {
    const { editor } = setup(), previous = editor.getDocument();
    expect(() => editor.execute(new SetCeilingHeight('room', height))).toThrow(); expect(editor.getDocument()).toBe(previous);
  });
  it('builds the underside at finished height and closes its perimeter up to the shared maximum', () => {
    const { editor } = setup(); editor.execute(new ConfigureCeiling('room', 'clip_in')); editor.execute(new SetCeilingHeight('room', 2.6));
    const group = builder.buildCeilings(editor.getDocument()), mesh = group.getObjectByName('ceiling_room') as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(mesh);
    expect(bounds.min.y).toBeCloseTo(2.6); expect(bounds.max.y).toBeCloseTo(3);
    expect(mesh.userData.drop).toBeCloseTo(.4); expect(mesh.castShadow).toBe(true); expect(mesh.receiveShadow).toBe(true);
    expect(mesh.geometry.groups.some(g => g.materialIndex === 1)).toBe(true);
    editor.execute(new SetCeilingHeight('room', 3));
    expect((builder.buildCeilings(editor.getDocument()).children[0] as THREE.Mesh).geometry.type).toBe('ShapeGeometry');
    editor.execute(new ConfigureCeiling('room', 'none')); expect(builder.buildCeilings(editor.getDocument()).children).toHaveLength(0);
  });
});
