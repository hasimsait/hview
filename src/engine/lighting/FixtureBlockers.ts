import * as THREE from 'three';
import type { PlanDocument } from '../../domain/model/PlanDocument';

/** Full structural volumes, independent of orbit fading, cutaways and isolation. */
export interface FixtureBlocker {
  x: number; z: number; dx: number; dz: number;
  halfWidth: number; halfDepth: number; bottom: number; top: number;
}

export function fixtureBlockers(plan: PlanDocument, scene: THREE.Object3D): FixtureBlocker[] {
  const boxes: FixtureBlocker[] = [];
  const openingIds = new Set(plan.walls.flatMap(wall => wall.openings.map(opening => opening.id)));
  for (const wall of plan.walls) {
    const length = wall.length;
    if (length < .001) continue;
    const dx = (wall.p2.x - wall.p1.x) / length, dz = (wall.p2.y - wall.p1.y) / length;
    const start = -(wall.startOffset ?? 0), end = length + (wall.endOffset ?? 0);
    const openings = wall.openings.map(o => ({ left: Math.max(start, o.distanceAlongWall - o.width / 2), right: Math.min(end, o.distanceAlongWall + o.width / 2), bottom: o.floorHeight, top: Math.min(wall.height, o.floorHeight + o.height) }))
      .filter(o => o.right > o.left && o.top > o.bottom);
    const cuts = [...new Set([start, end, ...openings.flatMap(o => [o.left, o.right])])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const left = cuts[i - 1], right = cuts[i], middle = (left + right) / 2;
      const gaps = openings.filter(o => middle > o.left && middle < o.right).sort((a, b) => a.bottom - b.bottom);
      let bottom = 0;
      const add = (top: number) => {
        if (top > bottom + .001 && right > left + .001) boxes.push({ x: wall.p1.x + dx * middle, z: wall.p1.y + dz * middle, dx, dz, halfWidth: (right - left) / 2, halfDepth: wall.thickness / 2, bottom, top });
      };
      for (const gap of gaps) { add(Math.min(wall.height, gap.bottom)); bottom = Math.max(bottom, gap.top); }
      add(wall.height);
    }
  }
  for (const column of plan.columns) boxes.push({ x: column.worldPos.x, z: column.worldPos.z, dx: Math.cos(column.rotationY), dz: -Math.sin(column.rotationY), halfWidth: column.width / 2, halfDepth: column.depth / 2, bottom: column.worldPos.y, top: column.worldPos.y + (column.height ?? plan.totalHeight) });
  // Actual leaf transforms retain partially open hinged and sliding door gaps.
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.userData.isSwingLeaf) return;
    let host = object.parent;
    while (host && !openingIds.has(host.userData.id ?? host.userData.openingId)) host = host.parent;
    if (!host) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(m => m.visible === false || m instanceof THREE.MeshPhysicalMaterial && m.transmission > 0)) return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox!;
    const center = bounds.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld), size = bounds.getSize(new THREE.Vector3());
    const x = new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 0), y = new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 1), z = new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, 2);
    const scale = x.length(); if (scale < .0001) return;
    boxes.push({ x: center.x, z: center.z, dx: x.x / scale, dz: x.z / scale, halfWidth: size.x * scale / 2, halfDepth: size.z * z.length() / 2, bottom: center.y - size.y * y.length() / 2, top: center.y + size.y * y.length() / 2 });
  });
  return boxes;
}

export function blockerTexture(boxes: readonly FixtureBlocker[]): THREE.DataTexture {
  const data = new Float32Array(Math.max(1, boxes.length) * 12);
  boxes.forEach((b, i) => {
    const x = Math.abs(b.dx) * b.halfWidth + Math.abs(b.dz) * b.halfDepth;
    const z = Math.abs(b.dz) * b.halfWidth + Math.abs(b.dx) * b.halfDepth;
    data.set([b.x - x, b.z - z, b.x + x, b.z + z, b.x, b.z, b.dx, b.dz, b.halfWidth, b.halfDepth, b.bottom, b.top], i * 12);
  });
  const texture = new THREE.DataTexture(data, 3, Math.max(1, boxes.length), THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}
