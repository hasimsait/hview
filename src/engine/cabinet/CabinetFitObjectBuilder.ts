import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { accessoryParts } from '../assets/builders/IkeaAccessoryBuilder';
export function buildCabinetFitObject(c: AssetBuildContext): void {
  const p = accessoryParts(c), key = c.entity.assetKey, m = c.materials;
  const plastic = c.coloredMaterial?.('#638987', m.whitePaint) ?? m.whitePaint;
  if (key === 'fit_toilet_roll') {
    p.lathe([[.14, 0], [.5, 0], [.5, 1], [.14, 1], [.14, 0]], m.whitePaint, 'Paper');
    p.lathe([[.13, 0], [.14, 0], [.14, 1], [.13, 1], [.13, 0]], m.woodLight, 'Cardboard Core');
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
