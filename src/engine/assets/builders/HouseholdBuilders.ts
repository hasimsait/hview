import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetBuildContext } from './AssetBuildContext';

function parts(c: AssetBuildContext) {
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${section.toLowerCase().replace(/ /g, '_')}_${c.entity.id}`;
    mesh.position.set(x, y, z); mesh.userData.section = section;
    mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh); return mesh;
  };
  const cylinder = (r: number, height: number, mat: THREE.Material, section: string, x: number, y: number, z: number) =>
    add(new THREE.CylinderGeometry(r, r, height, 64), mat, section, x, y, z);
  const box = (w: number, h: number, d: number, mat: THREE.Material, section: string, x: number, y: number, z: number) =>
    add(new THREE.BoxGeometry(w, h, d), mat, section, x, y, z);
  return { add, cylinder, box };
}

export function buildRobotVacuum(c: AssetBuildContext): void {
  const { w, h, d, materials: m } = c, { cylinder, box } = parts(c);
  const radius = Math.min(w * .49, d * .375), z = d * .12;
  cylinder(radius, h * .6, m.whitePaint, 'Body', 0, h * .32, z);
  cylinder(radius * 1.005, h * .14, m.metalBlack, 'Bumper', 0, h * .29, z);
  cylinder(radius * .93, h * .04, m.whitePaint, 'Top Cover', 0, h * .64, z);
  cylinder(radius * .2, h * .14, m.metalBlack, 'Navigation Sensor', 0, h * .73, z - radius * .25);
  cylinder(radius * .17, h * .025, m.whitePaint, 'Navigation Sensor', 0, h * .8125, z - radius * .25);
  for (const x of [-w * .04, w * .04]) cylinder(w * .012, h * .012, m.metalBlack, 'Controls', x, h * .67, z + radius * .35);
  // The rear dock and its low charging ramp are part of the same editable asset.
  box(w * .62, h * .975, d * .17, m.whitePaint, 'Dock', 0, h * .5125, -d * .405);
  box(w * .55, h * .15, d * .018, m.metalBlack, 'Dock Sensor', 0, h * .43, -d * .311);
  box(w * .65, h * .025, d * .3, m.metalBlack, 'Dock Base', 0, h * .0125, -d * .345);
  for (const x of [-w * .11, w * .11]) box(w * .055, h * .035, d * .07, m.metalChrome, 'Charging Contacts', x, h * .043, -d * .22);
  box(w * .07, h * .018, d * .008, m.ledGlow, 'Status Light', 0, h * .82, -d * .315);
}

export function buildAirPurifier(c: AssetBuildContext): void {
  const { w, h, d, materials: m } = c, { add, cylinder, box } = parts(c);
  const radius = Math.min(w, d) * .49;
  cylinder(radius * .93, h * .04, m.metalBlack, 'Base', 0, h * .02, 0);
  cylinder(radius, h * .9, m.whitePaint, 'Housing', 0, h * .49, 0);
  // Hundreds of intake perforations share one draw call and remain paintable.
  const rows = 12, columns = 48, holeRadius = radius * .018;
  const perforations: THREE.BufferGeometry[] = [];
  const transform = new THREE.Object3D();
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const theta = col / columns * Math.PI * 2;
    transform.position.set(Math.cos(theta) * (radius + .00015), h * (.1 + row * .04), Math.sin(theta) * (radius + .00015));
    transform.lookAt(transform.position.x * 2, transform.position.y, transform.position.z * 2);
    transform.updateMatrix();
    perforations.push(new THREE.CircleGeometry(holeRadius, 8).applyMatrix4(transform.matrix));
  }
  const intakeGeometry = mergeGeometries(perforations)!;
  for (const geometry of perforations) geometry.dispose();
  const holes = add(intakeGeometry, m.metalBlack, 'Air Intake');
  holes.name = `air_intake_${c.entity.id}`; holes.userData.skipOutline = true;
  cylinder(radius * .98, h * .025, m.whitePaint, 'Top Rim', 0, h * .9525, 0);
  cylinder(radius * .84, h * .015, m.metalBlack, 'Air Outlet', 0, h * .9725, 0);
  for (let i = 1; i <= 9; i++) {
    const geometry = new THREE.TorusGeometry(radius * .08 * i, radius * .009, 6, 48); geometry.rotateX(Math.PI / 2);
    const ring = add(geometry, m.whitePaint, 'Outlet Grille', 0, h * .982, 0); ring.userData.skipOutline = true;
  }
  box(radius * .5, h * .015, radius * .16, m.metalBlack, 'Control Panel', 0, h * .9925, -radius * .65);
  cylinder(radius * .035, h * .006, m.ledGlow, 'Status Light', 0, h * .995, -radius * .65);
}
