import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { mergeStaticParts } from '../../src/engine/geometry/MergeStaticParts';

describe('static pieces of one editable part', () => {
  it('preserves dimensions, real openings, tags and material while disposing replaced geometry', () => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const bars = [-.2, .2].map(x => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(.04, .5, .04), material); mesh.position.x = x;
      mesh.userData = { section: 'Laundry Basket', cabinetPart: 'door_0', isSwingCollider: true }; root.add(mesh); return mesh;
    });
    const bounds = new THREE.Box3().setFromObject(root), disposed = bars.map(mesh => vi.spyOn(mesh.geometry, 'dispose'));
    mergeStaticParts(bars); root.updateMatrixWorld(true);
    expect(root.children).toHaveLength(1);
    const mergedBounds = new THREE.Box3().setFromObject(root);
    expect(mergedBounds.min.distanceTo(bounds.min)).toBeLessThan(1e-7); expect(mergedBounds.max.distanceTo(bounds.max)).toBeLessThan(1e-7);
    const mesh = root.children[0] as THREE.Mesh; expect(mesh.userData).toEqual(bars[0].userData); expect(mesh.material).toBe(material);
    const ray = (x: number) => new THREE.Raycaster(new THREE.Vector3(x, 0, 1), new THREE.Vector3(0, 0, -1)).intersectObject(root, true);
    expect(ray(0)).toHaveLength(0); expect(ray(.2).length).toBeGreaterThan(0);
    disposed.forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });
  it('keeps different materials, editable sections and moving parents separate', () => {
    const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot);
    const material = new THREE.MeshBasicMaterial();
    const parts = [root, root, pivot, root].map((parent, i) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), i === 3 ? material.clone() : material); mesh.userData.section = i ? 'Second' : 'First'; parent.add(mesh); return mesh; });
    mergeStaticParts(parts); expect(parts.every(part => part.parent)).toBe(true);
  });
});
