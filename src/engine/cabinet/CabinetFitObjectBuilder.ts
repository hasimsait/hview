import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { accessoryParts } from '../assets/builders/IkeaAccessoryBuilder';
export function buildCabinetFitObject(c: AssetBuildContext): void {
  const p = accessoryParts(c), key = c.entity.assetKey, m = c.materials;
  const plastic = c.coloredMaterial?.('#638987', m.whitePaint) ?? m.whitePaint;
  if (key === 'fit_toilet_roll') {
    p.lathe([[.14, 0], [.5, 0], [.5, 1], [.14, 1], [.14, 0]], m.whitePaint, 'Paper');
    p.lathe([[.13, 0], [.14, 0], [.14, 1], [.13, 1], [.13, 0]], m.woodLight, 'Cardboard Core');
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
