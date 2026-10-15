import * as THREE from 'three';

/** Stepped cove profile, extruded along the width, with its bottom at y=0. */
export function corniceGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(0, height);
  profile.lineTo(depth, height);
  profile.lineTo(depth, height * 0.91);
  profile.lineTo(depth * 0.94, height * 0.91);
  profile.quadraticCurveTo(depth * 0.94, height * 0.74, depth * 0.77, height * 0.73);
  profile.lineTo(depth * 0.77, height * 0.67);
  profile.bezierCurveTo(depth * 0.43, height * 0.64, depth * 0.24, height * 0.38, depth * 0.22, height * 0.2);
  profile.lineTo(depth * 0.13, height * 0.2);
  profile.quadraticCurveTo(depth * 0.13, height * 0.07, depth * 0.05, height * 0.07);
  profile.lineTo(depth * 0.05, 0);
  profile.closePath();
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: width, bevelEnabled: false, curveSegments: 12 });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, -depth / 2);
  return geometry;
}
