import * as THREE from 'three';
import type { FurnitureProductKind } from '../../../domain/catalog/FurnitureProductModel';
import type { AssetBuildContext } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';

/** Local, editable reference models; each product supplies its footprint and component configuration. */
export function buildFurnitureProduct(c: AssetBuildContext): void {
  const model = c.definition?.furnitureProduct;
  if (!model) throw new Error(`Missing furniture product model for ${c.entity.assetKey}`);
  const p = accessoryParts(c), style = model.style ?? 'plain';
  const colored = (color: string, base = c.materials.whitePaint) => c.coloredMaterial?.(color, base) ?? base;
  const bases = { paint: c.materials.whitePaint, wood: c.materials.woodLight, fabric: c.materials.fabricLight };
  const body = colored(model.color ?? '#f1efea', bases[model.material ?? 'paint']), accent = colored(model.accentColor ?? '#44464a');
  const fabric = colored(model.fabricColor ?? '#9b9e9d', c.materials.fabricLight);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const rod = (a: number[], b: number[], r = .018, mat: THREE.Material = accent, section = 'Frame') =>
    p.rod(v(a[0], a[1], a[2]), v(b[0], b[1], b[2]), r, mat, section);
  const feet = (top = .16, inset = .41, mat: THREE.Material = accent) => {
    for (const x of [-inset, inset]) for (const z of [-.4, .4]) rod([x, .025, z], [x * .95, top, z * .95], .022, mat, 'Legs');
  };
  const carcass = (bottom = .12, top = .98, width = 1) => {
    p.box(0, bottom, 0, width, .035, 1, body, 'Base');
    p.box(0, top, 0, width, .035, 1, body, 'Top');
    for (const x of [-width / 2 + .015, width / 2 - .015]) p.box(x, (top + bottom) / 2, 0, .03, top - bottom, 1, body, 'Sides');
    p.box(0, (top + bottom) / 2, -.485, width - .06, top - bottom, .025, body, 'Back');
  };
  const handle = (x: number, y: number, knob = false) => {
    if (knob) { const geo = new THREE.SphereGeometry(.012, 12, 8); p.add(geo, accent, 'Handles', x, y, .485); }
    else p.box(x, y, .485, .09, .012, .025, accent, 'Handles');
  };
  const door = (x: number, y: number, w: number, h: number, mirrored = false) => {
    p.box(x, y, .44, w, h, .045, body, 'Doors');
    if (mirrored) p.box(x, y, .467, w * .82, h * .91, .006, c.materials.mirrorNonReflective, 'Mirror');
    if (style === 'country') {
      p.box(x, y, .467, w * .78, h * .76, .008, body, 'Door Panels');
    }
    handle(x + w * .3, y, style === 'country');
  };
  const drawers = (count: number, x = 0, bottom = .16, top = .88, width = .93) => {
    const height = (top - bottom) / count;
    for (let i = 0; i < count; i++) {
      const y = bottom + height * (i + .5);
      p.box(x, y, .44, width, height - .012, .045, body, 'Drawers');
      handle(x, y, style === 'country');
    }
  };
  const cushion = (x: number, y: number, z: number, w: number, h: number, d: number, section: string, mat: THREE.Material = fabric) => {
    const geo = new THREE.SphereGeometry(1, 24, 12), pos = geo.attributes.position;
    const round = (n: number) => Math.sign(n) * Math.pow(Math.abs(n), .32) / 2;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, round(pos.getX(i)) * w, round(pos.getY(i)) * h, round(pos.getZ(i)) * d);
    geo.computeVertexNormals(); p.add(geo, mat, section, x, y, z);
  };
  const seating = () => {
    const sleeper = style === 'sleeper', metal = style === 'metal';
    feet(sleeper ? .16 : .23);
    p.box(0, .29, 0, .92, .15, .88, metal ? accent : body, 'Seat Frame');
    const count = model.seats ?? 1, total = sleeper ? .92 : .79, width = total / count;
    for (let i = 0; i < count; i++) {
      const x = -total / 2 + width * (i + .5);
      cushion(x, .44, .07, width - .018, .18, .74, 'Seat');
      cushion(x, .72, -.32, width - .012, .48, .26, 'Backrest');
      if (style === 'tufted') for (const y of [.64, .78]) for (const dx of [-width * .2, width * .2]) {
        p.add(new THREE.SphereGeometry(.012, 8, 6), accent, 'Tufting', x + dx, y, -.18);
      }
    }
    if (!sleeper) for (const x of [-.45, .45]) {
      if (metal) {
        for (const z of [-.35, .35]) rod([x, .2, z], [x, .68, z], .018, accent, 'Arm Frame');
        rod([x, .68, -.35], [x, .68, .35], .022, accent, 'Armrests');
      } else cushion(x, .52, .02, .1, .43, .92, 'Armrests', body);
    }
    else for (const x of [-.47, .47]) {
      rod([x, .2, -.32], [x, .8, -.4], .012, accent, 'Reclining Frame');
    }
  };
  const builders: Record<FurnitureProductKind, () => void> = {
    bookcase: () => {
      const shelves = model.shelves ?? 5, columns = model.columns ?? 1;
      if (style === 'metal') {
        for (const x of [-.475, .475]) for (const z of [-.465, .465]) rod([x, .025, z], [x, .975, z], .014, accent, 'Metal Frame');
      } else {
        for (const x of [-.485, .485]) p.box(x, .5, 0, .03, 1, 1, body, 'Sides');
        p.box(0, .5, -.487, .94, 1, .025, body, 'Back');
      }
      for (let row = 0; row <= shelves; row++) p.box(0, .015 + row * .97 / shelves, 0, .94, .025, .96, body, 'Shelves');
      for (let col = 1; col < columns; col++) p.box(-.5 + col / columns, .5, 0, .025, .95, .95, body, 'Dividers');
    },
    desk: () => {
      p.box(0, .96, 0, 1, .06, 1, body, 'Desktop');
      feet(.93, .45, style === 'plain' ? body : accent);
      if (style === 'metal' || style === 'gaming') {
        for (const z of [-.4, .4]) rod([-.43, .15, z], [.43, .88, z], .012, accent, 'Braces');
      }
      if (style === 'shelf') {
        for (const x of [.2, .46]) p.box(x, .47, 0, .025, .89, .95, body, 'Shelf Supports');
        for (const y of [.06, .48]) p.box(.33, y, 0, .28, .03, .94, body, 'Side Shelves');
      }
      if (style === 'gaming') {
        p.box(0, .77, -.43, .86, .13, .05, accent, 'Rear Brace');
        p.ring(.05, .01, accent, 'Cup Holder', .41, .9, .32);
      }
    },
    wardrobe: () => {
      feet(.07); carcass(.075, .98);
      const n = model.doors ?? 4, drawerTop = model.drawers ? .27 : .1;
      for (let i = 0; i < n; i++) door(-.47 + .94 * (i + .5) / n, (drawerTop + .96) / 2, .94 / n - .008, .96 - drawerTop, Boolean(model.mirrored && (i === Math.floor(n / 2) || i === Math.floor(n / 2) - 1)));
      if (model.drawers) drawers(model.drawers, 0, .1, .265);
    },
    coffee_table: () => {
      feet(.92, .37, style === 'retro' || style === 'round' ? c.materials.woodLight : accent);
      if (style === 'round') p.cylinder(0, .95, 0, .5, .08, body, 'Tabletop');
      else p.box(0, .95, 0, 1, .08, 1, body, 'Tabletop');
      if (style === 'storage') {
        p.box(0, .26, 0, .92, .055, .92, body, 'Lower Shelf');
        for (const x of [-.43, .43]) p.box(x, .58, 0, .035, .61, .92, body, 'Sides');
      }
    },
    sofa: seating, armchair: seating,
    tv_stand: () => {
      feet(.25, .42, style === 'retro' ? c.materials.woodLight : accent);
      carcass(.25, .975);
      for (const x of [-.35, .35]) door(x, .61, .27, .65);
      for (const x of [-.2, .2]) p.box(x, .61, 0, .018, .68, .92, body, 'Dividers');
      p.box(0, .6, 0, .39, .025, .93, body, 'Media Shelf');
    },
    bedside: () => { feet(.12); carcass(.12, .98); drawers(model.drawers ?? 2, 0, .17, .94); },
    shoe_cabinet: () => {
      if (style === 'open') {
        for (const x of [-.475, .475]) for (const z of [-.46, .46]) rod([x, .02, z], [x, .98, z], .018, body, 'Uprights');
        const n = model.shelves ?? 5;
        for (let i = 0; i < n; i++) p.box(0, .04 + i * .9 / (n - 1), 0, .98, .035, .96, body, 'Shoe Shelves');
      } else {
        carcass(.04, .98);
        if (style === 'tilt') drawers(model.drawers || 1, 0, .08, .94);
        else for (let i = 0; i < (model.doors ?? 2); i++) door(-.47 + .94 * (i + .5) / (model.doors ?? 2), .51, .94 / (model.doors ?? 2) - .012, .88);
      }
    },
    shoe_bench: () => {
      carcass(.04, .82); cushion(0, .93, 0, .99, .14, .98, 'Seat');
      for (const x of [-.16, .16]) p.box(x, .43, 0, .02, .74, .95, body, 'Dividers');
      p.box(0, .41, 0, .93, .025, .95, body, 'Shoe Shelf');
    },
    sideboard: () => {
      feet(.18); carcass(.18, .98); const n = model.doors ?? 4;
      for (let i = 0; i < n; i++) door(-.47 + .94 * (i + .5) / n, .58, .94 / n - .008, .75);
      if (style === 'ribbed') for (let i = 0; i < 40; i++) p.box(-.46 + i * .92 / 39, .58, .467, .008, .69, .008, body, 'Fluted Fronts');
      if (model.drawers) drawers(model.drawers, 0, .55, .94, .29);
    },
    dining_chair: () => {
      feet(.49, .38, style === 'metal' ? colored('#c6a66d') : accent);
      cushion(0, .52, .05, .96, .12, .86, 'Seat');
      cushion(0, .79, -.31, .9, .42, .18, 'Backrest');
      for (const x of [-.34, .34]) rod([x, .35, -.35], [x, .82, -.35], .025, accent, 'Back Supports');
      if (model.ringBack) p.ring(.11, .012, colored('#c6a66d'), 'Back Ring', 0, .78, -.44, true);
    },
    floor_lamp: () => {
      const tripod = style.startsWith('tripod'), arc = style === 'arc', spiral = style === 'spiral';
      const shadeX = arc ? .17 : 0;
      if (tripod) for (let i = 0; i < 3; i++) {
        const angle = i * Math.PI * 2 / 3;
        rod([Math.cos(angle) * .44, .02, Math.sin(angle) * .44], [0, .75, 0], .025, body, 'Tripod Legs');
      } else {
        p.cylinder(arc ? -.2 : 0, .025, 0, .28, .05, body, 'Base');
        const curve = spiral
          ? Array.from({ length: 25 }, (_, i) => v(Math.sin(i / 24 * Math.PI * 4) * .1, .05 + i / 24 * .7, Math.cos(i / 24 * Math.PI * 4) * .1))
          : arc ? [v(-.2, .04, 0), v(-.2, .7, 0), v(-.1, .95, 0), v(.2, .91, 0)] : [v(0, .04, 0), v(0, .78, 0)];
        p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve), 48, .012, 8, false), body, 'Stem');
      }
      if (style === 'tripod_shelf') p.cylinder(0, .42, 0, .3, .025, body, 'Table Shelf');
      p.lathe([[.31, .75], [.25, .99], [.225, .99], [.285, .75]], fabric, 'Shade', shadeX);
      const bulb = p.cylinder(shadeX, .81, 0, .1, .1, c.materials.warmLightGlow, 'Bulb');
      bulb.userData.isLightEmissive = true;
      const light = new THREE.PointLight(0xfff1dd, .45, 4, 2); light.position.set(shadeX * c.w, .8 * c.h, 0); light.name = 'fixtureLight';
      light.userData = { isFixtureLight: true, fixtureType: 'spot', baseIntensity: .45, baseDistance: 4, baseColor: 0xfff1dd }; c.parent.add(light);
    },
    washer: () => {
      p.box(0, .49, 0, 1, .98, .97, body, 'Cabinet');
      p.box(0, .89, .49, .97, .16, .015, body, 'Control Panel');
      p.box(-.3, .89, .499, .28, .1, .002, body, 'Detergent Drawer');
      const knob = new THREE.CylinderGeometry(.055, .055, .025, 24); knob.rotateX(Math.PI / 2); p.add(knob, accent, 'Control Dial', 0, .89, .48);
      p.box(.28, .89, .496, .22, .08, .006, c.materials.screen, 'Display');
      const ring = new THREE.TorusGeometry(.28, .025, 8, 48); p.add(ring, accent, 'Door Rim', 0, .48, .47);
      p.add(new THREE.CircleGeometry(.25, 48), c.materials.glassBlack, 'Door Glass', 0, .48, .498);
      p.box(.25, .48, .492, .035, .1, .008, accent, 'Door Handle');
      p.box(0, .09, .49, .96, .1, .015, body, 'Service Panel');
    },
    bed: () => {
      const metal = style !== 'wood', folding = style === 'folding', daybed = style === 'daybed';
      feet(folding ? .48 : .26, .46, metal ? accent : body);
      p.box(0, folding ? .5 : .3, 0, .97, .06, .97, metal ? accent : body, 'Bed Frame');
      cushion(0, folding ? .75 : .46, 0, .92, folding ? .4 : .25, .94, 'Mattress', c.materials.fabricLight);
      if (!folding) {
        for (const z of [-.46, .46]) {
          if (metal) {
            for (const x of [-.46, .46]) rod([x, .05, z], [x, z < 0 ? .97 : .68, z], .02, accent, 'Bed Posts');
            for (let i = 0; i < 9; i++) rod([-.4 + i * .1, .3, z], [-.4 + i * .1, z < 0 ? .94 : .64, z], .009, accent, 'Spindles');
            rod([-.46, z < 0 ? .95 : .66, z], [.46, z < 0 ? .95 : .66, z], .02, accent, 'Bed Rails');
          } else p.box(0, z < 0 ? .68 : .34, z, .98, z < 0 ? .61 : .2, .035, body, z < 0 ? 'Headboard' : 'Footboard');
        }
      }
      if (daybed) {
        for (let i = 0; i < 10; i++) rod([-.46, .3, -.4 + i * .088], [-.46, .83, -.4 + i * .088], .009, accent, 'Daybed Back');
        rod([-.46, .84, -.44], [-.46, .84, .44], .018, accent, 'Daybed Rail');
        p.box(0, .15, .43, .85, .15, .06, accent, 'Trundle Front');
      }
    },
  };
  builders[model.kind]();
}
