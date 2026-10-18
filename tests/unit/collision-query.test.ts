import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CollisionFeedback } from '../../src/engine/cabinet/CollisionFeedback';

describe('motion collision broad phase', () => {
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
