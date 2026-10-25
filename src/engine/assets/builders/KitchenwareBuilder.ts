import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildKitchenTool } from './KitchenToolBuilder';
import type { AssetBuildContext } from './AssetBuildContext';

/** Metric parts preserve circular vessels even when the envelope includes a long handle. */
export function buildKitchenware(c: AssetBuildContext): void {
  const model = c.definition?.kitchenware;
  if (!model) throw new Error(`Missing kitchenware model for ${c.entity.assetKey}`);
  const { w, h, d, materials: m } = c;
  if (model.kind === 'set') {
    for (const component of model.components ?? []) {
      const group = new THREE.Group(), [cw, cd, ch] = component.size, [x, z, y] = component.at;
      group.position.set((x + cw / 2 - .5) * w, y * h, (z + cd / 2 - .5) * d);
      c.parent.add(group);
      buildKitchenware({ ...c, parent: group, w: cw * w, h: ch * h, d: cd * d,
        definition: { ...c.definition!, kitchenware: component.model } });
    }
    return;
  }
  if ((model.count ?? 1) > 1) {
    const count = model.count!, step = Math.min(model.stackStep ?? .12, (1 - 1e-6) / (count - 1)), cols = model.columns ?? 1, rows = model.rows ?? Math.ceil(count / cols), grid = model.columns !== undefined;
    const pieceHeight = grid ? h : h * (1 - step * (count - 1));
    const prototype = new THREE.Group();
    buildKitchenware({ ...c, parent: prototype, w: grid ? w / cols : w, d: grid ? d / rows : d, h: pieceHeight, definition: { ...c.definition!, kitchenware: { ...model, count: undefined } } });
    prototype.updateMatrixWorld(true);
    prototype.traverse(part => {
      if (!(part instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
      mesh.userData = { ...part.userData, skipOutline: true };
      for (let i = 0; i < count; i++) {
        const x = grid ? -w / 2 + w / cols * (i % cols + .5) : 0, z = grid ? -d / 2 + d / rows * (Math.floor(i / cols) + .5) : 0;
        mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, grid ? 0 : i * step * h, z).multiply(part.matrixWorld));
      }
      mesh.instanceMatrix.needsUpdate = true; c.parent.add(mesh);
    });
    return;
  }
  const palette = { ceramic: m.ceramicWhite, glass: m.glass, steel: m.metalChrome, plastic: m.whitePaint, wood: m.woodLight, fabric: m.fabricLight, stone: m.whitePaint, cork: m.woodLight };
  const tint = (base: THREE.MeshStandardMaterial, color = model.color) => { const material = c.coloredMaterial?.(color, base) ?? base.clone(); material.color.set(color); return material; };
  const metallic = (color: string) => {
    const material = c.coloredMaterial?.(color, m.metalChrome) ?? m.metalChrome.clone();
    material.color.set(color);
    // Preserve readable steel in the room's ambient lighting without an environment map.
    material.metalness = .35; material.roughness = .4; return material;
  };
  const steel = metallic('#b5babc');
  const body = model.transparent ? tint(m.glass) : model.material === 'steel' ? model.color === '#343837' ? tint(m.metalBlack) : metallic(model.color) : tint(palette[model.material]);
  if (model.matte) body.roughness = .65;
  const lidMat = (model.lidMaterial ?? model.material) === 'steel' ? metallic(model.lidColor ?? model.color) : tint(palette[model.lidMaterial ?? model.material], model.lidColor ?? model.color);
  const grip = model.material === 'wood' ? body : tint(m.whitePaint, '#353b3b');
  const dark = tint(m.metalBlack, '#303536');
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
    mesh.userData.section = section; mesh.name = section; c.parent.add(mesh); return mesh;
  };
  const box = (x: number, y: number, z: number, a: number, b: number, e: number, mat = body, section = 'Body') =>
    add(new THREE.BoxGeometry(a, b, e), mat, section, x, y, z);
  const disc = (x: number, y: number, z: number, radius: number, depth: number, mat = body, section = 'Body') =>
    add(new THREE.CylinderGeometry(radius, radius, depth, 32), mat, section, x, y, z);
  const profile = (points: number[][], width: number, height: number, depth: number, x = 0, y = 0, z = 0, mat = body, section = 'Body') => {
    const geo = new THREE.LatheGeometry(points.map(([r, v]) => new THREE.Vector2(r, v)), 32);
    geo.scale(width, height, depth); return add(geo, mat, section, x, y, z);
  };
  const lineGeometry = (points: number[][], radius: number) => {
    const vertices = points.map(p => new THREE.Vector3(...p as [number, number, number]));
    const curve = new THREE.CatmullRomCurve3(vertices, false, 'centripetal');
    const bounds = new THREE.Box3().setFromPoints(vertices);
    // Prevent spline overshoot from enlarging the published handle/rack envelope.
    const bounded = new class extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()) { return curve.getPoint(t, target).clamp(bounds.min, bounds.max); }
    }();
    return new THREE.TubeGeometry(bounded, 24, radius, 6, false);
  };
  const tube = (points: number[][], radius: number, mat = body, section = 'Handle') => add(lineGeometry(points, radius), mat, section);
  const merge = (parts: THREE.BufferGeometry[], mat: THREE.Material, section: string) => {
    if (!parts.length) return;
    const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!geometry) throw new Error(`Could not merge kitchenware ${section}`);
    add(geometry, mat, section).userData.skipOutline = true;
  };
  const rodGeo = (a: number[], b: number[], radius: number) => {
    const start = new THREE.Vector3(...a as [number, number, number]), end = new THREE.Vector3(...b as [number, number, number]);
    const geo = new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 8);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()));
    return geo.translate(...start.add(end).multiplyScalar(.5).toArray() as [number, number, number]);
  };
  const rect = (width: number, depth: number, radius: number) => {
    const path = new THREE.Shape(), x = -width / 2, z = -depth / 2, r = Math.min(radius, width / 4, depth / 4);
    path.moveTo(x + r, z); path.lineTo(x + width - r, z); path.quadraticCurveTo(x + width, z, x + width, z + r);
    path.lineTo(x + width, z + depth - r); path.quadraticCurveTo(x + width, z + depth, x + width - r, z + depth);
    path.lineTo(x + r, z + depth); path.quadraticCurveTo(x, z + depth, x, z + depth - r);
    path.lineTo(x, z + r); path.quadraticCurveTo(x, z, x + r, z); return path;
  };
  const slab = (width: number, height: number, depth: number, y: number, mat = body, section = 'Body', hole = false) => {
    const shape = rect(width, depth, Math.min(width, depth) * .09), t = Math.min(width, depth) * .025;
    if (hole) shape.holes.push(new THREE.Path(rect(width - t * 2, depth - t * 2, t).getPoints()));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 5 });
    geo.rotateX(-Math.PI / 2); return add(geo, mat, section, 0, y, 0);
  };
  const openBox = (width: number, height: number, depth: number, y = 0, mat = body, section = 'Body', x = 0) => {
    const start = c.parent.children.length;
    const t = Math.min(height * .15, width * .025, depth * .025);
    slab(width, t, depth, y, mat, section); slab(width, height - t, depth, y + t, mat, section, true);
    for (const part of c.parent.children.slice(start)) part.position.x += x;
  };
  const vessel = (width: number, height: number, depth: number, x = 0, y = 0, mat = body, section = 'Body') =>
    profile([[0, 0], [.39, 0], [.46, .12], [.5, 1], [.47, 1], [.43, .12], [0, .08]], width, height, depth, x, y, 0, mat, section);
  const handle = (left: number, right: number, bottom: number, top: number, radius: number, mat = body) =>
    tube([[left, top, 0], [right - radius * 2, top, 0], [right - radius, (top + bottom) / 2, 0], [right - radius * 2, bottom, 0], [left, bottom, 0]], radius, mat);
  const lid = (width: number, depth: number, y: number, height: number, round: boolean, knob = false) => {
    if (round) profile([[0, 0], [.5, 0], [.5, .25], [.4, .55], [0, .65]], width, height, depth, 0, y, 0, lidMat, 'Lid');
    else slab(width, height * (knob ? .55 : 1), depth, y, lidMat, 'Lid');
    if (knob) disc(0, y + height * .8, 0, Math.min(width, depth) * .08, height * .4, grip, 'Lid Knob');
  };
  switch (model.kind) {
    case 'plate': case 'bowl': case 'glass': {
      if (model.round === false) { openBox(w, h, d); break; }
      const points = model.kind === 'plate'
        ? [[0, 0], [.3, 0], [.48, .65], [.5, .9], [.495, 1], [.43, .82], [.28, .18], [0, .18]]
        : model.kind === 'bowl'
          ? [[0, 0], [.22, 0], [.44, .55], [.5, .96], [.495, 1], [.47, .96], [.4, .55], [.19, .08], [0, .08]]
          : [[0, 0], [.3, 0], [.38, .08], [.5, 1], [.47, 1], [.35, .08], [0, .08]];
      profile(points, w, h, d); break;
    }
    case 'mug': {
      const diameter = Math.min(d, w * .85), x = -w / 2 + diameter / 2;
      vessel(diameter, h, d, x);
      handle(x + diameter * .42, w / 2, h * .22, h * .8, Math.min(h * .035, (w - diameter) * .12)); break;
    }
    case 'stemware': {
      disc(0, h * .015, 0, w * .48, h * .03); disc(0, h * .25, 0, w * .025, h * .45);
      profile([[0, 0], [.15, .04], [.48, .45], [.5, .7], [.37, 1], [.345, 1], [.47, .7], [.45, .45], [.13, .1], [0, .06]], w, h * .56, d, 0, h * .44); break;
    }
    case 'jar': case 'food_container': case 'storage_box': {
      const l = model.withLid ? h * .09 : 0, bh = h - l;
      if (model.round || model.kind === 'jar') vessel(w, bh, d);
      else openBox(w, bh, d);
      if (model.withLid) lid(w, d, bh, l, !!model.round || model.kind === 'jar'); break;
    }
    case 'lid': lid(w, d, 0, h, !!model.round); break;
    case 'bottle': {
      profile([[0, 0], [.35, 0], [.48, .05], [.5, .62], [.43, .72], [.19, .81], [.18, .98], [.15, .98], [.15, .81], [.4, .71], [.45, .61], [.43, .06], [0, .04]], w, h, d);
      if (model.withLid) disc(0, h * .98, 0, w * .2, h * .04, lidMat, 'Stopper'); break;
    }
    case 'jug': case 'teapot': case 'french_press': {
      const diameter = Math.min(d, w * .72), press = model.kind === 'french_press', teapot = model.kind === 'teapot';
      const x = -w / 2 + diameter / 2 + (teapot ? w * .16 : 0), bh = h * (press ? .83 : .92);
      vessel(diameter, bh, d, x);
      handle(x + diameter * .42, w / 2, h * .22, h * .8, Math.min(h * .025, w * .015), press ? grip : body);
      if (teapot) {
        const spout = new THREE.CylinderGeometry(diameter * .06, diameter * .13, w * .25, 20, 1, true);
        spout.rotateZ(Math.PI / 3); add(spout, body, 'Spout', -w * .35, h * .62, 0);
      }
      if (model.withLid || press) {
        disc(x, bh + h * .025, 0, diameter * .49, h * .05, press ? grip : lidMat, 'Lid');
        disc(x, h * .94, 0, diameter * .09, h * .12, grip, 'Lid Knob');
      }
      if (press) {
        disc(x, bh * .55, 0, diameter * .015, bh * .9, steel, 'Plunger');
        disc(x, h * .15, 0, diameter * .43, h * .015, steel, 'Filter');
      } break;
    }
    case 'pan': case 'pot': {
      const pot = model.kind === 'pot', diameter = model.bodyWidthRatio ? w * model.bodyWidthRatio : Math.min(d, w), lh = model.withLid ? model.bodyHeightRatio ? h * (1 - model.bodyHeightRatio) : Math.min(h * .28, .04) : 0, bh = h - lh;
      const x = pot ? 0 : -w / 2 + diameter / 2;
      if (model.round === false) { openBox(diameter, bh, d, 0, body, 'Body', x); }
      else {
        vessel(diameter, bh, d, x);
        if (model.coated) profile([[0, .09], [.42, .13], [.47, 1]], diameter, bh, d, x, 0, 0, dark, 'Nonstick Interior');
      }
      if (pot) {
        for (const side of [-1, 1]) {
          const r = Math.min(h * .035, (w - diameter) * .08);
          tube([[side * diameter * .43, bh * .72, -d * .16], [side * (w / 2 - r), bh * .72, -d * .13], [side * (w / 2 - r), bh * .72, d * .13], [side * diameter * .43, bh * .72, d * .16]], r, body);
        }
      } else {
        const length = Math.max(w - diameter, w * .08);
        box(w / 2 - length / 2, bh * .65, 0, length, Math.min(bh * .24, .022), d * .11, grip, 'Handle');
      }
      if (model.withLid) {
        const start = c.parent.children.length;
        lid(diameter, d, bh, lh, model.round !== false, true);
        // Move the separately editable lid onto the offset saucepan body.
        for (const part of c.parent.children.slice(start)) part.position.x += x;
      } break;
    }
    case 'oven_dish': case 'baking_tin': {
      if (model.style === 'muffin') {
        const tray = rect(w, d, .008), wells: THREE.BufferGeometry[] = [], cols = 4, rows = 3;
        const radius = Math.min(w / cols, d / rows) * .37;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const x = -w / 2 + w * (i + .5) / cols, z = -d / 2 + d * (j + .5) / rows;
          const hole = new THREE.Path(); hole.absarc(x, -z, radius, 0, Math.PI * 2, true); tray.holes.push(hole);
          const cup = new THREE.LatheGeometry([[0, 0], [radius * .65, 0], [radius, h * .92], [radius * .94, h * .92], [radius * .59, h * .08], [0, h * .08]].map(p => new THREE.Vector2(p[0], p[1])), 20);
          wells.push(cup.translate(x, 0, z));
        }
        const geo = new THREE.ExtrudeGeometry(tray, { depth: h * .08, bevelEnabled: false, curveSegments: 16 });
        geo.rotateX(-Math.PI / 2); add(geo, body, 'Baking Tray', 0, h * .92); merge(wells, body, 'Muffin Wells');
      } else if (model.round) vessel(w, h, d); else openBox(w, h, d);
      break;
    }
    case 'board': {
      if (model.style === 'corner') {
        const shape = new THREE.Shape(); shape.moveTo(-w / 2, -d / 2); shape.lineTo(w / 2, -d / 2); shape.lineTo(w / 2, d * .1); shape.lineTo(w * .1, d / 2); shape.lineTo(-w / 2, d / 2); shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); add(geo, body, 'Shelf');
      } else if (model.style === 'lazy_susan') { disc(0, h * .65, 0, w / 2, h * .7); disc(0, h * .15, 0, w * .3, h * .3, body, 'Base'); }
      else if (model.style === 'raised') {
        slab(w, h * .22, d, h * .78);
        for (const x of [-w * .38, w * .38]) box(x, h * .4, 0, w * .07, h * .8, d * .92, body, 'Legs');
      } else slab(w, h, d, 0); break;
    }
    case 'utensil': {
      if (['peeler', 'corkscrew', 'tenderizer', 'pastry_brush'].includes(model.style ?? '')) { buildKitchenTool(c); break; }
      if (model.style === 'rod') { const geo = new THREE.CylinderGeometry(.5, .5, 1, 16); geo.rotateX(Math.PI / 2); geo.scale(w, h, d); add(geo, body, 'Shaft', 0, h / 2); break; }
      const style = model.style, y = h / 2, r = Math.min(w * .06, h * .25), headz = -d * .3;
      box(0, y, d * .16, w * (style === 'knife' ? .5 : .22), h * .45, d * .68, body, 'Handle');
      if (style === 'knife') {
        const blade = new THREE.Shape(); blade.moveTo(-w * .5, -d * .5); blade.lineTo(w * .25, -d * .5); blade.lineTo(w * .5, -d * .27); blade.lineTo(w * .25, 0); blade.lineTo(-w * .5, 0); blade.closePath();
        const geo = new THREE.ExtrudeGeometry(blade, { depth: h * .15, bevelEnabled: false }); geo.rotateX(Math.PI / 2);
        add(geo, steel, 'Blade', 0, h * .6);
      } else if (style === 'fork' || style === 'scoop') {
        box(0, y, headz + d * .05, w * .85, h * .4, d * .12, body, 'Head');
        const tines = Array.from({ length: 4 }, (_, i) => rodGeo([-w * .42 + i * w * .28, y, headz], [-w * .42 + i * w * .28, y, -d * .48], r));
        merge(tines, body, 'Tines');
      } else if (style === 'whisk') {
        const wires: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 6, x = Math.cos(a) * w * .46, dy = Math.sin(a) * h * .42;
          wires.push(lineGeometry([[0, y, -d * .02], [x, y + dy, -d * .28], [0, y, -d * .48], [-x, y - dy, -d * .28], [0, y, -d * .02]], Math.min(w, h) * .018));
        } merge(wires, body, 'Whisk Wires');
      } else if (style === 'tongs') {
        for (const side of [-1, 1]) tube([[0, y, d * .46], [side * w * .25, y, 0], [side * w * .45, y, -d * .46]], r, body, 'Tong Arms');
      } else if (style === 'turner' || style === 'skimmer' || style === 'masher' || style === 'slicer') {
        const bars = [];
        for (let i = 0; i < 5; i++) bars.push(rodGeo([-w * .44 + i * w * .22, y, -d * .48], [-w * .44 + i * w * .22, y, -d * .15], r));
        bars.push(rodGeo([-w * .44, y, -d * .48], [w * .44, y, -d * .48], r), rodGeo([-w * .44, y, -d * .15], [w * .44, y, -d * .15], r));
        merge(bars, body, 'Slotted Head');
      } else if (style === 'can_opener') {
        box(0, y, headz, w, h * .8, d * .25, steel, 'Opener Head');
        disc(w * .2, h * .75, headz, w * .18, h * .4, grip, 'Turning Grip');
      } else {
        // A laid-flat, hollow spoon/ladle or tea-infuser head.
        const mesh = profile([[0, 0], [.3, 0], [.5, .8], [.5, 1], [.45, 1], [.25, .12], [0, .12]], w, h * .9, d * .36, 0, h * .05, headz);
        mesh.userData.section = 'Head'; mesh.name = 'Head';
      } break;
    }
    case 'grater': {
      if (model.style === 'box') { buildKitchenTool(c); break; }
      box(0, h * .5, d * .32, w * .45, h * .65, d * .36, grip, 'Handle');
      const shape = rect(w, d * .68, w * .08), radius = Math.min(w * .07, d * .018);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) {
        const hole = new THREE.Path(); hole.absarc((i - 1) * w * .25, (j - 3) * d * .075, radius, 0, Math.PI * 2, true); shape.holes.push(hole);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h * .2, bevelEnabled: false, curveSegments: 6 }); geo.rotateX(-Math.PI / 2);
      add(geo, steel, 'Perforated Grating Plate', 0, h * .4, -d * .15); break;
    }
    case 'colander': {
      const diameter = Math.min(d, w * .85); vessel(diameter, h, d);
      for (const side of [-1, 1]) tube([[side * diameter * .45, h * .85, -d * .13], [side * w * .48, h * .85, 0], [side * diameter * .45, h * .85, d * .13]], Math.min(h, w) * .025);
      const holes: THREE.BufferGeometry[] = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12, y = h * (.3 + j * .22), radius = diameter * (.46 + y / h * .04);
        const geo = new THREE.CircleGeometry(diameter * .009, 5); geo.rotateY(angle);
        geo.translate(Math.sin(angle) * radius, y, Math.cos(angle) * radius); holes.push(geo);
      } merge(holes, dark, 'Perforation Marks'); break;
    }
    case 'cutlery_tray': {
      openBox(w, h, d);
      const t = Math.min(w * .012, .004), cols = Math.max(1, Math.floor(w / .085)), split = -d * .18;
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 1; i < cols; i++) parts.push(new THREE.BoxGeometry(t, h * .88, d * .66).translate(-w / 2 + i * .085, h * .5, d * .15));
      parts.push(new THREE.BoxGeometry(w * .96, h * .88, t).translate(0, h * .5, split)); merge(parts, body, 'Compartment Dividers'); break;
    }
    case 'shelf_insert': {
      const t = Math.min(h * .055, .008); slab(w, t, d, h - t, body, 'Shelf');
      const legs: THREE.BufferGeometry[] = [];
      for (const x of [-w * .45, w * .45]) for (const z of [-d * .42, d * .42]) legs.push(new THREE.BoxGeometry(t, h - t, t).translate(x, (h - t) / 2, z));
      merge(legs, body, 'Legs'); break;
    }
    case 'plate_rack': case 'lid_rack': case 'bottle_rack': case 'dish_rack': {
      const parts: THREE.BufferGeometry[] = [], r = Math.min(h * .06, .004), y = r;
      for (const z of [-d * .4, d * .4]) parts.push(rodGeo([-w * .48, y, z], [w * .48, y, z], r));
      if (model.kind === 'bottle_rack') {
        for (let i = 0; i < 5; i++) box(-w * .44 + i * w * .22, h * .5, 0, w * .045, h, d, body, 'Bottle Stops');
      } else {
        const count = model.kind === 'dish_rack' ? 12 : 7;
        for (let i = 0; i < count; i++) {
          const x = -w * .44 + i * w * .88 / (count - 1);
          if (model.kind === 'plate_rack') for (const z of [-d * .4, d * .4]) parts.push(rodGeo([x, y, z], [x, h - r, z], r));
          else parts.push(lineGeometry([[x, y, -d * .4], [x, h - r, -d * .35], [x, h - r, d * .35], [x, y, d * .4]], r));
        }
      }
      merge(parts, body, 'Rack Frame'); break;
    }
    default: buildKitchenTool(c);
  }
}
