import { buildClothesRail } from './ClothesRailBuilder';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { accessoryParts } from '../assets/builders/IkeaAccessoryBuilder';
import { mergeStaticParts } from '../geometry/MergeStaticParts';
export function buildCabinetFitObject(c: AssetBuildContext): void {
  const p = accessoryParts(c), key = c.entity.assetKey, m = c.materials;
  const plastic = c.coloredMaterial?.('#638987', m.whitePaint) ?? m.whitePaint;
  if (key.startsWith('fit_clothes_rail_')) { buildClothesRail(c); }
  else if (key.startsWith('fit_folded_')) {
    const count = Number(key.match(/_(\d+)$/)?.[1] ?? 1), step = 1 / count;
    const pants = key.includes('pants'), towel = key.includes('towel'), sweatshirt = key.includes('sweatshirt');
    const palette = pants ? ['#344458', '#555c66', '#aa9273'] : towel ? ['#ded5c4', '#94aaa5', '#c4a69c', '#b2b9c2', '#f0e9dc'] : sweatshirt ? ['#a1aca8', '#d1b6a0', '#515d72', '#a57f7c', '#d1c9b8'] : ['#ece7de', '#7b91a2', '#b5bba8', '#bd9185', '#434c5e'];
    const garment = pants ? 'Pants' : towel ? 'Towel' : sweatshirt ? 'Sweatshirt' : 'T-shirt';
    for (let i = 0; i < count; i++) {
      const firstPart = c.parent.children.length;
      const section = `${garment} ${i + 1}`, material = c.coloredMaterial?.(palette[i % palette.length], m.fabricLight) ?? m.fabricLight;
      const y = i * step, shift = count > 1 ? (i % 2 ? .012 : -.012) : 0;
      const rounded = (x: number, cy: number, z: number, w: number, h: number, d: number) => p.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(h / 3, .035)), material, section, x, cy, z);
      rounded(shift, y + step * .46, 0, .96, step * .92, .96);
      if (pants) {
        // Folded legs, top waistband and a small visible pocket seam.
        rounded(shift, y + step * .93, -.19, .88, step * .10, .52);
        p.box(shift, y + step * .94, .04, .008, step * .025, .81, m.fabricDark, section);
        p.box(shift + .24, y + step * .985, -.30, .20, step * .02, .012, m.fabricDark, section);
      } else if (towel) {
        p.box(shift, y + step * .30, .482, .88, step * .035, .007, m.fabricLight, section);
        p.box(shift, y + step * .65, .482, .88, step * .035, .007, m.fabricLight, section);
      } else {
        // A folded collar and tucked sleeve flaps distinguish clothing from boxes.
        for (const x of [-.31, .31]) rounded(shift + x, y + step * .91, -.04, .25, step * .10, .65);
        p.ring(.065, .009 * step, material, section, shift, y + step * .98, -.30);
        p.box(shift, y + step * .15, .482, .85, step * .035, .007, m.fabricDark, section);
      }
      mergeStaticParts(c.parent.children.slice(firstPart).filter((part): part is THREE.Mesh => part instanceof THREE.Mesh));
    }
  } else if (key === 'fit_toilet_roll' || key === 'fit_toilet_rolls_3') {
    const count = key === 'fit_toilet_rolls_3' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const h = .995 / count;
      p.lathe([[.14, 0], [.5, 0], [.5, h], [.14, h], [.14, 0]], m.whitePaint, 'Paper', 0, i / count);
      p.lathe([[.13, 0], [.14, 0], [.14, h], [.13, h], [.13, 0]], m.woodLight, 'Cardboard Core', 0, i / count);
    }
  } else if (key === 'fit_mop_set' || key === 'fit_spin_mop_set') {
    const spin = key === 'fit_spin_mop_set', red = c.coloredMaterial?.('#c62832', m.whitePaint) ?? plastic;
    const bh = Math.min(.30 / c.h, .40);
    p.lathe([[0, 0], [.39, 0], [.48, bh * .9], [.48, bh], [.44, bh], [.35, .012 / c.h], [0, .012 / c.h]], red, 'Bucket');
    p.lathe([[.44, bh - .014 / c.h], [.49, bh - .014 / c.h], [.49, bh], [.44, bh]], m.whitePaint, 'Bucket Rim');
    if (spin) {
      const rotor = p.lathe([[.17, bh * .38], [.20, bh * .38], [.27, bh * .9], [.24, bh * .9], [.17, bh * .38]], m.metalChrome, 'Spin Basket', .18);
      for (let i = 0; i < 16; i++) { const angle = i * Math.PI / 8; p.box(.18 + Math.cos(angle) * .23, bh * .69, Math.sin(angle) * .23, .012, bh * .37, .012, plastic, 'Spinner Slots'); }
      rotor.name = 'spin_mop_spinner';
      p.box(.30, .012 / c.h, .40, .16, .018 / c.h, .15, plastic, 'Foot Pedal');
    } else {
      p.box(.23, bh * .82, 0, .38, bh * .25, .75, plastic, 'Wringer');
      for (const x of [.1, .2, .3]) p.box(x, bh * .96, 0, .035, .012 / c.h, .66, m.whitePaint, 'Wringer Slots');
    }
    const mx = -.19, headY = bh * .48;
    if (spin) p.cylinder(mx, headY, 0, .18, .035 / c.h, m.whitePaint, 'Microfibre Mop Head');
    else p.box(mx, headY, 0, .49, .024 / c.h, .48, m.whitePaint, 'Microfibre Mop Head');
    p.cylinder(mx, (headY + .96) / 2, 0, .009 / c.w, .96 - headY, m.metalChrome, 'Mop Handle');
    p.cylinder(mx, .97, 0, .014 / c.w, .06, red, 'Mop Grip');
    p.box(-.36, bh * .46, .15, .06, bh * .45, .45, plastic, 'Carry Handle');
  } else if (key === 'fit_flat_mop') {
    p.box(0, .004 / c.h, 0, 1, .008 / c.h, 1, m.fabricLight, 'Microfibre Mop Head');
    p.box(0, .017 / c.h, 0, .96, .018 / c.h, .90, plastic, 'Mop Plate');
    p.cylinder(0, .04 / c.h, 0, .03, .04 / c.h, plastic, 'Swivel Joint');
    p.cylinder(0, .51, 0, .009 / c.w, .92, m.metalChrome, 'Handle'); p.cylinder(0, .96, 0, .014 / c.w, .08, plastic, 'Grip');
  } else if (key === 'fit_mop') {
    p.box(0, .025, 0, 1, .05, 1, plastic, 'Mop Head'); p.cylinder(0, .51, 0, .022, .92, m.woodLight, 'Handle'); p.cylinder(0, .96, 0, .03, .08, plastic, 'Grip');
  } else if (key === 'fit_bucket') {
    p.lathe([[0, 0], [.32, 0], [.47, .78], [.46, .82], [.42, .82], [.29, .06], [0, .06]], plastic, 'Bucket');
    p.add(new THREE.TorusGeometry(.41, .014, 6, 32, Math.PI).scale(1, .50, 1), m.metalChrome, 'Handle', 0, .78, 0);
  } else {
    p.box(0, .39, 0, .86, .78, .90, plastic, 'Bottle'); p.cylinder(0, .84, 0, .23, .12, plastic, 'Neck');
    if (key === 'fit_spray_bottle') { p.box(0, .95, .02, .38, .10, .90, m.whitePaint, 'Trigger Head'); p.box(.12, .83, .15, .10, .18, .10, m.whitePaint, 'Trigger'); }
    else { p.cylinder(0, .95, 0, .26, .10, m.whitePaint, 'Cap'); p.box(0, .43, .457, .58, .40, .015, m.whitePaint, 'Label'); }
  }
}
