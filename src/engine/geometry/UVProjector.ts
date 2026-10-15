import * as THREE from 'three';
export function ensureLocalMetricBounds(mesh: THREE.Mesh): void {
  const geom = mesh.geometry;
  if (!geom) return;

  // Always preserve original normalized UVs before modifying, if not saved yet
  if (!geom.userData.__originalUvs && geom.attributes.uv) {
    geom.userData.__originalUvs = geom.attributes.uv.clone();
  }

  if (geom.userData?.__metricUvApplied) return;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const min = geom.boundingBox?.min;
  const max = geom.boundingBox?.max;
  if (!min || !max || !geom.attributes.position || !geom.attributes.normal || !geom.attributes.uv) return;

  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = uv.count;

  for (let i = 0; i < count; i++) {
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);

    if (ny >= 0.707) {
      // Top or bottom face (e.g. countertop surface) — anchor to corner (0, 0)
      uv.setXY(i, px - min.x, pz - min.z);
    } else if (nz >= 0.707) {
      // Front or back face — anchor to bottom-left corner (0, 0)
      uv.setXY(i, px - min.x, py - min.y);
    } else {
      // Side face — anchor to bottom-front corner (0, 0)
      uv.setXY(i, pz - min.z, py - min.y);
    }
  }
  uv.needsUpdate = true;
  geom.userData.__metricUvApplied = true;
  geom.userData.__stretchedUvApplied = false;

  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = min.x;
    arr[i * 3 + 1] = min.y;
    arr[i * 3 + 2] = min.z;
  }
  geom.setAttribute('localMetricOffset', new THREE.BufferAttribute(arr, 3));
}

export function ensureStretchedUvs(mesh: THREE.Mesh): void {
  const geom = mesh.geometry;
  if (!geom) return;
  if (!geom.attributes.uv || !geom.attributes.position || !geom.attributes.normal) return;

  // 1. If original normalized [0, 1] UVs were saved (e.g. standard Three.js BoxGeometry), restore them
  if (geom.userData?.__originalUvs) {
    geom.setAttribute('uv', geom.userData.__originalUvs.clone());
    geom.userData.__metricUvApplied = false;
    geom.userData.__stretchedUvApplied = true;
    return;
  }

  // 2. Otherwise compute normalized bounding-box UVs [0, 1] across each face to stretch edge-to-edge
  if (!geom.boundingBox) geom.computeBoundingBox();
  const min = geom.boundingBox?.min;
  const max = geom.boundingBox?.max;
  if (!min || !max) return;

  const uv = geom.attributes.uv;
  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const count = uv.count;

  const dx = Math.max(0.0001, max.x - min.x);
  const dy = Math.max(0.0001, max.y - min.y);
  const dz = Math.max(0.0001, max.z - min.z);

  for (let i = 0; i < count; i++) {
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);

    if (ny >= 0.707) {
      // Top or bottom face — stretched from 0 to 1 across (X, Z)
      uv.setXY(i, (px - min.x) / dx, (pz - min.z) / dz);
    } else if (nz >= 0.707) {
      // Front or back face — stretched from 0 to 1 across (X, Y)
      uv.setXY(i, (px - min.x) / dx, (py - min.y) / dy);
    } else {
      // Side face — stretched from 0 to 1 across (Z, Y)
      uv.setXY(i, (pz - min.z) / dz, (py - min.y) / dy);
    }
  }
  uv.needsUpdate = true;
  geom.userData.__metricUvApplied = false;
  geom.userData.__stretchedUvApplied = true;
}
