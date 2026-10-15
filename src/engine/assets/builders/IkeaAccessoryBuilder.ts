import * as THREE from 'three';
import type { AccessoryKind } from '../../../domain/catalog/AccessoryModel';
import type { AssetBuildContext } from './AssetBuildContext';

/** Geometry is designed in a unit box then baked into metric coordinates. */
function parts(c: AssetBuildContext) {
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    geometry.scale(c.w, c.h, c.d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * c.w, y * c.h, z * c.d);
    mesh.userData.section = section;
    mesh.castShadow = mesh.receiveShadow = true;
    c.parent.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, section: string) =>
    add(new THREE.BoxGeometry(w, h, d), mat, section, x, y, z);
  const cylinder = (x: number, y: number, z: number, r: number, h: number, mat: THREE.Material, section: string, top = r) =>
    add(new THREE.CylinderGeometry(top, r, h, 32), mat, section, x, y, z);
  const lathe = (profile: [number, number][], mat: THREE.Material, section: string, x = 0, y = 0, z = 0) =>
    add(new THREE.LatheGeometry(profile.map(([r, height]) => new THREE.Vector2(r, height)), 40), mat, section, x, y, z);
  const ring = (radius: number, tube: number, mat: THREE.Material, section: string, x: number, y: number, z: number, upright = false) => {
    const geometry = new THREE.TorusGeometry(radius, tube, 6, 40);
    if (!upright) geometry.rotateX(Math.PI / 2);
    return add(geometry, mat, section, x, y, z);
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, section: string) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    const center = a.clone().add(b).multiplyScalar(.5);
    return add(geometry, mat, section, center.x, center.y, center.z);
  };
  return { add, box, cylinder, lathe, ring, rod };
}
type Parts = ReturnType<typeof parts>;
type Model = NonNullable<AssetBuildContext['definition']>['accessory'];
interface Context { c: AssetBuildContext; p: Parts; model: NonNullable<Model>; body: THREE.Material; accent: THREE.Material; }

function vessel({ p, model, body }: Context, kind: 'vase' | 'pot' | 'cup' | 'dish') {
  const rounded = model.style === 'rounded', bottle = model.style === 'bottle';
  const profile: [number, number][] = kind === 'dish'
    ? [[0, 0], [.38, 0], [.5, .8], [.5, 1], [.45, 1], [.34, .22], [0, .22]]
    : kind === 'pot' || kind === 'cup'
      ? [[0, 0], [.35, 0], [.5, 1], [.45, 1], [.31, .07], [0, .07]]
      : [[0, 0], [.33, 0], [.46, .08], [.5, rounded ? .42 : .55], [rounded ? .3 : .41, .82],
        [bottle ? .14 : rounded ? .25 : .35, 1], [bottle ? .115 : rounded ? .225 : .325, 1], [.29, .08], [0, .08]];
  p.lathe(profile, body, 'Body');
  if (kind === 'pot' && model.style === 'saucer') {
    p.lathe([[0, 0], [.48, 0], [.5, .07], [.47, .07], [.44, .025], [0, .025]], body, 'Saucer');
  }
  if (model.style === 'ribbed') {
    for (let i = 0; i < 24; i++) {
      const theta = i * Math.PI / 12;
      p.rod(new THREE.Vector3(Math.cos(theta) * .37, .08, Math.sin(theta) * .37), new THREE.Vector3(Math.cos(theta) * .45, .82, Math.sin(theta) * .45), .007, body, 'Ribs');
    }
  }
}

function plant({ c, p, model, body, accent }: Context) {
  const potH = Math.min(.28, .2 / c.h), potR = Math.min(.3, .12 / Math.max(c.w, c.d));
  p.cylinder(0, potH / 2, 0, potR * .75, potH, accent, 'Plant Pot', potR);
  p.cylinder(0, potH * .96, 0, potR * .94, .015, c.materials.woodDark, 'Soil');
  const broad = model.style === 'broadleaf', grass = model.style === 'grass', orchid = model.style === 'orchid';
  const branchCount = grass ? 25 : broad ? 7 : orchid ? 3 : 9;
  const leafGeometry = () => {
    const geometry = new THREE.SphereGeometry(1, 8, 5);
    geometry.scale(broad ? .09 : .045, broad ? .18 : .08, .008);
    return geometry;
  };
  for (let i = 0; i < branchCount; i++) {
    const theta = i * 2.399963, reach = grass ? .4 : .32;
    const top = new THREE.Vector3(Math.cos(theta) * reach, .62 + .35 * (i % 4) / 3, Math.sin(theta) * reach);
    p.rod(new THREE.Vector3(0, potH, 0), top, grass ? .006 : .007, body, 'Stems');
    if (grass) continue;
    for (let j = 0; j < (broad ? 1 : 4); j++) {
      const f = broad ? .85 : .35 + j * .17;
      const geometry = leafGeometry();
      geometry.rotateZ(Math.sin(theta + j) * .7);
      geometry.rotateY(theta + j);
      p.add(geometry, body, 'Foliage', top.x * f, potH + (top.y - potH) * f, top.z * f);
    }
    if (orchid) {
      for (let j = 0; j < 3; j++) {
        const geometry = new THREE.SphereGeometry(1, 8, 6); geometry.scale(.065, .04, .025);
        p.add(geometry, c.materials.whitePaint, 'Flowers', top.x, top.y - j * .06, top.z);
      }
    }
  }
}

function openBox({ p, model, body, accent }: Context, basket = false) {
  const bottom = .035, side = .025;
  p.box(0, bottom / 2, 0, 1, bottom, 1, body, 'Base');
  for (const x of [-.5 + side / 2, .5 - side / 2]) p.box(x, .5, 0, side, 1, 1, body, 'Body');
  for (const z of [-.5 + side / 2, .5 - side / 2]) p.box(0, .5, z, 1 - side * 2, 1, side, body, 'Body');
  if (model.style === 'lidded') {
    p.box(0, .975, 0, 1, .05, 1, body, 'Lid');
    p.box(0, .72, .493, .25, .08, .014, accent, 'Label Holder');
  }
  if (model.style === 'woven' || basket) {
    for (let i = 1; i < 14; i++) {
      const n = -.47 + i * .94 / 14;
      for (const z of [-.488, .488]) p.box(n, .48, z, .018, .92, .018, accent, 'Weave');
      for (const x of [-.488, .488]) p.box(x, .48, n, .018, .92, .018, accent, 'Weave');
    }
    for (let i = 1; i < 11; i++) {
      for (const z of [-.488, .488]) p.box(0, i / 11, z, .97, .012, .018, accent, 'Weave');
      for (const x of [-.488, .488]) p.box(x, i / 11, 0, .018, .012, .97, accent, 'Weave');
    }
  }
}

function wireBasket({ p, model, body, c }: Context, penCup = false) {
  const top = penCup ? .996 : model.style === 'compartments' ? .9 : .68;
  p.box(0, .02, 0, 1, .04, 1, body, 'Base');
  for (let i = 0; i < 15; i++) {
    const n = -.48 + i * .96 / 14;
    for (const z of [-.48, .48]) p.rod(new THREE.Vector3(n, .04, z), new THREE.Vector3(n, top, z), .005, body, 'Mesh');
    for (const x of [-.48, .48]) p.rod(new THREE.Vector3(x, .04, n), new THREE.Vector3(x, top, n), .005, body, 'Mesh');
  }
  for (let i = 1; i <= 6; i++) {
    const y = top * i / 6;
    for (const z of [-.48, .48]) p.box(0, y, z, .98, .008, .01, body, 'Mesh');
    for (const x of [-.48, .48]) p.box(x, y, 0, .01, .008, .98, body, 'Mesh');
  }
  if (penCup) return;
  if (model.style === 'compartments') {
    p.box(0, .47, 0, .035, .92, .96, c.materials.woodLight, 'Divider');
  } else {
    for (const x of [-.47, .47]) p.box(x, .8, 0, .025, .3, .035, body, 'Handle Mounts');
    p.box(0, .965, 0, .95, .07, .09, c.materials.woodLight, 'Handle');
  }
}

function trolley({ p, model, body, c }: Context) {
  const rounded = model.style === 'rounded';
  for (const x of [-.43, .43]) for (const z of [-.41, .41]) {
    p.cylinder(x, .51, z, .018, .94, body, 'Frame');
    const wheel = new THREE.CylinderGeometry(.05, .05, .035, 16); wheel.rotateZ(Math.PI / 2);
    p.add(wheel, c.materials.metalBlack, 'Castors', x, .05, z);
  }
  for (const y of [.13, .52, .91]) {
    p.box(0, y, 0, .96, .022, .96, body, 'Shelves');
    for (const x of [-.47, .47]) p.box(x, y + .035, 0, .02, .07, .96, body, 'Tray Rims');
    for (const z of [-.47, .47]) p.box(0, y + .035, z, .92, .07, .02, body, 'Tray Rims');
    if (rounded) for (let i = 0; i < 10; i++) p.box(-.4 + i * .088, y + .014, 0, .006, .005, .88, c.materials.metalBlack, 'Perforations');
  }
}

function roundedRect(w: number, h: number, r: number, x = 0, y = 0): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y); shape.closePath();
  return shape;
}
function frame({ p, c, model, body }: Context, mirror: boolean, round = false) {
  if (round) {
    const geometry = new THREE.CylinderGeometry(.5, .5, .98, 64); geometry.rotateX(Math.PI / 2);
    p.add(geometry, body, 'Frame', 0, .5, 0);
    const face = new THREE.CircleGeometry(.478, 64);
    p.add(face, c.materials.mirrorNonReflective, 'Mirror', 0, .5, .499);
  } else if (model.style === 'rounded') {
    const outer = roundedRect(1, 1, .14, -.5, 0);
    const inner = roundedRect(.96, .96, .12, -.48, .02);
    outer.holes.push(new THREE.Path(inner.getPoints().reverse()));
    p.add(new THREE.ExtrudeGeometry(outer, { depth: 1, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -.5), body, 'Frame');
    p.add(new THREE.ShapeGeometry(inner), c.materials.mirrorNonReflective, 'Mirror', 0, 0, .49);
  } else {
    const edge = mirror ? .055 : .045;
    for (const x of [-(1 - edge) / 2, (1 - edge) / 2]) p.box(x, .5, 0, edge, 1, 1, body, 'Frame');
    for (const y of [edge / 2, 1 - edge / 2]) p.box(0, y, 0, 1 - edge * 2, edge, 1, body, 'Frame');
    p.box(0, .5, .4, 1 - edge * 2, 1 - edge * 2, .1, mirror ? c.materials.mirrorNonReflective : c.materials.whitePaint, mirror ? 'Mirror' : 'Mat');
    // Neutral placeholder print; independently paintable, no remote artwork.
    if (!mirror) p.box(0, .5, .46, .69, .69, .03, c.materials.fabricBeige, 'Picture');
  }
}

function clock({ p, body, c }: Context) {
  const shell = new THREE.CylinderGeometry(.5, .5, .98, 48); shell.rotateX(Math.PI / 2);
  p.add(shell, body, 'Case', 0, .5, 0);
  p.add(new THREE.CircleGeometry(.46, 48), c.materials.whitePaint, 'Dial', 0, .5, .49);
  for (let i = 0; i < 12; i++) {
    const theta = i * Math.PI / 6;
    const mark = new THREE.BoxGeometry(.018, .05, .01); mark.rotateZ(-theta);
    p.add(mark, c.materials.metalBlack, 'Hour Markers', Math.sin(theta) * .4, .5 + Math.cos(theta) * .4, .495);
  }
  p.rod(new THREE.Vector3(0, .5, .48), new THREE.Vector3(-.16, .6, .48), .015, c.materials.metalBlack, 'Hands');
  p.rod(new THREE.Vector3(0, .5, .48), new THREE.Vector3(.08, .78, .48), .009, c.materials.metalBlack, 'Hands');
}

function pegboard({ p, body }: Context) {
  const shape = roundedRect(1, 1, .035, -.5, 0);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
    const hole = roundedRect(.013, .045, .006, -.45 + col * .081, .04 + row * .12);
    shape.holes.push(new THREE.Path(hole.getPoints().reverse()));
  }
  p.add(new THREE.ExtrudeGeometry(shape, { depth: .3, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -.15), body, 'Pegboard');
  for (const x of [-.35, .35]) p.box(x, .5, -.32, .05, .75, .36, body, 'Mounts');
}

function ledge({ p, body }: Context, spice = false) {
  p.box(0, .06, 0, 1, .12, 1, body, 'Shelf');
  if (spice) {
    for (const x of [-.48, .48]) p.box(x, .5, 0, .04, 1, 1, body, 'Sides');
    p.box(0, .72, .4, .94, .12, .12, body, 'Front Rail');
  } else {
    p.box(0, .5, -.46, 1, 1, .08, body, 'Back');
    p.box(0, .23, .46, 1, .46, .08, body, 'Front Lip');
  }
}

function jar(ctx: Context) {
  vessel(ctx, 'vase');
  const { p, c } = ctx;
  p.cylinder(0, .97, 0, ctx.model.style === 'bottle' ? .17 : .37, .06, c.materials.glass, 'Lid');
  p.ring(ctx.model.style === 'bottle' ? .17 : .37, .012, c.materials.whitePaint, 'Seal', 0, .94, 0);
  p.box(0, .83, .39, .16, .15, .035, c.materials.metalChrome, 'Clip');
}

function pump(ctx: Context) {
  const { p, body, c } = ctx;
  const pumpMaterial = c.entity.assetKey === 'ikea_90322303' ? c.materials.whitePaint : c.materials.metalChrome;
  p.cylinder(0, .34, 0, .45, .68, body, 'Body', .4);
  p.cylinder(0, .8, 0, .12, .24, pumpMaterial, 'Pump');
  p.box(0, .96, .12, .25, .08, .7, pumpMaterial, 'Nozzle');
}
function bin({ p, body, c, model }: Context) {
  if (model.material === 'metal') {
    p.lathe([[0, 0], [.36, 0], [.5, 1], [.47, 1], [.33, .04], [0, .04]], body, 'Body');
    for (let i = 1; i < 12; i++) p.ring(.36 + .14 * i / 12, .007, body, 'Mesh', 0, i / 12, 0);
  } else {
    p.cylinder(0, .47, 0, .43, .94, body, 'Body', .49);
    p.cylinder(0, .96, 0, .5, .08, body, 'Lid');
    p.cylinder(0, .98, 0, .1, .04, c.materials.metalChrome, 'Handle');
  }
}
function magazineFile({ p, body }: Context) {
  p.box(0, .025, 0, 1, .05, 1, body, 'Base');
  p.box(0, .5, -.48, 1, 1, .04, body, 'Spine');
  p.box(0, .15, .48, 1, .3, .04, body, 'Front');
  const side = new THREE.Shape(); side.moveTo(-.5, 0); side.lineTo(.5, 0); side.lineTo(.5, .3); side.lineTo(-.5, 1); side.closePath();
  for (const x of [-.48, .48]) {
    const geometry = new THREE.ExtrudeGeometry(side, { depth: .04, bevelEnabled: false });
    geometry.rotateY(Math.PI / 2); geometry.translate(x - .02, 0, 0);
    p.add(geometry, body, 'Sides');
  }
}

function light(ctx: Context, kind: 'globe' | 'mushroom' | 'task' | 'floor' | 'pendant') {
  const { p, c, body } = ctx;
  const bulbMat = c.materials.warmLightGlow;
  let diffuser: THREE.Mesh;
  if (kind === 'globe') {
    const geometry = new THREE.SphereGeometry(1, 32, 20); geometry.scale(.5, .48, .5);
    body.transparent = true; body.opacity = .65;
    p.add(geometry, body, 'Shade', 0, .52, 0);
    const bulb = new THREE.SphereGeometry(.22, 20, 12);
    diffuser = p.add(bulb, bulbMat, 'Bulb', 0, .52, 0);
    p.cylinder(0, .035, 0, .22, .07, body, 'Base');
  } else if (kind === 'mushroom') {
    p.cylinder(0, .23, 0, .3, .46, body, 'Base', .21);
    const geometry = new THREE.SphereGeometry(1, 32, 16); geometry.scale(.5, .32, .5);
    body.transparent = true; body.opacity = .65;
    p.add(geometry, body, 'Shade', 0, .68, 0);
    diffuser = p.cylinder(0, .65, 0, .14, .2, bulbMat, 'Bulb');
  } else if (kind === 'pendant') {
    const profile: [number, number][] = [[.49, 0], [.5, .06], [.42, .5], [.2, .92], [.13, 1], [.1, 1], [.17, .9], [.4, .48], [.47, .04]];
    p.lathe(profile.map(([r, y]) => [r, y * .286]), body, 'Shade');
    p.cylinder(0, .64, 0, .007, .7, c.materials.metalBlack, 'Cord');
    p.cylinder(0, .985, 0, .12, .03, body, 'Ceiling Canopy');
    p.cylinder(0, .265, 0, .04, .05, c.materials.metalBrass, 'Fitting');
    diffuser = p.cylinder(0, .04, 0, .25, .04, bulbMat, 'Bulb');
  } else {
    p.cylinder(0, .025, -.15, .33, .05, body, 'Base');
    p.rod(new THREE.Vector3(0, .05, -.15), new THREE.Vector3(0, kind === 'floor' ? .82 : .6, -.25), .018, body, 'Stem');
    p.rod(new THREE.Vector3(0, kind === 'floor' ? .82 : .6, -.25), new THREE.Vector3(0, .86, .22), .022, body, 'Arm');
    p.cylinder(0, .61, -.25, .04, .06, c.materials.metalBrass, 'Joints');
    p.lathe([[.34, .64], [.33, .7], [.12, .95], [.09, 1], [.06, 1], [.08, .94], [.3, .68]], body, 'Shade', 0, 0, .15);
    diffuser = p.cylinder(0, .68, .15, .16, .04, bulbMat, 'Bulb');
  }
  diffuser.userData.isLightEmissive = true;
  const fixture = new THREE.PointLight(0xfff2dc, .45, 4, 2);
  fixture.position.set(0, c.h * (kind === 'pendant' ? .06 : .72), 0);
  fixture.name = 'fixtureLight';
  fixture.userData = { isFixtureLight: true, fixtureType: 'spot', baseIntensity: .45, baseDistance: 4, baseColor: 0xfff2dc };
  c.parent.add(fixture);
}

/** One typed dispatch covers product families; each family has real component geometry. */
export function buildIkeaAccessory(c: AssetBuildContext): void {
  const model = c.definition?.accessory;
  if (!model) throw new Error(`Missing accessory model for ${c.entity.assetKey}`);
  // Powder-coated metal keeps a diffuse colour; bare stainless steel/brass use
  // the reflective palettes. Treating every metal as chrome makes white carts black.
  const metal = ['#b5bdc4', '#b9bdc2'].includes(model.color) ? c.materials.metalChrome
    : model.color === '#c4a35b' ? c.materials.metalBrass : c.materials.metalBlack;
  const bases = { paint: c.materials.whitePaint, glass: c.materials.glass, wood: c.materials.woodLight,
    metal, fabric: c.materials.fabricLight, ceramic: c.materials.ceramicWhite };
  const base = bases[model.material ?? 'paint'];
  const body = c.coloredMaterial ? c.coloredMaterial(model.color, base) : base;
  const accent = model.accentColor && c.coloredMaterial ? c.coloredMaterial(model.accentColor, c.materials.whitePaint) : c.materials.woodLight;
  const ctx: Context = { c, p: parts(c), model, body, accent }, { p } = ctx;
  const builders: Record<AccessoryKind, () => void> = {
    vase: () => vessel(ctx, 'vase'), plant_pot: () => vessel(ctx, 'pot'), plant: () => plant(ctx),
    tumbler: () => vessel(ctx, 'cup'), soap_dish: () => vessel(ctx, 'dish'),
    storage_box: () => model.material === 'metal' ? wireBasket(ctx, true) : openBox(ctx), wire_basket: () => wireBasket(ctx), pen_cup: () => wireBasket(ctx, true),
    magazine_file: () => magazineFile(ctx), trolley: () => trolley(ctx),
    round_mirror: () => frame(ctx, true, true), rectangular_mirror: () => frame(ctx, true), picture_frame: () => frame(ctx, false),
    clock: () => clock(ctx), pegboard: () => pegboard(ctx), ledge: () => ledge(ctx), spice_rack: () => ledge(ctx, true),
    jar: () => jar(ctx), soap_pump: () => pump(ctx), bin: () => bin(ctx),
    utensil_holder: () => {
      vessel(ctx, 'cup');
      for (let row = 0; row < 4; row++) for (let i = 0; i < 12; i++) {
        const theta = i * Math.PI / 6;
        const hole = new THREE.SphereGeometry(.026, 6, 4);
        p.add(hole, c.materials.metalBlack, 'Perforations', Math.cos(theta) * (.36 + row * .035), .15 + row * .19, Math.sin(theta) * (.36 + row * .035));
      }
    },
    chopping_board: () => {
      p.box(0, .5, 0, 1, 1, 1, body, 'Board');
      for (let i = 1; i < 9; i++) p.box(-.5 + i / 9, .996, 0, .002, .008, .96, c.materials.woodDark, 'Bamboo Strips');
    },
    brush: () => {
      p.cylinder(0, .23, 0, .47, .46, body, 'Holder', .5);
      p.cylinder(0, .72, 0, .035, .56, c.materials.metalChrome, 'Handle');
      p.cylinder(0, .47, 0, .46, .035, body, 'Lid');
    },
    cushion: () => {
      const geo = new THREE.SphereGeometry(1, 24, 16);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const rounded = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), .45) * .5;
        pos.setXYZ(i, rounded(pos.getX(i)), rounded(pos.getY(i)), rounded(pos.getZ(i)));
      }
      geo.computeVertexNormals(); p.add(geo, body, 'Fabric', 0, .5, 0);
    },
    rug: () => {
      p.box(0, .5, 0, 1, 1, 1, body, 'Fabric');
      for (let i = 1; i < 35; i++) p.box(0, .996, -.5 + i / 35, .99, .008, .004, c.materials.fabricBeige, 'Weave');
    },
    basket: () => {
      p.lathe([[0, 0], [.33, 0], [.5, .4], [.42, .78], [.38, .82], [.35, .78], [.46, .4], [.3, .04], [0, .04]], body, 'Body');
      for (let i = 1; i < 15; i++) p.ring(.34 + Math.sin(i / 15 * Math.PI) * .14, .008, accent, 'Weave', 0, i / 18, 0);
      for (const x of [-.28, .28]) p.ring(.085, .014, body, 'Handles', x, .9, 0, true);
    },
    candlesticks: () => {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * .33, height = .5 + i * .25;
        p.cylinder(x, .02, 0, .16, .04, body, 'Bases');
        p.cylinder(x, height / 2, 0, .025, height - .06, body, 'Stems');
        p.cylinder(x, height - .025, 0, .09, .05, body, 'Candle Cups');
      }
    },
    lantern: () => {
      p.box(0, .025, 0, 1, .05, 1, body, 'Base');
      for (const x of [-.47, .47]) for (const z of [-.47, .47]) p.box(x, .37, z, .06, .7, .06, body, 'Frame');
      for (const z of [-.46, .46]) p.box(0, .36, z, .9, .61, .015, c.materials.glass, 'Glass');
      for (const x of [-.46, .46]) p.box(x, .36, 0, .015, .61, .9, c.materials.glass, 'Glass');
      p.box(0, .71, 0, 1, .04, 1, body, 'Roof');
      const roof = new THREE.CylinderGeometry(.12, .68, .18, 4); roof.rotateY(Math.PI / 4);
      p.add(roof, body, 'Roof', 0, .81, 0);
      p.ring(.06, .012, body, 'Handle', 0, .928, 0, true);
    },
    dish: () => {
      p.box(0, .2, 0, 1, .4, 1, body, 'Dish');
      for (const x of [-.475, .475]) p.box(x, .7, 0, .05, .6, 1, body, 'Rim');
      for (const z of [-.475, .475]) p.box(0, .7, z, .9, .6, .05, body, 'Rim');
    },
    globe_lamp: () => light(ctx, 'globe'), mushroom_lamp: () => light(ctx, 'mushroom'),
    task_lamp: () => light(ctx, 'task'), floor_lamp: () => light(ctx, 'floor'), pendant_lamp: () => light(ctx, 'pendant'),
    tray_table: () => {
      p.cylinder(0, .96, 0, .5, .025, body, 'Tray');
      p.ring(.489, .011, body, 'Tray Rim', 0, .985, 0);
      for (const x of [-.32, .32]) for (const z of [-.32, .32]) p.cylinder(x, .46, z, .012, .92, body, 'Legs');
      p.box(0, .07, 0, .66, .015, .024, body, 'Braces');
      p.box(0, .07, 0, .024, .015, .66, body, 'Braces');
    },
  };
  builders[model.kind]();
}
