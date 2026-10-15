import type { AssetDefinition } from './AssetDefinition';

export const HOUSEHOLD_APPLIANCES: readonly AssetDefinition[] = [
  {
    key: 'robot_vacuum', name: 'Robot Vacuum with Charging Dock', category: 'appliance', collection: 'Cleaning appliances', recipe: 'robot_vacuum',
    description: 'Generic low-profile round robot vacuum with bumper, navigation sensor and charging dock. The vacuum and dock move together.',
    defaultDimensions: { x: .35, y: .15, z: .46 }, placement: { mount: 'floor' },
    aliases: ['robot-cleaner', 'robot_cleaner', 'robot-vacuum', 'robot_vacuum_cleaner'],
    source: { retailer: 'Generic', dimensions: 'estimated', dimensionNotes: 'Estimated combined footprint 35 × 46 cm and dock height 15 cm.' },
  },
  {
    key: 'air_purifier', name: 'Cylindrical Air Purifier — White', category: 'appliance', collection: 'Air treatment', recipe: 'air_purifier',
    description: 'Generic white cylindrical air purifier with perforated air intake, top outlet grille and control panel.',
    defaultDimensions: { x: .3, y: .6, z: .3 }, placement: { mount: 'floor' },
    aliases: ['bactericidal_air_recirculator', 'air-cleaner', 'air_cleaner', 'air-purifier'],
    source: { retailer: 'Generic', dimensions: 'estimated', dimensionNotes: 'Generic planning size: 30 cm diameter and 60 cm height.' },
  },
];
