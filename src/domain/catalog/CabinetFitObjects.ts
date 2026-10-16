import type { AssetDefinition } from './AssetDefinition';
export const CABINET_FIT_OBJECTS: readonly AssetDefinition[] = [
  ['fit_toilet_roll', 'Toilet Paper Roll', .12, .10, .12],
  ['fit_detergent', 'Laundry Detergent Bottle', .15, .30, .09],
  ['fit_spray_bottle', 'Cleaning Spray Bottle', .10, .28, .07],
  ['fit_bucket', 'Cleaning Bucket', .30, .28, .30],
  ['fit_mop', 'Long-Handle Mop', .28, 1.40, .12],
].map(([key, name, x, y, z]) => ({ key: key as string, name: name as string, category: 'decor', collection: 'Cabinet fit objects', recipe: 'cabinet_fit_object', defaultDimensions: { x: x as number, y: y as number, z: z as number }, placement: { mount: 'floor' }, description: 'Generic household object with editable physical dimensions for cabinet fit checks.', source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: 'Reference size. Measure your actual object and adjust its dimensions for a fit check.' } }));
