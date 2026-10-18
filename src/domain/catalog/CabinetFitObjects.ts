import type { AssetDefinition } from './AssetDefinition';
export const CABINET_FIT_OBJECTS: readonly AssetDefinition[] = [
  ['fit_toilet_roll', 'Toilet Paper Roll', .12, .10, .12],
  ['fit_detergent', 'Laundry Detergent Bottle', .15, .30, .09],
  ['fit_spray_bottle', 'Cleaning Spray Bottle', .10, .28, .07],
  ['fit_bucket', 'Cleaning Bucket', .30, .28, .30],
  ['fit_mop', 'Long-Handle Mop', .28, 1.40, .12],
  ['fit_flat_mop', 'Microfibre Flat Mop', .42, 1.40, .13],
  ['fit_mop_set', 'Flat Mop and Wringer Bucket Set', .38, 1.40, .30],
  ['fit_spin_mop_set', 'Spin Mop and Bucket Set', .50, 1.40, .30],
].map(([key, name, x, y, z]) => ({ key: key as string, name: name as string, category: 'decor', collection: 'Cabinet fit objects', recipe: 'cabinet_fit_object', aliases: key === 'fit_mop_set' ? ['vileda', 'vileda flat mop'] : key === 'fit_spin_mop_set' ? ['vileda turbo', 'vileda spin mop', 'rotating mop'] : undefined, defaultDimensions: { x: x as number, y: y as number, z: z as number }, placement: { mount: 'floor' }, source: { retailer: 'Generic' } }));
