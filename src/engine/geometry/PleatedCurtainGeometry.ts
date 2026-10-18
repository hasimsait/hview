import * as THREE from 'three';

/** Rounded, gently wandering folds with a fixed depth envelope and a subtly uneven hem. */
export function pleatedCurtainGeometry(width: number, drop: number, amplitude: number, folds: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, drop, Math.max(48, folds * 12), 24), positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const across = positions.getX(i) / width + .5, down = .5 - positions.getY(i) / drop;
    const phase = across * Math.PI * folds * 2 + down * .22 + Math.sin(down * Math.PI) * .12;
    const wave = (Math.sin(phase) + .12 * Math.sin(phase * 2)) / 1.12;
    positions.setZ(i, wave * amplitude * (.82 + down * .18));
    positions.setX(i, positions.getX(i) + width * .008 * Math.sin(across * Math.PI * 2) * Math.sin(down * Math.PI));
    positions.setY(i, positions.getY(i) + Math.min(.006, drop * .004) * Math.sin(across * Math.PI) ** 2 * down ** 12);
  }
  geometry.computeVertexNormals(); return geometry;
}
