import type { AssetBuildContext } from './AssetBuildContext';

/** Keep the product's default finish split in both its catalogue mesh and cabinet layout. */
export function bookcaseMaterials(c: AssetBuildContext) {
  const recipe = c.definition?.recipe;
  if (recipe !== 'hemnes_bookcase' && recipe !== 'billy_bookcase') return undefined;
  const hemnes = recipe === 'hemnes_bookcase', key = c.entity.assetKey, m = c.materials;
  const frame = !hemnes ? key.includes('walnut') ? m.billyWalnut : key.includes('oak') ? m.billyOak : m.billyWhite : key.includes('white') ? m.whitePaint : key.includes('black_brown') ? m.woodBlackBrown : m.woodLight;
  const interior = hemnes && key.includes('90_') && key.includes('light_brown') ? m.woodLight : frame;
  return { frame, back: interior, shelves: interior, top: interior };
}
