import type { AssetBuilderFn } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';

export const buildFloorDrain: AssetBuilderFn = c => {
  const model = c.definition?.floorDrain;
  if (!model) return;
  const p = accessoryParts(c), m = c.materials;
  const metal = c.coloredMaterial?.(model.color, m.whitePaint) ?? m.whitePaint;
  if (model.style === 'round') {
    p.cylinder(0, .4, 0, .49, .2, m.metalBlack, 'Inlet');
    p.lathe([[.5, 0], [.5, 1], [.39, 1], [.39, .2], [.49, .2], [.49, 0]], metal, 'Frame');
    for (let i = -4; i <= 4; i++) {
      const z = i * .075, halfWidth = Math.sqrt(.39 ** 2 - (Math.abs(z) + .016) ** 2);
      p.box(0, .8, z, halfWidth * 2, .4, .032, metal, 'Grate');
    }
    return;
  }
  p.box(0, .4, 0, 1, .2, 1, m.metalBlack, 'Inlet');
  const edgeX = Math.min(.004 / c.w, .08), edgeZ = Math.min(.004 / c.d, .08);
  for (const sign of [-1, 1]) {
    p.box(sign * (.5 - edgeX / 2), .5, 0, edgeX, 1, 1, metal, 'Frame');
    p.box(0, .5, sign * (.5 - edgeZ / 2), 1 - edgeX * 2, 1, edgeZ, metal, 'Frame');
  }
  if (model.style === 'tile_insert') {
    p.box(0, .6, 0, 1 - edgeX * 5, .75, 1 - edgeZ * 4, m.ceramicWhite, 'Tile Insert');
  } else {
    const count = model.style === 'square' ? 8 : Math.max(8, Math.min(80, Math.round(c.w / .018)));
    for (let i = 0; i < count; i++) {
      if (model.style === 'square') p.box(0, .8, -.5 + edgeZ + (i + .5) * (1 - edgeZ * 2) / count, 1 - edgeX * 2, .4, (1 - edgeZ * 2) / count * .4, metal, 'Grate');
      else p.box(-.5 + edgeX + (i + .5) * (1 - edgeX * 2) / count, .8, 0, (1 - edgeX * 2) / count * .4, .4, 1 - edgeZ * 2, metal, 'Grate');
    }
  }
};
