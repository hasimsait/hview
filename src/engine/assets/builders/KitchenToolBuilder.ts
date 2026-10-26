import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetBuildContext } from './AssetBuildContext';

/** Additional preparation, storage and wall-organizer shapes in metric envelopes. */
export function buildKitchenTool(c: AssetBuildContext): void {
  const model = c.definition!.kitchenware!, { w, h, d, materials: m } = c;
  const palette = { ceramic: m.ceramicWhite, glass: m.glass, steel: m.metalChrome, plastic: m.whitePaint, wood: m.woodLight, fabric: m.fabricLight, stone: m.whitePaint, cork: m.woodLight };
  const paint = (color: string, base = m.whitePaint) => {
    const mat = c.coloredMaterial?.(color, base) ?? base.clone(); mat.color.set(color); return mat;
  };
  const steel = paint('#b8bdbe', m.metalChrome); steel.metalness = .35; steel.roughness = .4;
  const body = model.transparent ? paint(model.color, m.glass) : model.material === 'steel' ? paint(model.color, steel) : paint(model.color, palette[model.material]);
  if (model.matte) body.roughness = .65;
  const trim = paint(model.lidColor ?? '#4d5554'), lid = model.lidMaterial ? paint(model.lidColor ?? model.color, model.lidMaterial === 'steel' ? steel : palette[model.lidMaterial]) : body;
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(g, mat); mesh.position.set(x, y, z); mesh.userData.section = section; mesh.name = section; c.parent.add(mesh); return mesh;
  };
  const boxGeo = (x: number, y: number, z: number, a: number, b: number, e: number) => new THREE.BoxGeometry(a, b, e).translate(x, y, z);
  const box = (x: number, y: number, z: number, a: number, b: number, e: number, mat = body, section = 'Body') => add(boxGeo(x, y, z, a, b, e), mat, section);
  const cylinder = (x: number, y: number, z: number, a: number, b: number, e: number, mat = body, section = 'Body', axis: 'x' | 'y' | 'z' = 'y') => {
    const geo = new THREE.CylinderGeometry(.5, .5, 1, 24);
    if (axis === 'x') geo.rotateZ(Math.PI / 2); if (axis === 'z') geo.rotateX(Math.PI / 2);
    geo.scale(a, b, e); return add(geo, mat, section, x, y, z);
  };
  const profile = (points: number[][], a = w, b = h, e = d, y = 0, mat = body, section = 'Body') =>
    add(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), 32).scale(a, b, e), mat, section, 0, y);
  const rodGeo = (a: number[], b: number[], r: number) => {
    const start = new THREE.Vector3(...a as [number, number, number]), end = new THREE.Vector3(...b as [number, number, number]);
    const geo = new THREE.CylinderGeometry(r, r, start.distanceTo(end), 8);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()));
    return geo.translate(...start.add(end).multiplyScalar(.5).toArray() as [number, number, number]);
  };
  const merge = (parts: THREE.BufferGeometry[], mat: THREE.Material, section: string) => {
    if (!parts.length) return;
    const merged = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!merged) throw new Error(`Cannot merge ${section}`);
    add(merged, mat, section).userData.skipOutline = true;
  };
  const tube = (points: number[][], r: number, mat = body, section = 'Handle', closed = false) => {
    const vectors = points.map(p => new THREE.Vector3(...p as [number, number, number])), bounds = new THREE.Box3().setFromPoints(vectors);
    const spline = new THREE.CatmullRomCurve3(vectors, closed, 'centripetal');
    const curve = new class extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()) { return spline.getPoint(t, target).clamp(bounds.min, bounds.max); }
    }();
    return add(new THREE.TubeGeometry(curve, 32, r, 6, closed), mat, section);
  };
  const openBox = (a = w, b = h, e = d, y = 0, mat = body, section = 'Body', bottom = true) => {
    const t = Math.min(a, b, e) * .04, parts = [boxGeo(-a / 2 + t / 2, y + b / 2, 0, t, b, e), boxGeo(a / 2 - t / 2, y + b / 2, 0, t, b, e), boxGeo(0, y + b / 2, -e / 2 + t / 2, a - 2 * t, b, t), boxGeo(0, y + b / 2, e / 2 - t / 2, a - 2 * t, b, t)];
    if (bottom) parts.push(boxGeo(0, y + t / 2, 0, a - 2 * t, t, e - 2 * t));
    merge(parts, mat, section);
  };
  const bowl = (a = w, b = h, e = d, y = 0, mat = body) =>
    profile([[0, 0], [.3, 0], [.46, .2], [.5, 1], [.46, 1], [.42, .2], [0, .1]], a, b, e, y, mat);
  const ring = (x: number, y: number, z: number, a: number, b: number, e: number, mat = body, section = 'Handle') => {
    const points = Array.from({ length: 12 }, (_, i) => [x + Math.cos(i * Math.PI / 6) * a / 2, y, z + Math.sin(i * Math.PI / 6) * e / 2]);
    return tube(points, b / 2, mat, section, true);
  };
  const slottedPlate = (a: number, b: number, e: number, y: number, z: number, mat = steel) => {
    const shape = new THREE.Shape(); shape.moveTo(-a / 2, -e / 2); shape.lineTo(a / 2, -e / 2); shape.lineTo(a / 2, e / 2); shape.lineTo(-a / 2, e / 2); shape.closePath();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
      const hole = new THREE.Path(); hole.absarc(-a * .32 + i * a * .21, -e * .38 + j * e * .127, Math.min(a * .045, e * .022), 0, Math.PI * 2, true); shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b, bevelEnabled: false, curveSegments: 5 }); geo.rotateX(-Math.PI / 2);
    return add(geo, mat, 'Grating Surface', 0, y, z);
  };
  switch (model.kind) {
    case 'mortar': {
      profile([[0, 0], [.32, 0], [.46, .15], [.5, .7], [.46, 1], [.39, 1], [.36, .45], [0, .3]], w, h * (model.bodyHeightRatio ?? .77), d);
      merge([rodGeo([-w * .21, h * .45, -d * .25], [w * .2, h * .94, d * .25], Math.min(w * .07, h * .05))], body, 'Pestle'); break;
    }
    case 'funnel': profile([[.03, 0], [.06, 0], [.06, .27], [.5, .94], [.5, 1], [.46, 1], [.035, .28], [.03, 0]]); break;
    case 'rolling_pin': {
      cylinder(0, h / 2, 0, w * .68, h, d, body, 'Rolling Barrel', 'x');
      for (const side of [-1, 1]) cylinder(side * w * .42, h / 2, 0, w * .16, h * .45, d * .45, body, 'Handles', 'x'); break;
    }
    case 'scale': {
      box(0, h * .35, 0, w, h * .7, d);
      cylinder(0, h * .85, -d * .12, w * .84, h * .3, d * .68, steel, 'Weighing Platform');
      box(0, h * .71, d * .34, w * .32, h * .02, d * .12, trim, 'Display'); break;
    }
    case 'thermometer': {
      box(0, h / 2, -d * .4, w, h, d * .2);
      box(0, h * .6, -d * .295, w * .75, h * .45, d * .01, paint('#8c9f97'), 'Display');
      for (const x of [-w * .25, 0, w * .25]) box(x, h * .19, -d * .29, w * .13, h * .1, d * .02, trim, 'Buttons');
      tube([[w * .3, h * .15, -d * .3], [w * .4, h * .1, -d * .07], [-w * .35, h * .1, 0], [-w * .25, h * .1, d * .2], [w * .2, h * .1, d * .2]], Math.min(w, h, d) * .012, trim, 'Probe Cord');
      merge([rodGeo([w * .2, h * .1, d * .2], [w * .2, h * .1, d * .48], Math.min(w, h, d) * .018)], steel, 'Probe'); break;
    }
    case 'juicer': {
      bowl(w, h * .42, d);
      add(new THREE.ConeGeometry(.5, 1, 12).scale(w * .56, h * .57, d * .56), body, 'Reamer', 0, h * .7);
      const ribs = Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return rodGeo([Math.cos(a) * w * .26, h * .43, Math.sin(a) * d * .26], [0, h * .97, 0], Math.min(w * .015, d * .015, h * .02)); });
      merge(ribs, body, 'Reamer Ridges'); break;
    }
    case 'salad_spinner': {
      bowl(w, h * .82, d); cylinder(0, h * .85, 0, w, h * .08, d, lid, 'Lid');
      box(w * .1, h * .92, 0, w * .34, h * .05, d * .09, trim, 'Crank'); cylinder(w * .23, h * .965, 0, w * .09, h * .07, d * .09, trim, 'Crank Grip');
      const ribs = Array.from({ length: 18 }, (_, i) => { const a = i * Math.PI / 9; return rodGeo([Math.cos(a) * w * .34, h * .1, Math.sin(a) * d * .34], [Math.cos(a) * w * .43, h * .75, Math.sin(a) * d * .43], Math.min(w, d) * .012); });
      merge(ribs, paint('#e4e6df'), 'Basket'); break;
    }
    case 'ice_tray': {
      const cols = model.columns ?? 4, rows = model.rows ?? 3, parts: THREE.BufferGeometry[] = [], t = Math.min(w / cols, d / rows) * .04, trayH = h * (model.withLid ? .8 : 1);
      box(0, t / 2, 0, w, t, d);
      for (let i = 0; i <= cols; i++) parts.push(boxGeo(-w / 2 + t / 2 + i * (w - t) / cols, trayH / 2, 0, t, trayH, d));
      for (let j = 0; j <= rows; j++) parts.push(boxGeo(0, trayH / 2, -d / 2 + t / 2 + j * (d - t) / rows, w, trayH, t));
      merge(parts, body, 'Mould Dividers');
      if (model.withLid) {
        const sticks: THREE.BufferGeometry[] = [];
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) sticks.push(boxGeo(-w / 2 + (i + .5) * w / cols, h * .88, -d / 2 + (j + .5) * d / rows, w / cols * .13, h * .24, d / rows * .08));
        merge(sticks, trim, 'Lolly Sticks');
      } break;
    }
    case 'brush': case 'utensil': {
      const style = model.style, y = h / 2, r = Math.min(w * .04, h * .18);
      box(0, y, d * .2, w * .25, h * .4, d * .6, body, 'Handle');
      if (style === 'peeler') {
        tube([[-w * .4, y, -d * .45], [-w * .4, y, -d * .2], [0, y, 0], [w * .4, y, -d * .2], [w * .4, y, -d * .45]], r, body, 'Head Frame');
        box(0, y, -d * .4, w * .78, h * .15, d * .06, steel, 'Blade');
      } else if (style === 'corkscrew') {
        box(0, y, -d * .15, w, h * .5, d * .12, body, 'Cross Handle');
        const points = Array.from({ length: 80 }, (_, i) => { const a = i * Math.PI / 10; return [Math.cos(a) * w * .12, y + Math.sin(a) * h * .25, -d * .15 - i / 79 * d * .3]; });
        tube(points, Math.min(w, h) * .04, steel, 'Spiral');
      } else if (style === 'tenderizer') {
        box(0, y, -d * .29, w, h * .9, d * .3, steel, 'Hammer Head');
      } else {
        box(0, h * .7, -d * .3, w, h * .35, d * .33, body, 'Brush Head');
        const bristles = Array.from({ length: 14 }, (_, i) => boxGeo(-w * .44 + i * w * .88 / 13, h * .25, -d * .3, w * .035, h * .5, d * .29));
        merge(bristles, paint(model.style === 'pastry_brush' ? model.color : '#d9d3bd'), 'Bristles');
      } break;
    }
    case 'scissors': {
      for (const side of [-1, 1]) ring(side * w * .24, h / 2, d * .25, w * .38, h * .45, d * .38, body);
      const blades = [rodGeo([-w * .14, h / 2, d * .1], [w * .12, h / 2, -d * .48], Math.min(w * .045, h * .3)), rodGeo([w * .14, h / 2, d * .1], [-w * .12, h / 2, -d * .48], Math.min(w * .045, h * .3))];
      merge(blades, steel, 'Blades'); cylinder(0, h * .6, 0, w * .12, h * .4, d * .04, steel, 'Pivot'); break;
    }
    case 'garlic_press': {
      for (const side of [-1, 1]) box(side * w * .23, h * .5, d * .12, w * .22, h * .45, d * .76, body, 'Handles');
      openBox(w, h, d * .28, 0, steel, 'Press Basket');
      slottedPlate(w * .82, h * .04, d * .24, h * .07, 0); break;
    }
    case 'grater': {
      if (h < Math.max(w, d) * .8) {
        openBox(w, h * .85, d, 0, body, 'Collection Box'); slottedPlate(w, h * .05, d, h * .85, 0);
      } else {
        openBox(w, h * .82, d, 0, steel, 'Grater Body', false);
        const marks: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) marks.push(boxGeo(-w * .3 + i * w * .2, h * (.1 + j * .1), d * .498, w * .035, h * .035, d * .004));
        merge(marks, trim, 'Grater Teeth');
        tube([[-w * .35, h * .8, 0], [-w * .3, h * .97, 0], [w * .3, h * .97, 0], [w * .35, h * .8, 0]], Math.min(w, h) * .025, body);
      } break;
    }
    case 'bag': {
      box(0, h * .39, 0, w, h * .78, d);
      box(0, h * .79, 0, w * .96, h * .015, d * .05, trim, 'Zipper');
      for (const z of [-d * .25, d * .25]) tube([[-w * .25, h * .75, z], [-w * .2, h * .98, z], [w * .2, h * .98, z], [w * .25, h * .75, z]], Math.min(w * .015, h * .015), body, 'Carry Handles');
      break;
    }
    case 'textile': {
      if (model.style === 'mitt') {
        const shape = new THREE.Shape(); shape.moveTo(-.25, -.5); shape.lineTo(.35, -.5); shape.lineTo(.42, .25); shape.quadraticCurveTo(.4, .5, .1, .5); shape.quadraticCurveTo(-.2, .5, -.25, .23); shape.lineTo(-.4, .3); shape.quadraticCurveTo(-.5, .2, -.43, .05); shape.lineTo(-.25, -.15); shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 8 }); geo.rotateX(-Math.PI / 2); geo.scale(w, h, d); add(geo, body, 'Fabric');
      } else {
        box(0, h / 2, 0, w, h, d, body, 'Fabric');
        if (model.style !== 'mat') box(0, h * .995, 0, w * .012, h * .008, d * .96, paint('#b9b3a6', m.fabricLight), 'Fold');
      } break;
    }
    case 'packet': {
      box(0, h / 2, 0, w, h, d); box(0, h * .99, 0, w * .7, h * .018, d * .25, trim, 'Opening'); break;
    }
    case 'mill': {
      profile([[0, 0], [.43, 0], [.5, .06], [.43, .35], [.35, .65], [.46, .8], [.46, 1], [0, 1]], w, h * .8, d);
      cylinder(0, h * .88, 0, w * .92, h * .16, d * .92, lid, 'Grinding Head'); cylinder(0, h * .98, 0, w * .25, h * .04, d * .25, steel, 'Adjuster'); break;
    }
    case 'knife_block': {
      box(0, h * (model.style === 'raised' ? .32 : .45), 0, w, h * (model.style === 'raised' ? .64 : .9), d, body, 'Block');
      if (model.style === 'raised') for (let i = 0; i < (model.columns ?? 3); i++) box(-w * .3 + i * w * .6 / Math.max(1, (model.columns ?? 3) - 1), h * .8, 0, w * .12, h * .4, d * .18, trim, 'Knife Handles');
      const slots = Array.from({ length: 5 }, (_, i) => boxGeo(-w * .32 + i * w * .16, h * .905, 0, w * .025, h * .01, d * .65)); merge(slots, trim, 'Knife Slots'); break;
    }
    case 'cutlery_stand': {
      if (model.round) bowl(w, h, d); else openBox();
      box(0, h * .45, 0, w * .025, h * .86, d * .86, body, 'Divider'); break;
    }
    case 'serving_stand': {
      if (model.withLid) {
        cylinder(0, h * .025, 0, w, h * .05, d, body, 'Base');
        profile([[.5, 0], [.49, .4], [.39, .7], [.2, .87], [0, .9]], w, h, d, h * .05, paint('#ffffff', m.glass), 'Dome');
        cylinder(0, h * .975, 0, w * .1, h * .05, d * .1, body, 'Dome Grip');
      } else {
        const tiers = model.tiers ?? 2;
        cylinder(0, h * .5, 0, w * .035, h, d * .035, steel, 'Stem');
        for (let i = 0; i < tiers; i++) { const f = 1 - i * .18; cylinder(0, h * (.06 + i * .85 / Math.max(1, tiers - 1)), 0, w * f, h * .035, d * f, body, 'Serving Plates'); }
      } break;
    }
    case 'rail': {
      cylinder(0, h / 2, d * .22, w, h * .5, d * .35, body, 'Rail', 'x');
      for (const x of [-w * .42, w * .42]) box(x, h / 2, -d * .1, w * .035, h, d * .8, body, 'Mounts'); break;
    }
    case 'hook': {
      const r = Math.min(w, h, d) * .09;
      box(0, h * .7, -d * .42, w, h * .6, d * .16, body, 'Mount');
      tube([[0, h * .88, -d * .32], [0, h * .18, -d * .3], [0, h * .12, d * .32], [0, h * .4, d * .42]], r, body, 'Hook'); break;
    }
    case 'wall_shelf': {
      box(0, h * .92, 0, w, h * .16, d, body, 'Shelf');
      for (const x of [-w * .38, w * .38]) box(x, h * .43, -d * .4, w * .035, h * .86, d * .12, body, 'Brackets'); break;
    }
    case 'bin': {
      const bh = model.withLid ? h * .9 : h;
      if (model.round) bowl(w, bh, d); else openBox(w, bh, d);
      if (model.withLid) { box(0, h * .93, 0, w, h * .06, d, lid, 'Lid'); box(0, h * .98, 0, w * .3, h * .04, d * .06, trim, 'Lid Grip'); } break;
    }
    case 'basket': case 'rack': {
      if (model.round) {
        const tiers = model.tiers ?? 2;
        cylinder(0, h / 2, 0, w * .035, h, d * .035, steel, 'Spindle');
        for (let i = 0; i < tiers; i++) bowl(w, h * .025, d, h * (.03 + i * .9 / Math.max(1, tiers - 1)));
        break;
      }
      const parts: THREE.BufferGeometry[] = [], r = Math.min(w, d, h) * .018, tiers = model.kind === 'basket' ? 1 : model.tiers ?? 2;
      for (const x of [-w * .46, w * .46]) for (const z of [-d * .44, d * .44]) parts.push(rodGeo([x, r, z], [x, h - r, z], r));
      for (let level = 0; level < tiers; level++) {
        const y = r + level * (h - 2 * r) / Math.max(tiers - 1, 1);
        for (const z of [-d * .44, d * .44]) parts.push(rodGeo([-w * .46, y, z], [w * .46, y, z], r));
        for (const x of [-w * .46, w * .46]) parts.push(rodGeo([x, y, -d * .44], [x, y, d * .44], r));
        for (let i = 0; i < 9; i++) { const x = -w * .44 + i * w * .11; parts.push(rodGeo([x, y, -d * .44], [x, y, d * .44], r * .5)); }
      }
      if (model.kind === 'basket') {
        for (const z of [-d * .44, d * .44]) parts.push(rodGeo([-w * .46, h - r, z], [w * .46, h - r, z], r));
        for (const x of [-w * .46, w * .46]) parts.push(rodGeo([x, h - r, -d * .44], [x, h - r, d * .44], r));
      }
      merge(parts, body, 'Frame'); break;
    }
    case 'coaster': {
      if (model.round) cylinder(0, h / 2, 0, w, h, d); else box(0, h / 2, 0, w, h, d); break;
    }
    case 'clip': {
      for (const side of [-1, 1]) box(side * w * .25, h / 2, 0, w * .42, h * .9, d, body, 'Jaws'); cylinder(0, h / 2, d * .36, w, h, d * .1, steel, 'Hinge', 'x'); break;
    }
    case 'cutter': {
      if (model.round) profile([[.46, 0], [.5, 0], [.5, 1], [.46, 1], [.46, 0]]); else openBox(w, h, d, 0, body, 'Cutting Rim', false); break;
    }
    case 'roll_holder': {
      cylinder(0, h * .015, 0, w, h * .03, d, body, 'Base');
      cylinder(0, h * .51, 0, w * .08, h * .98, d * .08, body, 'Spindle'); break;
    }
    case 'splatter_screen': {
      const dia = Math.min(d, w), x = -w / 2 + dia / 2, r = Math.min(h * .15, dia * .004), wires: THREE.BufferGeometry[] = [];
      const rim = Array.from({ length: 32 }, (_, i) => [x + Math.cos(i * Math.PI / 16) * (dia / 2 - r), h / 2, Math.sin(i * Math.PI / 16) * (d / 2 - r)]);
      tube(rim, r, body, 'Rim', true);
      for (let i = -9; i <= 9; i++) { const a = i * dia / 20, b = Math.sqrt((dia * .48) ** 2 - a ** 2); wires.push(rodGeo([x + a, h / 2, -b], [x + a, h / 2, b], r * .25), rodGeo([x - b, h / 2, a], [x + b, h / 2, a], r * .25)); }
      merge(wires, steel, 'Screen Mesh'); box(dia / 2, h / 2, 0, w - dia, h * .8, d * .06, body, 'Handle'); break;
    }
    case 'cap': {
      cylinder(0, h * .15, 0, w * .55, h * .3, d * .55, body, 'Stem'); cylinder(0, h * .6, 0, w, h * .8, d, body, 'Head'); break;
    }
    default: throw new Error(`Unsupported kitchenware model: ${model.kind}`);
  }
}
