import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { selectedFurniture } from '../../src/application/queries/SelectionQueries';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PickRegistry, PickingController } from '../../src/engine/picking/PickRegistry';
import { InteractionService } from '../../src/services/interaction/InteractionService';
import { createEditor } from '../support/editor';
import { rawPlan } from './fixtures';

function meshAt(z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.position.z = z;
  return mesh;
}

function sceneFixture() {
  const scene = new THREE.Scene();
  const group = new THREE.Group(); group.name = 'furnitureGroup'; scene.add(group);
  const front = new THREE.Group(), middle = new THREE.Group();
  front.add(middle); middle.add(meshAt(2)); group.add(front);
  const rear = meshAt(0); group.add(rear);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 5; camera.updateMatrixWorld(true);
  const registry = new PickRegistry(); registry.register(front, { kind: 'furniture', id: 'front' }); registry.register(rear, { kind: 'furniture', id: 'rear' });
  const picker = new PickingController(registry);
  return { scene, group, front, middle, frontMesh: middle.children[0], rear, ray, camera, picker };
}

describe('hidden object picking', () => {
  it.each(['root', 'ancestor', 'mesh'] as const)('ignores a hidden %s and hits the visible object behind it', level => {
    const { group, front, middle, frontMesh, rear, ray, camera, picker } = sceneFixture();
    ({ root: front, ancestor: middle, mesh: frontMesh })[level].visible = false;
    // The production raycaster itself still reports the hidden front mesh.
    expect(ray.intersectObjects(group.children, true)[0].object).toBe(frontMesh);
    expect(picker.pick(new THREE.Vector2(), camera)?.hit.object).toBe(rear);
  });

  it('ignores children of a hidden main group and restores picking when shown again', () => {
    const { group, frontMesh, camera, picker } = sceneFixture();
    group.visible = false;
    expect(picker.pick(new THREE.Vector2(), camera)).toBeNull();
    group.visible = true;
    expect(picker.pick(new THREE.Vector2(), camera)?.hit.object).toBe(frontMesh);
  });

  it.each([false, true])('editor selects only visible furniture (visible object behind hidden object: %s)', withRear => {
    const { scene, group, front, rear } = sceneFixture();
    const raw = rawPlan();
    Object.assign(raw.plan.items, { rear: { ...raw.plan.items.sofa } });
    const manager = createEditor(undefined, new PlanCodec());
    const plan = manager.documents.load(raw);
    front.userData.entity = plan.furniture.find(f => f.id === 'sofa');
    rear.userData.entity = plan.furniture.find(f => f.id === 'rear');
    front.visible = false;
    if (!withRear) group.remove(rear);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 5; camera.updateMatrixWorld(true);
    const registry = new PickRegistry();
    registry.register(front, { kind: 'furniture', id: 'sofa' });
    if (withRear) registry.register(rear, { kind: 'furniture', id: 'rear' });
    const picker = new PickingController(registry);
    const interaction = new InteractionService();
    // Exercise the real click handler without initializing GPU or DOM gizmos.
    Object.assign(interaction, {
      sceneService: {
        getDomElement: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }),
        getCamera: () => camera, getScene: () => scene, pick: (point: THREE.Vector2) => picker.pick(point, camera),
      },
      editor: manager, pointerDownPos: { x: 50, y: 50 },
    });
    const selected = vi.fn(); manager.selection.subscribe(selected);
    (interaction as any).onPointerUp({ clientX: 50, clientY: 50 });
    expect(selectedFurniture(manager)?.id).toBe(withRear ? 'rear' : undefined);
    expect(manager.selection.getSnapshot()?.id).not.toBe('sofa');
  });
});
