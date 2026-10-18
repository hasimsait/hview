import * as THREE from 'three';
import type { BathroomKind } from '../../../domain/catalog/BathroomModel';
import type { AssetBuildContext } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';

/** Recognisable component models baked into the editable W × D × H planning envelope. */
export function buildBathroomAccessory(c: AssetBuildContext): void {
  const model = c.definition?.bathroom;
  if (!model) throw new Error(`Missing bathroom model for ${c.entity.assetKey}`);
  const p = accessoryParts(c), wood = /Bamboo|Birch|Willow|Rattan/.test(c.definition!.name);
  const base = wood ? c.materials.woodLight : c.materials.whitePaint;
  const body = c.coloredMaterial?.(model.color, base) ?? base;
  const accent = c.coloredMaterial?.(model.accentColor ?? '#596164', c.materials.whitePaint) ?? c.materials.metalBlack;
  const fabric = c.coloredMaterial?.(model.color, c.materials.fabricLight) ?? c.materials.fabricLight;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const rod = (a: number[], b: number[], r = .015, section = 'Frame', mat: THREE.Material = body) => p.rod(v(a[0], a[1], a[2]), v(b[0], b[1], b[2]), r, mat, section);
  const tube = (points: number[][], radius: number, section: string, mat: THREE.Material = body) =>
    p.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(a => v(a[0], a[1], a[2]))), 32, radius, 6, false), mat, section);
  const disc = (x: number, y: number, z: number, radius: number, depth: number, section: string, mat: THREE.Material = body) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, depth, 24);
    geometry.rotateX(Math.PI / 2);
    return p.add(geometry, mat, section, x, y, z);
  };
  const mounts = (positions: number[] = [-.36, .36], y = .7) => {
    for (const x of positions) disc(x, y, -.43, model.suction ? .085 : .045, .1, model.suction ? 'Suction Cups' : 'Wall Mounts');
  };
  const hook = (x: number, y: number, z = .1) => {
    rod([x, y, -.4], [x, y, z], .025, 'Hooks');
    rod([x, y, z], [x, y + .16, z], .025, 'Hooks');
  };
  const tray = (y: number, height: number, wire = false, corner = false) => {
    if (corner) {
      const shape = new THREE.Shape(); shape.moveTo(-.47, -.47); shape.lineTo(.47, -.47); shape.lineTo(-.47, .47); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false });
      geo.rotateX(Math.PI / 2); p.add(geo, body, 'Corner Shelf', 0, y, 0);
      for (const [a, b] of [[[-.47, y + height, -.47], [.47, y + height, -.47]], [[-.47, y + height, -.47], [-.47, y + height, .47]], [[.47, y + height, -.47], [-.47, y + height, .47]]]) rod(a, b, .02, 'Basket Rim');
    } else {
      if (wire) {
        for (let i = 0; i < 10; i++) rod([-.46 + i * .102, y, -.44], [-.46 + i * .102, y, .44], .009, 'Drainage Grid');
      } else {
        // Open drain slots are actual gaps between slats.
        for (let i = 0; i < 9; i++) p.box(-.44 + i * .11, y, 0, .08, .03, .9, body, 'Drainage Slats');
      }
      for (const z of [-.45, .45]) {
        rod([-.46, y, z], [.46, y, z], .018, 'Basket Base');
        rod([-.46, y + height, z], [.46, y + height, z], .018, 'Basket Rim');
        if (!wire) p.box(0, y + height / 2, z, .94, height, .025, body, 'Basket Sides');
        else for (let i = 0; i < 8; i++) rod([-.44 + i * .126, y, z], [-.44 + i * .126, y + height, z], .008, 'Basket Wires');
      }
      for (const x of [-.46, .46]) {
        rod([x, y + height, -.45], [x, y + height, .45], .018, 'Basket Rim');
        if (!wire) p.box(x, y + height / 2, 0, .025, height, .9, body, 'Basket Sides');
      }
    }
  };
  const handHead = (x: number, y: number, z: number, width: number, height: number) => {
    // Scale the circular head separately in x/y so its physical face remains round.
    const head = new THREE.CylinderGeometry(.5, .5, .07, 24); head.rotateX(Math.PI / 2);
    head.scale(width, height * .42, 1);
    p.add(head, body, 'Hand Shower Head', x, y + height * .27, z);
    const face = new THREE.CircleGeometry(1, 24); face.scale(width * .44, height * .185, 1);
    p.add(face, accent, 'Spray Face', x, y + height * .27, z + .039);
    rod([x, y - height * .49, z], [x, y + height * .1, z], width * .08, 'Hand Shower Handle');
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const hole = new THREE.CircleGeometry(width * .015, 5);
      p.add(hole, c.materials.whitePaint, 'Spray Nozzles', x + Math.cos(angle) * width * .31,
        y + height * .27 + Math.sin(angle) * height * .13, z + .041);
    }
  };
  const cloth = (curtain: boolean) => {
    const geometry = new THREE.PlaneGeometry(.98, .94, 64, 12);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setXYZ(i, x, y + .48, Math.sin((x + .5) * Math.PI * (curtain ? 24 : 6)) * .42);
    }
    geometry.computeVertexNormals(); fabric.side = THREE.DoubleSide;
    p.add(geometry, fabric, 'Fabric').userData.skipOutline = true;
    for (let i = 0; i < (curtain ? 12 : 2); i++) p.ring(.015, .004, body, curtain ? 'Curtain Eyelets' : 'Hanging Loops', -.45 + i * (curtain ? .9 / 11 : .9), .965, 0, true);
    // Neutral motif cues, not a reproduction of the product's textile print.
    if (curtain && model.pattern !== 'plain') {
      for (let i = 0; i < 10; i++) {
        if (model.pattern === 'stripes') {
          const line = new THREE.PlaneGeometry(.014, .9, 1, 12);
          const x = -.45 + i * .1, z = Math.sin((x + .5) * Math.PI * 24) * .42 + .005;
          accent.side = THREE.DoubleSide; p.add(line, accent, 'Pattern', x, .48, z).userData.skipOutline = true;
        } else for (let j = 0; j < 5; j++) disc(-.45 + i * .1, .1 + j * .17, .44, .006, .006, 'Pattern', accent);
      }
    }
    if (!curtain) for (const y of [.07, .12, .82, .87]) p.box(0, y, .44, .96, .012, .008, accent, 'Woven Border');
  };
  const builders: Record<BathroomKind, () => void> = {
    caddy: () => {
      mounts(); const tiers = model.tiers ?? 1;
      for (let i = 0; i < tiers; i++) tray(.05 + i * .5, tiers > 1 ? .18 : .48, model.wire, model.corner);
      if (tiers > 1) {
        for (const x of [-.4, .4]) rod([x, .05, -.43], [x, .95, -.43], .015, 'Back Frame');
        hook(0, .8, -.2);
      }
    },
    wall_shelf: () => {
      p.box(0, .15, 0, 1, .18, .96, model.glass ? c.materials.glass : body, 'Shelf');
      for (const x of [-.35, .35]) p.box(x, .4, -.43, .055, .8, .1, body, 'Brackets');
      if (c.definition!.collection === 'Shower shelves') {
        rod([-.47, .8, .43], [.47, .8, .43], .02, 'Front Rail');
        for (const x of [-.47, .47]) rod([x, .15, .43], [x, .8, .43], .02, 'Supports');
      }
    },
    rail: () => {
      mounts([-.45, .45], .5);
      for (const x of [-.45, .45]) rod([x, .5, -.42], [x, .5, .4], .035, 'Supports');
      rod([-.45, .5, .4], [.45, .5, .4], .04, 'Towel Rail');
    },
    towel_ring: () => {
      mounts([0], .9); rod([0, .9, -.4], [0, .9, .15], .025, 'Bracket');
      p.ring(.41, .025, body, 'Towel Ring', 0, .46, .15, true);
    },
    swivel_rail: () => {
      rod([0, .05, -.35], [0, .95, -.35], .1, 'Wall Bracket');
      for (const y of [.12, .5, .88]) rod([0, y, -.42], [0, y, .46], .04, 'Swivel Arms');
    },
    freestanding_rail: () => {
      for (const x of [-.45, .45]) {
        rod([x, .02, -.44], [x, .98, .1], .035, 'Uprights');
        rod([x, .02, .44], [x, .98, .1], .035, 'Rear Legs');
      }
      for (const y of [.5, .73, .95]) rod([-.45, y, y * .55 - .44], [.45, y, y * .55 - .44], .028, 'Towel Rails');
    },
    hooks: () => {
      const count = model.count ?? 1; mounts(count === 1 ? [0] : [-.4, .4], .4);
      if (count > 1) p.box(0, .4, -.3, .96, .25, .12, body, 'Back Plate');
      for (let i = 0; i < count; i++) hook(count === 1 ? 0 : -.4 + i * .8 / (count - 1), .4, .4);
    },
    door_hooks: () => {
      for (const x of [-.4, .4]) {
        rod([x, .4, -.4], [x, .96, -.4], .025, 'Overdoor Brackets');
        rod([x, .96, -.4], [x, .96, .35], .025, 'Overdoor Brackets');
        rod([x, .96, .35], [x, .75, .35], .025, 'Overdoor Brackets');
      }
      rod([-.44, .45, .3], [.44, .45, .3], .025, 'Hook Rail');
      const n = model.count ?? 5;
      for (let i = 0; i < n; i++) hook(-.4 + i * .8 / (n - 1), .25, .4);
    },
    roll_holder: () => {
      mounts([-.4], .6); rod([-.4, .6, -.4], [-.4, .6, .38], .045, 'Bracket');
      rod([-.4, .6, .38], [.43, .6, .38], .04, 'Paper Spindle');
      rod([.43, .6, .38], [.43, .8, .38], .035, 'End Stop');
    },
    pump_holder: () => { mounts([0]); p.ring(.38, .035, body, 'Bottle Ring', 0, .4, .05); rod([0, .4, -.4], [0, .4, .05], .04, 'Bracket'); },
    handshower_bracket: () => { mounts([0], .5); p.box(0, .5, 0, .5, .3, .7, body, 'Bracket'); p.ring(.23, .07, body, 'Hand Shower Cradle', 0, .65, .12); },
    shower_head: () => { handHead(0, .49, 0, .96, 1); },
    shower_kit: () => {
      mounts([0], .15); mounts([0], .85); rod([0, .12, -.25], [0, .9, -.25], .028, 'Riser Rail');
      handHead(.05, .76, .1, .6, .44);
      tube([[.05, .54, .1], [.42, .2, .1], [.12, .02, .1], [-.25, .25, -.1]], .018, 'Shower Hose');
    },
    shower_system: () => {
      mounts([0], .2); mounts([0], .8);
      tube([[0, .12, -.4], [0, .8, -.4], [0, .92, -.3], [0, .92, .25]], .022, 'Riser Pipe');
      p.cylinder(0, .94, .21, .27, .025, body, 'Rain Shower Head');
      p.cylinder(0, .923, .21, .25, .008, accent, 'Rain Spray Face');
      handHead(.23, .62, -.15, .35, .25);
      tube([[.23, .5, -.15], [.42, .12, -.12], [0, .02, -.12], [-.2, .22, -.35]], .016, 'Shower Hose');
      rod([-.43, .18, -.35], [.43, .18, -.35], .05, 'Mixer');
      for (const x of [-.43, .43]) p.cylinder(x, .18, -.35, .06, .08, accent, 'Mixer Controls');
    },
    hose: () => tube([[0, .96, 0], [.4, .7, 0], [.4, .2, 0], [0, .04, 0], [-.4, .2, 0], [-.4, .7, 0], [-.1, .93, 0]], .025, 'Shower Hose'),
    tap: () => {
      mounts([-.25, .25], .5); rod([-.43, .5, -.15], [.43, .5, -.15], .085, 'Mixer Body');
      rod([0, .5, -.15], [0, .5, .4], .065, 'Spout');
      for (const x of [-.4, .4]) p.cylinder(x, .5, -.15, .08, .4, accent, 'Controls');
    },
    curtain: () => cloth(true), towel: () => cloth(false),
    curtain_rod: () => {
      if (model.corner) tube([[-.45, .5, -.43], [.3, .5, -.43], [.43, .5, -.3], [.43, .5, .45]], .025, 'Corner Curtain Rod');
      else { rod([-.47, .5, 0], [.47, .5, 0], .28, 'Curtain Rod'); for (const x of [-.47, .47]) p.box(x, .5, 0, .035, .9, .9, body, 'End Pads'); }
    },
    curtain_ring: () => p.ring(.42, .055, body, 'Curtain Ring', 0, .5, 0, true),
    squeegee: () => { rod([0, .08, 0], [0, .98, 0], .022, 'Handle'); p.box(0, .04, 0, 1, .06, .45, body, 'Squeegee Head'); p.box(0, .01, .15, 1, .018, .3, accent, 'Rubber Blade'); },
    mirror_arm: () => {
      mounts([0], .5); rod([0, .4, -.4], [0, .4, .25], .025, 'Extension Arm');
      disc(0, .53, .35, .45, .08, 'Mirror Frame');
      p.add(new THREE.CircleGeometry(.42, 40), c.materials.mirrorNonReflective, 'Mirror', 0, .53, .4);
    },
    stool: () => {
      p.box(0, .94, 0, 1, .12, 1, body, 'Seat');
      for (const x of [-.38, .38]) for (const z of [-.38, .38]) rod([x, .03, z], [x * .9, .89, z * .9], .06, 'Legs');
      for (const z of [-.35, .35]) rod([-.38, .28, z], [.38, .28, z], .035, 'Braces');
    },
    bathroom_set: () => {
      p.box(0, .025, 0, .98, .05, .98, body, 'Tray');
      p.lathe([[0, .05], [.16, .05], [.18, .66], [.15, .66], [.13, .09], [0, .09]], body, 'Toothbrush Cup', .27, 0, .08);
      p.cylinder(-.24, .4, 0, .17, .7, body, 'Soap Bottle');
      p.cylinder(-.24, .86, 0, .045, .22, accent, 'Pump');
      p.box(-.24, .97, .1, .09, .04, .32, accent, 'Pump Nozzle');
    },
    box_set: () => {
      for (const [x, height] of [[-.26, .9], [.26, 1]]) {
        p.box(x, height / 2, 0, .46, height, .96, body, 'Boxes');
        p.box(x, height - .025, 0, .47, .05, .98, body, 'Lids');
        p.box(x, height - .004, 0, .15, .008, .08, accent, 'Lid Inset');
      }
    },
    laundry_basket: () => {
      p.lathe([[0, 0], [.37, 0], [.47, .93], [.43, .93], [.34, .04], [0, .04]], body, 'Basket');
      p.ring(.45, .02, body, 'Rim', 0, .94, 0);
      if (!model.wire) for (let i = 1; i < 16; i++) p.ring(.37 + .1 * i / 16, .008, accent, 'Weave', 0, i / 17, 0);
      for (const x of [-.34, .34]) p.ring(.05, .012, body, 'Handles', x, .93, 0, true);
    },
    hanging_storage: () => {
      p.box(0, .5, -.46, .94, .98, .04, fabric, 'Fabric Back');
      for (let i = 0; i < (model.tiers ?? 3); i++) tray(.03 + i * .3, .24);
      for (const x of [-.3, .3]) p.ring(.025, .007, body, 'Hanging Loops', x, .96, -.4, true);
    },
    shelving: () => {
      for (const x of [-.45, .45]) for (const z of [-.45, .45]) rod([x, .02, z], [x, .98, z], .025, 'Uprights');
      const n = model.tiers ?? 4;
      for (let i = 0; i < n; i++) tray(.04 + i * .88 / (n - 1), .05, false, model.corner);
    },
  };
  builders[model.kind]();
}
