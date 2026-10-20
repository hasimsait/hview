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
  {
    key: 'water_treatment_unit', name: 'Cabinet Water Treatment Unit', category: 'appliance', collection: 'Water treatment', recipe: 'water_treatment_unit',
    description: 'Compact floor-standing water purifier / softener with a rounded white cabinet, black louvered hood and recessed front handle, based on the supplied photograph.',
    defaultDimensions: { x: .35, y: .67, z: .49 }, placement: { mount: 'floor' },
    aliases: ['water_purifier', 'water_softener', 'water_filter', 'water_treatment'],
    source: { retailer: 'Reference photograph', dimensions: 'reference', dimensionNotes: 'Photograph dimensions: 35 cm wide, 67 cm high and 49 cm deep.' },
  },
  {
    key: 'demirdokum_dt4_65l', name: 'Demirdokum DT4 65 L Storage Water Heater', category: 'appliance', collection: 'Water heating', recipe: 'storage_water_heater',
    description: 'Wall-mounted 65 L electric storage water heater with a white vertical tank, front control panel, rear brackets and hot/cold connections.',
    defaultDimensions: { x: .5, y: .72, z: .5 }, placement: { mount: 'wall', defaultElevation: 1.2, wallOffset: .251 },
    aliases: ['dt4', 'demirdokum_dt4', 'storage_water_heater', 'electric_water_heater', 'hot_water_tank'],
    source: { retailer: 'Demirdokum', productCode: 'DT4 65 L', dimensions: 'reference', dimensionNotes: 'User-supplied exterior size: 72 cm high, 50 cm wide and 50 cm deep. Exterior reference model.' },
  },
];
