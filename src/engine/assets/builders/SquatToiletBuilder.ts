import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetBuildContext } from './AssetBuildContext';

function roundedRectangle(width: number, depth: number, radius: number): THREE.Shape {
  const x = width / 2, z = depth / 2, shape = new THREE.Shape();
  shape.moveTo(-x + radius, -z); shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius); shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z); shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius); shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z); shape.closePath();
  return shape;
}

export function buildSquatToilet(c: AssetBuildContext): void {
  const { w, h, d, materials: m } = c;
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, smooth = false) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `squat_${section.toLowerCase().replace(/ /g, '_')}_${c.entity.id}`;
    mesh.userData.section = section; mesh.userData.skipOutline = smooth;
    mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh); return mesh;
  };
  const extrude = (shape: THREE.Shape, height: number, bottom: number) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 12 });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0); return geometry;
  };
  const rimX = w * .22, rimZ = d * .34, centerZ = -d * .02;
  const drainX = w * .07, drainZ = d * .075, drainCenter = -d * .12;
  const pan = roundedRectangle(w, d, Math.min(w, d) * .1), opening = new THREE.Path();
  opening.absellipse(0, -centerZ, rimX, rimZ, 0, Math.PI * 2, true, 0);
  pan.holes.push(opening);
  add(extrude(pan, h * .82, 0), m.ceramicWhite, 'Pan');

  // A curved annular surface slopes into the drain; the opening has no top cap.
  const segments = 48, rings = 10, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let ring = 0; ring <= rings + 1; ring++) {
    const t = Math.min(1, ring / rings), rx = THREE.MathUtils.lerp(rimX, drainX, t), rz = THREE.MathUtils.lerp(rimZ, drainZ, t);
    const z = THREE.MathUtils.lerp(centerZ, drainCenter, t), y = ring > rings ? h * .04 : h * (.82 - .7 * Math.sin(t * Math.PI / 2));
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const x = rx * Math.cos(angle), depth = z + rz * Math.sin(angle);
      positions.push(x, y, depth); uvs.push(x / w + .5, depth / d + .5);
    }
  }
  for (let ring = 0; ring <= rings; ring++) for (let i = 0; i < segments; i++) {
    const a = ring * segments + i, b = ring * segments + (i + 1) % segments;
    indices.push(a, a + segments, b, b, a + segments, b + segments);
  }
  const bowl = new THREE.BufferGeometry();
  bowl.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bowl.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); bowl.setIndex(indices); bowl.computeVertexNormals();
  add(bowl, m.ceramicWhite, 'Bowl', true);
  const drain = new THREE.CircleGeometry(1, 32);
  drain.rotateX(-Math.PI / 2); drain.scale(drainX, 1, drainZ); drain.translate(0, h * .04, drainCenter);
  add(drain, m.glassBlack, 'Drain', true);

  const pads: THREE.BufferGeometry[] = [], treads: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    pads.push(extrude(roundedRectangle(w * .23, d * .56, w * .045), h * .13, h * .82).translate(side * w * .34, 0, 0));
    for (let i = 0; i < 9; i++) {
      treads.push(new THREE.BoxGeometry(w * .17, h * .05, d * .008).translate(side * w * .34, h * .975, d * (-.21 + i * .0525)));
    }
  }
  add(mergeGeometries(pads)!, m.ceramicWhite, 'Footplates');
  add(mergeGeometries(treads)!, m.ceramicWhite, 'Footplate Treads', true);
  for (const geometry of [...pads, ...treads]) geometry.dispose();
  const inlet = new THREE.BoxGeometry(w * .3, h * .08, d * .09);
  inlet.translate(0, h * .86, -d * .42); add(inlet, m.ceramicWhite, 'Flush Inlet');
  const port = new THREE.CircleGeometry(Math.min(w * .025, h * .04), 24);
  port.translate(0, h * .86, -d * .374); add(port, m.glassBlack, 'Flush Port', true);
}
