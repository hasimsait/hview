import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AssetBuildContext } from './AssetBuildContext';

/** Woven motifs are geometry so fabric and pattern can be coloured independently, including offline. */
export function buildFoldedTowel(c: AssetBuildContext): void {
  const model = c.definition!.softFurnishing!;
  const fabric = c.coloredMaterial?.(model.color, c.materials.softFabric) ?? c.materials.softFabric;
  const accent = c.coloredMaterial?.(model.accentColor, c.materials.softFabric) ?? c.materials.softFabric;
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.userData = { section, isTextile: true, skipOutline: true };
    mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh); return mesh;
  };
  const pieces: THREE.BufferGeometry[] = [];
  const bar = (x: number, y: number, w: number, h: number) => {
    const geometry = new THREE.PlaneGeometry(w, h); geometry.translate(x, y, 0); pieces.push(geometry);
  };
  const stroke = (x: number, y: number, endX: number, endY: number, thickness = .025) => {
    const geometry = new THREE.PlaneGeometry(Math.hypot(endX - x, endY - y), thickness);
    geometry.rotateZ(Math.atan2(endY - y, endX - x)); geometry.translate((x + endX) / 2, (y + endY) / 2, 0); pieces.push(geometry);
  };
  if (model.style === 'grid') {
    for (let i = 0; i <= 4; i++) { bar(-.48 + i * .24, 0, .02, .98); bar(0, -.48 + i * .24, .98, .02); }
  } else if (model.style === 'checker') {
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) if ((x + y) % 2 === 0) bar(-.4 + x * .16, -.4 + y * .16, .16, .16);
  } else if (model.style === 'chevron') {
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
      const x = -.46 + col * .23, y = -.4 + row * .18;
      stroke(x, y, x + .115, y + .09, .04); stroke(x + .115, y + .09, x + .23, y, .04);
    }
  } else {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = -.36 + col * .24, y = -.36 + row * .24;
      stroke(x, y - .1, x + .1, y); stroke(x + .1, y, x, y + .1);
      stroke(x, y + .1, x - .1, y); stroke(x - .1, y, x, y - .1);
    }
  }
  const motif = mergeGeometries(pieces)!; pieces.forEach(geometry => geometry.dispose());
  const width = c.w * .98, depth = c.d * .98, layerHeight = c.h * .29;
  const radius = Math.min(.012, layerHeight * .48, width * .05, depth * .05), clearance = Math.min(.0003, c.h * .005);
  const loft = (x: number, z: number) => c.h * .025 * Math.max(0, 1 - (2 * x / width) ** 2) * Math.max(0, 1 - (2 * z / depth) ** 2);
  for (let i = 0; i < 3; i++) {
    const bottom = i * c.h * .34;
    const folded = new RoundedBoxGeometry(width, layerHeight, depth, 3, radius), positions = folded.attributes.position;
    for (let j = 0; j < positions.count; j++) {
      const y = positions.getY(j);
      positions.setY(j, y + loft(positions.getX(j), positions.getZ(j)) * (y / layerHeight + .5));
    }
    folded.computeVertexNormals();
    add(folded, fabric, 'Fabric', 0, bottom + layerHeight / 2, 0);
    // The top and exposed folded edges carry the same motif; keep decorations within the planning envelope.
    const front = motif.clone(); front.scale(width * .86, layerHeight * .38, 1);
    add(front, accent, 'Pattern', 0, bottom + layerHeight / 2, depth / 2 + clearance);
  }
  const top = motif.clone(); top.rotateX(-Math.PI / 2); top.scale(width * .86, 1, depth * .8);
  const positions = top.attributes.position;
  for (let j = 0; j < positions.count; j++) positions.setY(j, loft(positions.getX(j), positions.getZ(j)));
  top.computeVertexNormals();
  add(top, accent, 'Pattern', 0, c.h * .97 + clearance, 0);
  for (const z of [-1, 1]) {
    const hem = new THREE.PlaneGeometry(width * .86, depth * .018, 16, 1); hem.rotateX(-Math.PI / 2); hem.translate(0, 0, z * depth * .44);
    const vertices = hem.attributes.position;
    for (let j = 0; j < vertices.count; j++) vertices.setY(j, loft(vertices.getX(j), vertices.getZ(j)));
    hem.computeVertexNormals(); add(hem, accent, 'Hem', 0, c.h * .97 + clearance, 0);
  }
  motif.dispose();
}
