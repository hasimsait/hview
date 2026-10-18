import type { AssetDefinition } from './AssetDefinition';

export interface FloorDrainModel { style: 'square' | 'round' | 'linear' | 'tile_insert'; color: string; }
function drain(key: string, name: string, style: FloorDrainModel['style'], color: string, width: number, depth: number, description: string): AssetDefinition {
  return { key: `drain_${key}`, name, category: 'bathroom', collection: 'Floor drains', recipe: 'floor_drain',
    floorDrain: { style, color }, defaultDimensions: { x: width, y: .006, z: depth }, placement: { mount: 'floor' },
    capabilities: { resizable: true }, description,
    source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: 'Adjustable visible drain cover, 6 mm high. Position at floor level; concealed pipework is not modelled.' },
  };
}
export const FLOOR_DRAINS: readonly AssetDefinition[] = [
  drain('square_steel', 'Square Stainless Steel Floor Drain', 'square', '#b9bdc2', .10, .10, 'Square metal rim and slotted grate over a dark inlet.'),
  drain('round_steel', 'Round Stainless Steel Floor Drain', 'round', '#b9bdc2', .10, .10, 'Circular rim with a clipped slotted grate and dark inlet.'),
  drain('linear_steel', 'Linear Stainless Steel Shower Drain', 'linear', '#b9bdc2', .80, .07, 'Long shower channel with a removable transverse slotted grate.'),
  drain('linear_black', 'Linear Shower Drain — Matte Black', 'linear', '#25272b', .80, .07, 'Matte black linear channel with a slotted grate and narrow border.'),
  drain('tile_insert', 'Tile-Insert Linear Shower Drain', 'tile_insert', '#b9bdc2', .80, .08, 'Recessed tile insert inside a metal frame, with an open drainage gap around the insert. Change the tile finish independently.'),
];
