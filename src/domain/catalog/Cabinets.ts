import type { AssetDefinition } from './AssetDefinition';
export const CABINET_ASSETS: readonly AssetDefinition[] = [
  ['cabinet_drawers_three', 'Three-Drawer Base Cabinet', .6, .8, .6, 1],
  ['cabinet_drawers_deep', 'Deep Pan Drawer Base Cabinet', .6, .8, .6, 1],
  ['cabinet_wardrobe_drawers', 'Wardrobe with Internal Pull-Out Drawers', .9, 2.1, .6, 2],
  ['cabinet_base_single', 'Single-Door Base Cabinet', .6, .8, .6, 1],
  ['cabinet_base_double', 'Double-Door Base Cabinet', .8, .8, .6, 2],
  ['cabinet_wall_single', 'Single-Door Wall Cabinet', .4, .7, .35, 1],
  ['cabinet_wall_double', 'Double-Door Wall Cabinet', .8, .7, .35, 2],
  ['cabinet_tall_single', 'Single-Door Tall Cabinet', .45, 1.9, .4, 1],
  ['cabinet_wardrobe', 'Double-Door Wardrobe Cabinet', .9, 2.1, .6, 2],
  ['cabinet_open', 'Open Cabinet', .6, 1.8, .4, 0],
  ['cabinet_laundry_tiltout', 'Tilt-Out Laundry Cabinet', .6, 1.9, .35, 2],
].map(([key, name, x, y, z, doors]) => ({ key: key as string, name: name as string, category: 'storage', collection: 'Modular cabinets', recipe: 'modular_cabinet', cabinetDoors: doors as 0 | 1 | 2,
  defaultDimensions: { x: x as number, y: y as number, z: z as number }, placement: { mount: String(key).includes('_wall_') ? 'wall' : 'floor', defaultElevation: String(key).includes('_wall_') ? 1.4 : 0 },
  description: 'Editable cabinet with opening doors, connected shelves, partial dividers and stored objects. Open Edit layout to customise the interior.', source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: '18 mm carcass and doors, independently adjustable back thickness. Dimensions include closed doors.' } }));
export function cabinetDoorCount(asset: AssetDefinition | undefined): 0 | 1 | 2 | undefined {
  if (!asset) return undefined;
  if (asset.cabinetDoors !== undefined) return asset.cabinetDoors;
  if (['mirror_cabinet_upper', 'ward_double', 'kitchen_box_door_double', 'kitchen_box_wall'].includes(asset.key)) return 2;
  if (asset.key === 'ward_single') return 1;
  if (['open_shelving', 'hemnes_bookcase', 'billy_bookcase'].includes(asset.recipe ?? asset.key) || asset.key.startsWith('hemnes_') || asset.key.startsWith('billy_')) return 0;
  if (asset.furnitureProduct && ['wardrobe', 'bookcase', 'sideboard', 'bedside', 'shoe_cabinet'].includes(asset.furnitureProduct.kind) && (asset.furnitureProduct.doors ?? 0) <= 2) return (asset.furnitureProduct.doors ?? 0) as 0 | 1 | 2;
  return undefined;
}
