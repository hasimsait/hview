import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Construction-only pieces of one editable part; moving pivots stay separate. */
export function mergeStaticParts(parts: readonly THREE.Mesh[]): void {
  const groups = new Map<string, THREE.Mesh[]>();
  for (const part of parts) {
    if (Array.isArray(part.material) || !part.parent || part.children.length) continue;
    const key = `${part.parent.uuid}:${part.material.uuid}:${part.userData.section}:${part.geometry.index ? 'indexed' : 'nonindexed'}`;
    const group = groups.get(key) ?? []; group.push(part); groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0], parent = first.parent!;
    const geometries = group.map(part => { part.updateMatrix(); return part.geometry.clone().applyMatrix4(part.matrix); });
    const geometry = mergeGeometries(geometries);
    geometries.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, first.material);
    mesh.userData = { ...first.userData }; mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    for (const part of group) { parent.remove(part); part.geometry.dispose(); }
    parent.add(mesh);
  }
}
