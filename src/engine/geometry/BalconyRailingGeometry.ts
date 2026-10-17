import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BalconyRailingConfig, RailingRun } from '../../domain/model/BalconyRailing';

/** A continuous handrail, lower rail and vertical bars. Shared open corners get one post. */
export function buildBalconyRailing(roomId: string, config: BalconyRailingConfig, runs: readonly RailingRun[]): THREE.Group {
  const group = new THREE.Group(); group.name = `balcony_railing_${roomId}`;
  const parts: THREE.BufferGeometry[] = [], posts = new Set<string>(), height = config.height;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, angle = 0) => {
    const geometry = new THREE.BoxGeometry(w, h, d); geometry.rotateY(angle); geometry.translate(x, y, z); parts.push(geometry);
  };
  for (const run of runs) {
    const dx = run.end.x - run.start.x, dz = run.end.y - run.start.y, length = Math.hypot(dx, dz), angle = -Math.atan2(dz, dx);
    if (length < .08) continue;
    const x = (run.start.x + run.end.x) / 2, z = (run.start.y + run.end.y) / 2;
    box(length, .05, .05, x, height - .025, z, angle);
    box(length, .03, .03, x, .135, z, angle);
    const start = run.startAtWall ? .02 : 0, end = length - (run.endAtWall ? .02 : 0), count = Math.max(1, Math.ceil((end - start) / 1.1));
    for (let i = 0; i <= count; i++) {
      const distance = start + (end - start) * i / count, px = run.start.x + dx * distance / length, pz = run.start.y + dz * distance / length;
      const key = `${Math.round(px * 1000)},${Math.round(pz * 1000)}`;
      if (posts.has(key)) continue;
      posts.add(key); box(.04, height - .05, .04, px, (height - .05) / 2, pz, angle);
    }
    const bars = Math.max(1, Math.ceil((length - .04) / .11));
    for (let i = 1; i < bars; i++) {
      const distance = .02 + (length - .04) * i / bars;
      const nearPost = (distance - start) / (end - start) * count;
      if (Math.abs(nearPost - Math.round(nearPost)) * (end - start) / count < .035) continue;
      box(.012, height - .2, .012, run.start.x + dx * distance / length, .15 + (height - .2) / 2, run.start.y + dz * distance / length, angle);
    }
  }
  if (parts.length) {
    const geometry = mergeGeometries(parts)!;
    const material = new THREE.MeshStandardMaterial({ color: config.color, roughness: .65, metalness: .45 });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `railing_bars_${roomId}`;
    mesh.userData = { type: 'floor', roomId, section: 'Railing', railingRuns: runs, postCount: posts.size };
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    parts.forEach(part => part.dispose());
  }
  return group;
}
