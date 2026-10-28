import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { mergeStaticParts } from '../../src/engine/geometry/MergeStaticParts';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';

describe('motion collision broad phase', () => {
  it.each([false, true])('preserves merged lattice gaps with transformed curved obstacles (moving merged=%s)', movingMerged => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), lattice = new THREE.Group(); scene.add(pivot);
    const material = new THREE.MeshBasicMaterial();
    const bars = [-.2, .2].map(x => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.04, .5, .04), material);
      mesh.position.x = x; mesh.userData.section = 'Laundry Basket'; lattice.add(mesh); return mesh;
    });
    const obstacle = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .1, 16), material);
    obstacle.rotation.x = Math.PI / 2;
    pivot.add(movingMerged ? lattice : obstacle); scene.add(movingMerged ? obstacle : lattice);
    scene.rotation.y = .37; scene.scale.set(1.2, .8, .7); scene.updateMatrixWorld(true);
    const feedback = new CollisionFeedback();
    expect(bars.some(bar => feedback.intersects(bar, obstacle))).toBe(false);
    mergeStaticParts(bars); scene.updateMatrixWorld(true);
    const merged = lattice.children[0] as THREE.Mesh;
    const moving = movingMerged ? merged : obstacle;
    expect(feedback.prepare(pivot, [merged, obstacle]).intersects([moving])).toBe(false);
    obstacle.position.x = .2; scene.updateMatrixWorld(true);
    expect(feedback.prepare(pivot, [merged, obstacle]).intersects([moving])).toBe(true);
    feedback.dispose(); new ResourcePool().ownTree(scene).dispose();
  });

  it('keeps a real laundry basket gap clear of a small cylindrical object', () => {
    const codec = new PlanCodec(), asset = codec.factory.catalog.get('cabinet_laundry_tiltout')!;
    const item = codec.factory.furniture({ id: 'basket', name: asset.key, assetKey: asset.key, displayName: asset.name,
      category: 'storage', dimensions: asset.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const root = new FurnitureMeshBuilder(codec.factory.catalog).build(item), scene = new THREE.Group();
    const obstacle = new THREE.Mesh(new THREE.CylinderGeometry(.001, .001, .008, 12), new THREE.MeshBasicMaterial());
    obstacle.position.set(0, .0563666653, -.148); scene.add(root, obstacle); scene.updateMatrixWorld(true);
    const moving: THREE.Mesh[] = [];
    root.getObjectByName('cabinet_door_0')!.traverse(object => { if (object instanceof THREE.Mesh) moving.push(object); });
    const feedback = new CollisionFeedback();
    expect(feedback.prepare(root, [obstacle]).intersects(moving)).toBe(false);
    obstacle.position.y = .046; scene.updateMatrixWorld(true);
    expect(feedback.prepare(root, [obstacle]).intersects(moving)).toBe(true);
    feedback.dispose(); new ResourcePool().ownTree(scene).dispose();
  });

  it('detects the sixth DAGGASTER dish in both the broad phase and exact triangles', () => {
    const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), asset = catalog.get('ikea_00112090')!;
    const entity = codec.factory.furniture({ id: 'dishes', name: asset.key, assetKey: asset.key, displayName: asset.name,
      category: 'kitchen', dimensions: asset.defaultDimensions, position: { x: .8, y: .3, z: -.6 }, rotationY: .4 });
    const root = new FurnitureMeshBuilder(catalog).build(entity), scene = new THREE.Group(), pivot = new THREE.Group();
    root.position.copy(entity.position); root.rotation.y = entity.rotationY; root.scale.set(1.3, .8, .7); scene.add(root, pivot); scene.updateMatrixWorld(true);
    let dishes: THREE.InstancedMesh | undefined;
    root.traverse(part => { if (!dishes && part instanceof THREE.InstancedMesh && part.count === 6) dishes = part; });
    expect(dishes).toBeDefined();
    const geometry = dishes!.geometry, positions = geometry.getAttribute('position'), index = geometry.index;
    const triangle = new THREE.Triangle(), top = new THREE.Vector3(); let height = -Infinity;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      triangle.a.fromBufferAttribute(positions, index ? index.getX(i) : i);
      triangle.b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);
      triangle.c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
      const center = triangle.getMidpoint(new THREE.Vector3());
      if (center.y > height) { height = center.y; top.copy(center); }
    }
    const sixth = new THREE.Matrix4(); dishes!.getMatrixAt(5, sixth); sixth.premultiply(dishes!.matrixWorld);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.003, .003, .003), new THREE.MeshBasicMaterial());
    leaf.position.copy(top.applyMatrix4(sixth)); pivot.add(leaf); scene.updateMatrixWorld(true);
    const feedback = new CollisionFeedback(), prototype = new THREE.Mesh(geometry, dishes!.material);
    prototype.matrixWorld.copy(dishes!.matrixWorld);
    expect(feedback.intersects(leaf, prototype)).toBe(false);
    expect(feedback.intersects(leaf, dishes!)).toBe(true);
    expect(feedback.prepare(pivot, [dishes!]).intersects([leaf])).toBe(true);
    const query = feedback.prepare(pivot, [dishes!]); leaf.position.y += .1; scene.updateMatrixWorld(true);
    expect(query.intersects([leaf])).toBe(false);
    feedback.dispose(); new ResourcePool().ownTree(scene).dispose();
  });

  it.each([false, true])('uses per-copy transforms for moving and static boxes (moving instances=%s)', movingInstances => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), material = new THREE.MeshBasicMaterial(); scene.add(pivot);
    const copies = new THREE.InstancedMesh(new THREE.BoxGeometry(.3, .06, .05), material, 2);
    copies.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, 0));
    copies.setMatrixAt(1, new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0, 1, 0));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, .02), material); panel.position.set(.01, 1.1, 0);
    pivot.add(movingInstances ? copies : panel); scene.add(movingInstances ? panel : copies);
    scene.position.set(.4, .2, -.8); scene.rotation.y = .35; scene.scale.set(1.5, .8, .7); scene.updateMatrixWorld(true);
    const feedback = new CollisionFeedback(), moving = movingInstances ? copies : panel, obstacle = movingInstances ? panel : copies;
    expect(feedback.intersects(moving, obstacle)).toBe(true);
    expect(feedback.prepare(pivot, [copies, panel]).intersects([moving])).toBe(true);
    panel.position.set(0, 0, 0); scene.updateMatrixWorld(true);
    expect(feedback.intersects(moving, obstacle)).toBe(false);
    expect(feedback.prepare(pivot, [copies, panel]).intersects([moving])).toBe(false);
    copies.count = 0;
    expect(feedback.prepare(pivot, [copies, panel]).intersects([moving])).toBe(false);
    feedback.dispose(); new ResourcePool().ownTree(scene).dispose();
  });

  it('does not turn a hidden moving handle or its hidden parent into a phantom collision', () => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), material = new THREE.MeshBasicMaterial(); scene.add(pivot);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.02, .1, .04), material), obstacle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    pivot.add(handle); scene.add(obstacle); scene.updateMatrixWorld(true);
    const feedback = new CollisionFeedback(), query = feedback.prepare(pivot, [handle, obstacle]);
    handle.visible = false; expect(query.intersects([handle])).toBe(false);
    handle.visible = true; pivot.visible = false; expect(query.intersects([handle])).toBe(false);
    pivot.visible = true; expect(query.intersects([handle])).toBe(true); feedback.dispose();
  });
  it('keeps 2,000 distant meshes out of exact tests across 90 poses', () => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), material = new THREE.MeshBasicMaterial(); scene.add(pivot);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.6, 1, .02), material); leaf.position.x = .3; pivot.add(leaf);
    const obstacles = Array.from({ length: 2000 }, (_, i) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), material); mesh.position.set(10 + i, 0, 10); scene.add(mesh); return mesh;
    });
    scene.updateMatrixWorld(true);
    const feedback = new CollisionFeedback(), exact = vi.spyOn(feedback, 'intersects'), query = feedback.prepare(pivot, [leaf, ...obstacles]);
    for (let i = 0; i < 90; i++) { pivot.rotation.y = i * Math.PI / 180; pivot.updateMatrixWorld(true); expect(query.intersects([leaf])).toBe(false); }
    expect(exact).not.toHaveBeenCalled(); feedback.dispose();
  });

  it('retains exact contact and rotated/sheared near-obstacle results', () => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), material = new THREE.MeshBasicMaterial(); scene.add(pivot);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.6, 1, .02), material); pivot.add(leaf);
    const obstacle = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), material); scene.add(obstacle);
    const feedback = new CollisionFeedback();
    for (const x of [.1, .35, .4]) for (const angle of [0, .4]) {
      pivot.scale.set(1.5, 1, .7); leaf.rotation.y = angle; obstacle.position.x = x; scene.updateMatrixWorld(true);
      expect(feedback.prepare(pivot, [leaf, obstacle]).intersects([leaf])).toBe(feedback.intersects(leaf, obstacle));
    }
    feedback.dispose();
  });

  it('ignores a hidden ancestor and does not retain bounds across later edits', () => {
    const scene = new THREE.Group(), pivot = new THREE.Group(), hidden = new THREE.Group(), material = new THREE.MeshBasicMaterial(); scene.add(pivot, hidden);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material), obstacle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); pivot.add(leaf); hidden.add(obstacle);
    const feedback = new CollisionFeedback(); hidden.visible = false; scene.updateMatrixWorld(true);
    expect(feedback.prepare(pivot, [leaf, obstacle]).intersects([leaf])).toBe(false);
    hidden.visible = true; scene.updateMatrixWorld(true);
    expect(feedback.prepare(pivot, [leaf, obstacle]).intersects([leaf])).toBe(true);
    obstacle.position.x = 5; scene.updateMatrixWorld(true);
    expect(feedback.prepare(pivot, [leaf, obstacle]).intersects([leaf])).toBe(false); feedback.dispose();
  });
});
