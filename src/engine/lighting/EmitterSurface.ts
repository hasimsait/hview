import * as THREE from 'three';

const areas = new WeakMap<THREE.Mesh, {
  geometry: THREE.BufferGeometry; position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  positionVersion: number; index: THREE.BufferAttribute | null; indexVersion?: number; start: number; count: number;
  transform: number[]; area: number;
}>();

/** Emitting surface area in square metres, including nonuniform fixture scaling.
 * Cache by geometry and linear world transform; moving a fixture changes no area.
 */
export function emitterSurfaceArea(mesh: THREE.Mesh): number {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index;
  if (!position) return 0;
  const transform = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  const positionVersion = 'data' in position ? position.data.version : position.version;
  const { start, count } = geometry.drawRange, cached = areas.get(mesh);
  if (cached?.geometry === geometry && cached.position === position && cached.positionVersion === positionVersion &&
      cached.index === index && cached.indexVersion === index?.version && cached.start === start && cached.count === count &&
      cached.transform.every((value, i) => value === transform.elements[i])) return cached.area;

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const end = Math.min(index?.count ?? position.count, start + count);
  let area = 0;
  for (let i = start; i + 2 < end; i += 3) {
    a.fromBufferAttribute(position, index ? index.getX(i) : i);
    b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).sub(a).applyMatrix3(transform);
    c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).sub(a).applyMatrix3(transform);
    area += b.cross(c).length() / 2;
  }
  areas.set(mesh, { geometry, position, positionVersion, index, indexVersion: index?.version, start, count, transform: [...transform.elements], area });
  return area;
}
