import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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

export function buildWaterTreatmentUnit(c: AssetBuildContext): void {
  const { w, h, d, materials: m } = c, { add } = parts(c);
  const rounded = (width: number, height: number, depth: number, radius: number, material: THREE.Material, section: string, x: number, y: number, z: number) =>
    add(new RoundedBoxGeometry(width, height, depth, 3, radius), material, section, x, y, z);
  rounded(w, h * .77, d * .98, Math.min(w, d) * .12, m.whitePaint, 'Cabinet', 0, h * .385, 0);
  rounded(w * .99, h * .3, d * .988, Math.min(w, d) * .1, m.metalBlack, 'Hood', 0, h * .85, -d * .006);
  rounded(w * .96, h * .035, d * .95, Math.min(w, d) * .04, m.glassBlack, 'Lid', 0, h * .9825, 0);
  // Shallow ribs sit over the hood face without enlarging the reference footprint.
  for (let i = 0; i < 4; i++) {
    rounded(w * .85, h * .016, d * .016, h * .006, m.glassBlack, 'Hood Louvers', 0, h * (.755 + i * .05), d * .492);
  }
  const recess = c.coloredMaterial?.('#d4d5d1', m.whitePaint) ?? m.plasticBeige;
  rounded(w * .16, h * .11, d * .012, w * .025, recess, 'Handle Recess', -w * .27, h * .565, d * .493);
  rounded(w * .14, h * .022, d * .018, h * .008, m.whitePaint, 'Handle', -w * .27, h * .605, d * .491);
  rounded(w * .09, h * .115, d * .012, w * .01, m.metalBlack, 'Badge', w * .21, h * .57, d * .494);
}

export function buildStorageWaterHeater(c: AssetBuildContext): void {
  const { w, h, d, materials: m } = c, { add, box, cylinder } = parts(c);
  const profile = [new THREE.Vector2(0, h * .07), new THREE.Vector2(w * .39, h * .07)];
  // Rounded end caps flow into a vertical cylindrical enamel tank.
  for (let i = 1; i <= 8; i++) {
    const angle = i / 8 * Math.PI / 2;
    profile.push(new THREE.Vector2(w * (.39 + .11 * Math.sin(angle)), h * (.16 - .09 * Math.cos(angle))));
  }
  profile.push(new THREE.Vector2(w * .5, h * .91));
  for (let i = 1; i <= 8; i++) {
    const angle = i / 8 * Math.PI / 2;
    profile.push(new THREE.Vector2(w * (.39 + .11 * Math.cos(angle)), h * (.91 + .09 * Math.sin(angle))));
  }
  profile.push(new THREE.Vector2(0, h));
  const tank = new THREE.LatheGeometry(profile, 48);
  tank.scale(1, 1, d * .97 / w);
  add(tank, m.whitePaint, 'Tank');
  box(w * .48, h * .04, d * .03, m.metalChrome, 'Wall Brackets', 0, h * .3, -d * .485);
  box(w * .48, h * .04, d * .03, m.metalChrome, 'Wall Brackets', 0, h * .8, -d * .485);
  add(new RoundedBoxGeometry(w * .29, h * .1, d * .016, 3, h * .012), m.metalBlack, 'Control Panel', 0, h * .22, d * .489);
  const display = c.coloredMaterial?.('#6998ab', m.whitePaint) ?? m.glassBlack;
  box(w * .12, h * .032, d * .004, display, 'Display', -w * .035, h * .23, d * .498);
  const button = add(new THREE.CircleGeometry(w * .014, 16), m.whitePaint, 'Controls', w * .092, h * .22, d * .5);
  button.userData.skipOutline = true;
  box(w * .26, h * .028, d * .012, m.metalChrome, 'Badge', 0, h * .7, d * .49);
  for (const [x, color] of [[-w * .1, '#387bb6'], [w * .1, '#bc4540']] as const) {
    cylinder(w * .025, h * .055, m.metalChrome, 'Water Connections', x, h * .0275, 0);
    const collar = c.coloredMaterial?.(color, m.whitePaint) ?? m.plasticBeige;
    cylinder(w * .032, h * .035, collar, 'Connection Collars', x, h * .0675, 0);
  }
}
