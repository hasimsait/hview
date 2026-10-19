import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FinishFurniture, RemoveElement, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { EditorSession } from '../../src/application/EditorSession';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanSceneGraph } from '../../src/engine/nodes/PlanSceneGraph';
import { SceneNodeFactory } from '../../src/engine/nodes/SceneNodeFactory';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { AddWallRecess } from '../../src/application/commands/AddWallRecess';
import { ConfigureBalconyRailing, FinishWall, SetCeilingHeight } from '../../src/application/commands/StructuralCommands';
import { rawPlan } from './fixtures';
import { Wall } from '../../src/domain/elements/Wall';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { Room } from '../../src/domain/elements/Room';
import { Door } from '../../src/domain/elements/Opening';

function fixture() {
  const resources = new ResourcePool(), picking = new PickRegistry();
  const base = new THREE.MeshBasicMaterial(), finish = new THREE.MeshBasicMaterial({ color: '#ff0000' });
  const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: base }));
  const geometry = vi.fn(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), base));
  const appearance = vi.fn((root: THREE.Object3D, element: { finish?: unknown }) => { root.traverse(object => { if (object instanceof THREE.Mesh) object.material = element.finish ? finish : base; }); });
  const walls = vi.fn(geometry);
  const factory = new SceneNodeFactory({
    furniture: { build: geometry }, appearance: { apply: appearance },
    wall: { build: walls, applyMaterials: () => { } }, column: { build: geometry, applyMaterials: () => { } }, room: { build: geometry, applyMaterials: () => { } }, opening: { build: geometry, update: () => { } }
  }, resources, picking);
  const graph = new PlanSceneGraph(factory, { walls: new THREE.Group(), openings: new THREE.Group(), floors: new THREE.Group(), furniture: new THREE.Group(), fixtures: new THREE.Group() });
  const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
  editor.load(codec.decode({ plan: { items: { a: { name: 'chair', pc: { x: 0, y: 0 } }, b: { name: 'chair', pc: { x: 0, y: 0 } } } } }));
  graph.reconcile(editor.getDocument()); editor.subscribe(change => graph.reconcile(change.document));
  return { resources, picking, base, finish, palette, geometry, graph, editor, appearance, walls };
}
describe('retained scene node ownership', () => {
  it('refreshes a joined wall outline after its neighbor is repainted or removed', () => {
    const { graph, editor, palette } = fixture();
    const first = new Wall({ id: 'first', p1: { x: 0, y: 0 }, p2: { x: 2, y: 0 }, thickness: .1, height: 2.7, material: 'a_block', openings: [] }, []);
    const second = new Wall({ ...first.toData(), id: 'second', p1: { x: 2, y: 0 }, p2: { x: 4, y: 0 } }, []);
    editor.load(new PlanDocument([first, second]));
    const root = graph.get(first.id)!.group, original = root.children[0];
    editor.execute(new FinishWall(second.id, { type: 'paint', color: '#333333' }, 'A'));
    expect(root.children[0]).not.toBe(original);
    const painted = root.children[0];
    editor.execute(new RemoveElement(second.id));
    expect(root.children[0]).not.toBe(painted);
    graph.dispose(); palette.dispose();
  });
  it('updates doorway floor coverage when an opening moves and retains it for door motion or furniture edits', () => {
    const { graph, editor, palette } = fixture();
    const room = new Room({ id: 'room', name: 'Room', area: 12, height: 2.7, polygon: [{ x: 0, y: .05 }, { x: 4, y: .05 }, { x: 4, y: 3 }, { x: 0, y: 3 }] });
    const door = new Door({ id: 'door', wallId: 'wall', type: 'door', width: 1, height: 2.1, floorHeight: 0, distanceAlongWall: 2, position: { x: 2, y: 0 } });
    const wall = new Wall({ id: 'wall', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: .1, height: 2.7, material: 'a_block', openings: [] }, [door]);
    let document = new PlanDocument([room, wall, ...editor.getDocument().furniture]);
    graph.reconcile(document);
    const floor = graph.get(room.id)!.group, original = floor.children[0];
    document = document.replace(door.withOpenAngle(90));
    graph.reconcile(document);
    expect(floor.children[0]).toBe(original);
    document = document.replace(document.requireWall(wall.id).withOpenings([new Door({ ...door.toData(), distanceAlongWall: 3, position: { x: 3, y: 0 } })]));
    graph.reconcile(document);
    expect(floor.children[0]).not.toBe(original);
    const moved = floor.children[0];
    document = document.replace(document.furniture[0].withTransform({ x: 1, y: 0, z: 1 }));
    graph.reconcile(document);
    expect(floor.children[0]).toBe(moved);
    graph.dispose(); palette.dispose();
  });
  it('rebuilds a railing floor when a bounding wall is removed and restores it with undo', () => {
    const { graph, editor, palette } = fixture(); editor.load(new PlanCodec().decode(rawPlan()));
    editor.execute(new ConfigureBalconyRailing('room', { height: 1.05, color: '#30363b' }));
    const room = graph.get('room')!.group, original = room.children[0], furniture = graph.get('sofa')!.group.children[0];
    editor.execute(new RemoveElement('wall'));
    expect(graph.get('room')!.group).toBe(room); expect(room.children[0]).not.toBe(original); expect(graph.get('sofa')!.group.children[0]).toBe(furniture);
    const withoutWall = room.children[0]; editor.undo(); expect(room.children[0]).not.toBe(withoutWall);
    graph.dispose(); palette.dispose();
  });
  it('refreshes window dressings and wall cornices on a room height edit while retaining roots and door geometry', () => {
    const { graph, editor, palette } = fixture(); editor.load(new PlanCodec().decode(rawPlan()));
    const window = graph.get('window')!.group, oldDressing = window.children[0], door = graph.get('door')!.group.children[0], wall = graph.get('wall')!.group;
    editor.execute(new SetCeilingHeight('room', 2.6));
    expect(graph.get('window')!.group).toBe(window); expect(window.children[0]).not.toBe(oldDressing);
    expect(graph.get('door')!.group.children[0]).toBe(door); expect(graph.get('wall')!.group).toBe(wall);
    graph.dispose(); palette.dispose();
  });
  it('refreshes recess inheritance on a host finish while retaining its geometry', () => {
    const { graph, editor, appearance, palette } = fixture();
    const wall = new Wall({ id: 'wall', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: 0.1, height: 2.7, material: 'a_block', openings: [] }, []);
    editor.load(new PlanDocument([wall]));
    editor.execute(new AddWallRecess('niche', wall.id));
    const root = graph.get('niche')!.group, content = root.children[0];
    appearance.mockClear();
    editor.execute(new FinishWall(wall.id, { type: 'paint', color: '#abcdef' }));
    expect(graph.get('niche')!.group).toBe(root);
    expect(root.children[0]).toBe(content);
    expect(appearance).toHaveBeenCalledOnce();
    editor.undo();
    expect(root.children[0]).toBe(content);
    expect(appearance).toHaveBeenCalledTimes(2);
    graph.dispose(); palette.dispose();
  });
  it('rebuilds only the owned host cut when a recess is removed or replaced', async () => {
    const { graph, editor, walls, palette } = fixture();
    const makeWall = (id: string, z: number) => new Wall({ id, p1: { x: 0, y: z }, p2: { x: 4, y: z }, thickness: 0.1, height: 2.7, material: 'a_block', openings: [] }, []);
    editor.load(new PlanDocument([makeWall('wall', 0), makeWall('neighbor', 0.2)]));
    editor.execute(new AddWallRecess('niche', 'wall'));
    walls.mockClear();
    const neighbor = graph.get('neighbor')!.group.children[0];
    const { ReplaceFurniture } = await import('../../src/application/commands/FurnitureCommands');
    editor.execute(new ReplaceFurniture('niche', 'chair'));
    expect(walls).toHaveBeenCalledOnce();
    expect(graph.get('neighbor')!.group.children[0]).toBe(neighbor);
    editor.undo(); walls.mockClear();
    editor.execute(new RemoveElement('niche'));
    expect(walls).toHaveBeenCalledOnce();
    expect(graph.get('neighbor')!.group.children[0]).toBe(neighbor);
    graph.dispose(); palette.dispose();
  });
  it('keeps root and geometry identities across transform and finish commands', () => {
    const { graph, editor, geometry } = fixture(); const root = graph.get('a')!.group, mesh = root.children[0] as THREE.Mesh;
    editor.execute(new TransformFurniture('a', { x: 2, y: 1, z: 3 }, 0.5));
    expect(graph.get('a')!.group).toBe(root); expect(root.children[0]).toBe(mesh); expect(root.position.toArray()).toEqual([2, 1, 3]);
    editor.execute(new FinishFurniture('a', { type: 'paint', color: '#ff0000' }));
    expect(root.children[0]).toBe(mesh); expect(geometry).toHaveBeenCalledTimes(2);
    graph.dispose();
  });
  it('does not route view-dependent rebuilds through furniture geometry', () => {
    const { graph, geometry, palette } = fixture();
    const root = graph.get('a')!.group, mesh = root.children[0];
    expect(() => graph.rebuildStructures()).not.toThrow();
    expect(root.children[0]).toBe(mesh); expect(geometry).toHaveBeenCalledTimes(2);
    graph.dispose(); palette.dispose();
  });
  it('releases replaced geometry, keeps shared materials alive, and removes pick registrations', () => {
    const { graph, editor, resources, picking, palette, base } = fixture();
    const root = graph.get('a')!.group, old = root.children[0] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(old.geometry, 'dispose'), disposeMaterial = vi.spyOn(base, 'dispose');
    editor.execute(new TransformFurniture('a', undefined, undefined, { x: 2, y: 1, z: 1 }));
    expect(graph.get('a')!.group).toBe(root); expect(disposeGeometry).toHaveBeenCalledOnce();
    editor.execute(new RemoveElement('a')); expect(disposeMaterial).not.toHaveBeenCalled();
    expect(picking.getCandidates()).toHaveLength(1);
    graph.dispose(); expect(picking.getCandidates()).toHaveLength(0); expect(resources.count(base)).toBe(1);
    palette.dispose(); expect(disposeMaterial).toHaveBeenCalledOnce(); expect(resources.size).toBe(0);
  });
  it('releases an overridden material when the finish is cleared', () => {
    const { editor, finish, graph, palette } = fixture(), dispose = vi.spyOn(finish, 'dispose');
    editor.execute(new FinishFurniture('a', { type: 'paint', color: '#ff0000' }));
    editor.execute(new FinishFurniture('a'));
    expect(dispose).toHaveBeenCalledOnce(); graph.dispose(); palette.dispose();
  });
});
