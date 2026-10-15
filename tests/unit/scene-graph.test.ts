import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FinishFurniture, RemoveElement, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { EditorSession } from '../../src/application/EditorSession';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanSceneGraph } from '../../src/engine/nodes/PlanSceneGraph';
import { SceneNodeFactory } from '../../src/engine/nodes/SceneNodeFactory';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';

function fixture() {
  const resources = new ResourcePool(), picking = new PickRegistry();
  const base = new THREE.MeshBasicMaterial(), finish = new THREE.MeshBasicMaterial({ color: '#ff0000' });
  const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: base }));
  const geometry = vi.fn(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), base));
  const factory = new SceneNodeFactory({
    furniture: { build: geometry }, appearance: { apply(root, element) { root.traverse(object => { if (object instanceof THREE.Mesh) object.material = element.finish ? finish : base; }); } },
    wall: { build: geometry, applyMaterials: () => { } }, column: { build: geometry, applyMaterials: () => { } }, room: { build: geometry, applyMaterials: () => { } }, opening: { build: geometry, update: () => { } }
  }, resources, picking);
  const graph = new PlanSceneGraph(factory, { walls: new THREE.Group(), openings: new THREE.Group(), floors: new THREE.Group(), furniture: new THREE.Group(), fixtures: new THREE.Group() });
  const codec = new PlanCodec(), editor = new EditorSession(codec.factory);
  editor.load(codec.decode({ plan: { items: { a: { name: 'chair', pc: { x: 0, y: 0 } }, b: { name: 'chair', pc: { x: 0, y: 0 } } } } }));
  graph.reconcile(editor.getDocument()); editor.subscribe(change => graph.reconcile(change.document));
  return { resources, picking, base, finish, palette, geometry, graph, editor };
}
describe('retained scene node ownership', () => {
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
