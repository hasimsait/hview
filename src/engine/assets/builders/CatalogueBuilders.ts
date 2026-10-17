import * as THREE from 'three';
import { Shelving } from '../../../domain/elements/Furniture';
import { corniceGeometry } from '../../geometry/CorniceGeometry';
import type { AssetBuildContext, AssetBuilderFn } from './AssetBuildContext';
import { bookcaseMaterials } from './BookcaseMaterials';

/** Model coordinates are fractions of the published width, height and depth. */
function parts(c: AssetBuildContext) {
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * c.w, y * c.h, z * c.d);
    mesh.userData.section = section;
    mesh.castShadow = mesh.receiveShadow = true;
    c.parent.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, section: string) =>
    add(new THREE.BoxGeometry(w * c.w, h * c.h, d * c.d), material, section, x, y, z);
  const cylinder = (x: number, y: number, z: number, radius: number, height: number, material: THREE.Material, section: string) =>
    add(new THREE.CylinderGeometry(radius, radius, height, 32), material, section, x, y, z);
  return { add, box, cylinder };
}

export const buildSoapDispenser: AssetBuilderFn = c => {
  const { cylinder, box } = parts(c), m = c.materials;
  cylinder(0, .35, 0, Math.min(c.w, c.d) / 2, c.h * .7, m.glassBlack, 'Body');
  cylinder(0, .79, 0, c.w * .14, c.h * .18, m.metalChrome, 'Pump');
  box(0, .94, .12, .3, .12, .68, m.metalChrome, 'Pump');
  box(0, .89, .42, .18, .12, .12, m.metalChrome, 'Nozzle');
};

function bowl(c: AssetBuildContext, shallow: boolean) {
  const { add, cylinder } = parts(c), r = Math.min(c.w, c.d) / 2, h = c.h;
  const points = [new THREE.Vector2(0, 0), new THREE.Vector2(r * .8, 0), new THREE.Vector2(r, h * .86),
    new THREE.Vector2(r, h), new THREE.Vector2(r * .89, h), new THREE.Vector2(r * (shallow ? .62 : .75), h * .15), new THREE.Vector2(0, h * .15)];
  add(new THREE.LatheGeometry(points, 40), c.materials.whitePaint, 'Body', 0, 0, 0);
  cylinder(0, .07, 0, r * .83, h * .1, c.materials.metalChrome, 'Trim');
}
export const buildTumbler: AssetBuilderFn = c => bowl(c, false);
export const buildSoapDish: AssetBuilderFn = c => bowl(c, true);

export const buildPedalBin: AssetBuilderFn = c => {
  const { cylinder, box } = parts(c), m = c.materials, r = Math.min(c.w, c.d) * .5;
  cylinder(0, .46, 0, r, c.h * .92, m.metalBlack, 'Body');
  cylinder(0, .96, 0, r, c.h * .08, m.glassBlack, 'Lid');
  box(0, .06, .4, .32, .055, .2, m.metalChrome, 'Pedal');
};
export const buildBrushSet: AssetBuilderFn = c => {
  const { cylinder } = parts(c), m = c.materials;
  cylinder(0, .25, 0, Math.min(c.w, c.d) / 2, c.h * .5, m.plasticBeige, 'Holder');
  cylinder(0, .75, 0, Math.min(c.w, c.d) * .055, c.h * .5, m.metalChrome, 'Handle');
  cylinder(0, .51, 0, Math.min(c.w, c.d) * .46, c.h * .025, m.plasticBeige, 'Lid');
};
export const buildPaperTowelHolder: AssetBuilderFn = c => {
  const { box, add } = parts(c), m = c.materials;
  box(0, .96, -.25, .95, .08, .5, m.metalBlack, 'Bracket');
  box(-.46, .53, 0, .06, .88, .1, m.metalBlack, 'Bracket');
  const roll = new THREE.CylinderGeometry(c.h * .39, c.h * .39, c.w * .86, 32);
  roll.rotateZ(Math.PI / 2);
  add(roll, m.whitePaint, 'Paper Roll', 0, .4, .05);
  box(0, .4, .05, 1, .08, .08, m.metalBlack, 'Spindle');
};

export const buildAngledHood: AssetBuilderFn = c => {
  const { box } = parts(c), m = c.materials;
  box(0, .67, -.35, .27, .66, .27, m.metalBlack, 'Chimney');
  box(0, .11, -.04, .82, .22, .82, m.metalBlack, 'Extractor');
  const canopy = box(0, .3, .04, 1, .38, .08, m.glassBlack, 'Glass Canopy');
  canopy.rotation.x = -.55;
  box(0, .075, .38, .4, .025, .015, m.metalChrome, 'Controls');
};
export const buildGasCooktop: AssetBuilderFn = c => {
  const { box, cylinder, add } = parts(c), m = c.materials;
  box(0, .15, 0, 1, .3, 1, m.glassBlack, 'Glass');
  for (const x of [-.27, .14]) for (const z of [-.25, .25]) {
    const radius = c.w * (x < 0 && z > 0 ? .105 : .086);
    cylinder(x, .43, z, radius, c.h * .24, m.metalChrome, 'Burners');
    cylinder(x, .6, z, radius * .74, c.h * .16, m.metalBlack, 'Burner Caps');
    const ring = new THREE.TorusGeometry(radius * 1.15, c.h * .065, 8, 32);
    ring.rotateX(Math.PI / 2);
    add(ring, m.metalBlack, 'Pan Supports', x, .76, z);
    box(x, .84, z, .27, .12, .025, m.metalBlack, 'Pan Supports');
    box(x, .84, z, .025, .12, .3, m.metalBlack, 'Pan Supports');
  }
  for (let i = 0; i < 4; i++) {
    cylinder(.42, .61, -.3 + i * .2, c.w * .027, c.h * .62, m.metalChrome, 'Controls');
  }
};
export const buildBuiltInOven: AssetBuilderFn = c => {
  const { box, cylinder } = parts(c), m = c.materials;
  box(0, .5, -.475, 1, 1, .05, m.metalBlack, 'Body');
  for (const x of [-.475, .475]) box(x, .5, 0, .05, 1, 1, m.metalBlack, 'Body');
  box(0, .025, 0, 1, .05, 1, m.metalBlack, 'Body');
  box(0, .88, 0, 1, .24, 1, m.glassBlack, 'Control Panel');
  for (const x of [-.41, .41]) box(x, .4, .445, .08, .68, .04, m.glassBlack, 'Door Frame');
  for (const y of [.095, .705]) box(0, y, .445, .9, .07, .04, m.glassBlack, 'Door Frame');
  box(0, .39, .469, .72, .46, .012, m.glass, 'Door Glass');
  for (const y of [.25, .45, .62]) {
    for (let i = 0; i < 8; i++) box(-.31 + i * .088, y, -.02, .008, .007, .75, m.metalChrome, 'Oven Racks');
    box(0, y, .36, .72, .007, .009, m.metalChrome, 'Oven Racks');
  }
  box(0, .7, .475, .78, .035, .05, m.metalChrome, 'Handle');
  box(0, .89, .482, .25, .09, .02, m.screen, 'Display');
  for (const x of [-.33, .33]) {
    const knob = cylinder(x, .89, .478, c.w * .039, c.d * .04, m.metalChrome, 'Controls');
    knob.rotation.x = Math.PI / 2;
  }
};

function bookcase(c: AssetBuildContext, hemnes: boolean) {
  const { box } = parts(c), m = c.materials;
  const { frame, top, back, shelves } = bookcaseMaterials(c)!;
  const foot = hemnes ? .055 : 0;
  for (const x of [-.475, .475]) box(x, .5 + foot / 2, -.02, .05, 1 - foot, .96, frame, 'Frame');
  box(0, .53, -.477, .9, .9, .045, back, 'Back Panel');
  box(0, .9875, 0, 1, .025, 1, top, 'Top');
  box(0, .07, -.08, .9, .08, .76, frame, 'Plinth');
  const count = c.entity instanceof Shelving ? c.entity.shelfCount : 6;
  for (let i = 0; i < count; i++) box(0, .12 + i * .82 / (count - 1), 0, .9, .012, .91, shelves, 'Shelves');
  if (hemnes) {
    for (const x of [-.455, .455]) for (const z of [-.415, .415]) box(x, .49, z, .065, .98, .13, frame, 'Posts');
    box(0, .961, 0, .98, .028, .97, frame, 'Crown');
    box(0, .11, .432, .9, .035, .06, frame, 'Base Trim');
  }
  if (c.entity.hasLids) {
    for (const x of [-.225, .225]) box(x, .53, .475, .442, .84, .03, frame, 'Lids');
    for (const x of [-.04, .04]) box(x, .53, .496, .018, .035, .008, m.metalChrome, 'Handles');
  }
}
export const buildHemnesBookcase: AssetBuilderFn = c => bookcase(c, true);
export const buildBillyBookcase: AssetBuilderFn = c => bookcase(c, false);
export const buildCurtainPelmet: AssetBuilderFn = c => {
  parts(c).add(corniceGeometry(c.w, c.h, c.d), c.materials.whitePaint, 'Cornice', 0, 0, 0);
};
