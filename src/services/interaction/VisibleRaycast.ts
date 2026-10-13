import { Object3D, Raycaster } from 'three';

function isVisibleInScene(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

// Three.js raycasting includes hidden objects. A hidden mesh or any hidden
// ancestor must neither become selected nor intercept a visible object behind it.
export function intersectVisibleObjects(raycaster: Raycaster, roots: Object3D[]) {
  return raycaster.intersectObjects(roots.filter(isVisibleInScene), true)
    .filter(hit => isVisibleInScene(hit.object));
}
