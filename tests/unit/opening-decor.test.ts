import * as THREE from 'three';
import { describe,expect,it } from 'vitest';
import { EditorSession } from '../../src/application/EditorSession';
import { ColorOpeningFrame,FinishOpening,SetWindowCurtains } from '../../src/application/commands/StructuralCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { Door,WindowOpening } from '../../src/domain/elements/Opening';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { OpeningSceneNode } from '../../src/engine/nodes/StructuralSceneNodes';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { rawPlan } from './fixtures';

function setup() {
  const codec = new PlanCodec();
  const editor = new EditorSession(codec.factory);
  editor.load(codec.decode(rawPlan()));
  return { codec,editor };
}

describe('door frames and window curtains', () => {
  it('colors a frame independently of its leaf, with undo and both export formats', () => {
    const { codec,editor } = setup();
    const leaf = { type: 'wood' as const, variant: 'natural_oak', color: '#bba078' };
    editor.execute(new FinishOpening('door', leaf));
    editor.execute(new ColorOpeningFrame('door', '#f8fafc'));
    expect(editor.getDocument().get('door')).toMatchObject({ frameColor: '#f8fafc', finish: leaf });
    editor.undo();
    expect((editor.getDocument().get('door') as Door).frameColor).toBeUndefined();
    editor.redo();
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      expect(codec.decode(encoded).get('door')).toMatchObject({ frameColor: '#f8fafc', finish: leaf });
    }
    editor.execute(new ColorOpeningFrame('door'));
    const reset = codec.decode(new LegacyPlanWriter().encode(editor.getDocument())).get('door') as Door;
    expect(reset.frameColor).toBeUndefined();
    expect(reset.finish).toEqual(leaf);
    expect(() => editor.execute(new ColorOpeningFrame('door', 'bad-color'))).toThrow('hex color');
  });

  it('clears its own frame and the finished floor throughout either room-door swing', () => {
    const { editor } = setup(), builder = new OpeningMeshBuilder(), feedback = new CollisionFeedback();
    const wall = editor.getDocument().requireWall('wall'), original = editor.getDocument().get('door') as Door;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6)); floor.rotation.x = -Math.PI / 2; floor.position.set(2, .002, 0); floor.updateMatrixWorld(true);
    for (const swingSide of ['l', 'r'] as const) for (const hingeSide of ['l', 'r'] as const) {
      const door = new Door({ ...original.toData(), swingSide, hingeSide, openAngle: 0 });
      const root = builder.buildOpening(door, wall), pivot = builder.interactionTarget(root)!;
      const moving: THREE.Mesh[] = [], obstacles = [floor];
      pivot.traverse(o => { if (o instanceof THREE.Mesh) moving.push(o); });
      root.traverse(o => { if (o instanceof THREE.Mesh && !pivot.getObjectById(o.id)) obstacles.push(o); });
      for (let angle = 0; angle <= 180; angle += 2) {
        builder.update(root, door.withOpenAngle(angle)); root.updateMatrixWorld(true);
        for (const leaf of moving) for (const other of obstacles) expect(feedback.intersects(leaf, other), `${swingSide}/${hingeSide}, ${angle} degrees / ${other.name}`).toBe(false);
      }
    }
    feedback.dispose();
  });

  it('defaults old and French windows to curtains and remembers hiding and deletion', () => {
    const { codec,editor } = setup();
    const window = editor.getDocument().get('window') as WindowOpening;
    expect(window.curtainState).toBe('visible');
    expect(new WindowOpening({ ...window.toData(), type: 'french_window' }).curtainState).toBe('visible');
    for (const state of ['hidden', 'removed'] as const) {
      editor.execute(new SetWindowCurtains('window', state));
      for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
        expect((codec.decode(encoded).get('window') as WindowOpening).curtainState).toBe(state);
      }
    }
    editor.undo();
    expect((editor.getDocument().get('window') as WindowOpening).curtainState).toBe('hidden');
    editor.undo();
    expect((editor.getDocument().get('window') as WindowOpening).curtainState).toBe('visible');
    expect(() => editor.execute(new SetWindowCurtains('door', 'removed'))).toThrow('Expected a window');
  });

  it('updates all three frame members without changing another door or the leaf', () => {
    const { editor } = setup();
    const wall = editor.getDocument().requireWall('wall');
    const door = editor.getDocument().get('door') as Door;
    const builder = new OpeningMeshBuilder();
    const first = builder.buildOpening(door, wall);
    const second = builder.buildOpening(new Door({ ...door.toData(), id: 'other' }), wall);
    const frame = first.getObjectByName('doorFrame_left_door') as THREE.Mesh;
    const oldGeometry = frame.geometry;
    const pivot = first.getObjectByName('doorPivot_door')!;
    const leafMaterial = (pivot.children[0] as THREE.Mesh).material;
    builder.update(first, door.withFrameColor('#ff0000'));
    for (const side of ['left', 'right', 'top']) {
      const mesh = first.getObjectByName(`doorFrame_${side}_door`) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
      expect(mesh.material.color.getHexString()).toBe('ff0000');
    }
    expect(frame.geometry).toBe(oldGeometry);
    expect((pivot.children[0] as THREE.Mesh).material).toBe(leafMaterial);
    expect(((second.getObjectByName('doorFrame_left_other') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString()).toBe('333338');
    builder.update(first, door);
    expect((frame.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('333338');
  });

  it('mounts pleated panels at the ceiling on the interior side and clears the floor', () => {
    const { editor } = setup();
    const wall = editor.getDocument().requireWall('wall');
    const window = editor.getDocument().get('window') as WindowOpening;
    const builder = new OpeningMeshBuilder();
    const group = builder.buildOpening(window, wall, { ceilingHeight: 3.2, interiorSide: -1 });
    group.updateMatrixWorld(true);
    const track = group.getObjectByName('curtain_track_window')!;
    expect(new THREE.Box3().setFromObject(track).max.y).toBeCloseTo(3.2, 5);
    const left = group.getObjectByName('curtain_left_window')!;
    const bounds = new THREE.Box3().setFromObject(left);
    expect(bounds.min.y).toBeCloseTo(0.025, 5);
    expect(bounds.max.z).toBeLessThan(-wall.thickness / 2);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.09);
    expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(.12);
    const right = group.getObjectByName('curtain_right_window')!;
    expect(left.position.x).toBeLessThan(right.position.x);
    expect(builder.buildOpening(window.withCurtainState('removed'), wall).getObjectByName('curtains_window')).toBeUndefined();
  });

  it('reconciles hide/delete/restore without leaking GPU resources or recreating deleted curtains', () => {
    const { editor } = setup();
    const wall = editor.getDocument().requireWall('wall');
    const window = editor.getDocument().get('window') as WindowOpening;
    const builder = new OpeningMeshBuilder();
    const resources = new ResourcePool();
    const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const node = new OpeningSceneNode(window, { build: opening => builder.buildOpening(opening, wall), update: (root, opening) => builder.update(root, opening) }, resources, new PickRegistry());
    node.reconcile(window.withCurtainState('hidden'));
    expect(node.group.getObjectByName('curtains_window')?.visible).toBe(false);
    node.reconcile(window.withCurtainState('removed'));
    expect(node.group.getObjectByName('curtains_window')).toBeUndefined();
    node.rebuild();
    expect(node.group.getObjectByName('curtains_window')).toBeUndefined();
    node.reconcile(window);
    expect(node.group.getObjectByName('curtains_window')?.visible).toBe(true);
    node.dispose(); palette.dispose();
    expect(resources.size).toBe(0);
  });
});
