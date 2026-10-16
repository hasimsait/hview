import type { FurnitureBehavior } from './AssetDefinition';

export interface AssetRecipe { readonly id: string; readonly aliases: readonly string[]; readonly behavior: FurnitureBehavior; }

export const ASSET_RECIPES = [
  { id: 'architectural_finish', aliases: [], behavior: 'standard' },
  { id: 'retail_furniture', aliases: [], behavior: 'standard' },
  { id: 'bathroom_accessory', aliases: [], behavior: 'standard' },
  { id: 'electrical_fitting', aliases: [], behavior: 'standard' },
  { id: 'robot_vacuum', aliases: [], behavior: 'standard' },
  { id: 'air_purifier', aliases: [], behavior: 'standard' },
  { id: 'ikea_accessory', aliases: [], behavior: 'standard' },
  { id: 'angled_range_hood', aliases: [], behavior: 'standard' },
  { id: 'gas_cooktop', aliases: [], behavior: 'standard' },
  { id: 'built_in_oven', aliases: [], behavior: 'standard' },
  { id: 'soap_dispenser', aliases: [], behavior: 'standard' },
  { id: 'toothbrush_tumbler', aliases: [], behavior: 'standard' },
  { id: 'soap_dish', aliases: [], behavior: 'standard' },
  { id: 'pedal_bin', aliases: [], behavior: 'standard' },
  { id: 'brush_set', aliases: [], behavior: 'standard' },
  { id: 'paper_towel_holder', aliases: [], behavior: 'standard' },
  { id: 'curtain_pelmet', aliases: [], behavior: 'standard' },
  { id: 'hemnes_bookcase', aliases: [], behavior: 'shelving' },
  { id: 'billy_bookcase', aliases: [], behavior: 'shelving' },
  {
    "id": "chandelier",
    "aliases": [
      "chandelier_ring"
    ],
    "behavior": "luminaire"
  },
  {
    "id": "chandelier_cascading",
    "aliases": [],
    "behavior": "luminaire"
  },
  {
    "id": "ceiling_spot",
    "aliases": [
      "cylinder_spot",
      "surface_spot",
      "spot_cylinder"
    ],
    "behavior": "luminaire"
  },
  {
    "id": "spotlight",
    "aliases": [
      "recessed_spot",
      "lightspot",
      "led_lamp",
      "ceiling_lamp"
    ],
    "behavior": "luminaire"
  },
  {
    "id": "wall_spot",
    "aliases": [
      "sconce"
    ],
    "behavior": "luminaire"
  },
  {
    "id": "vanity_sconce_80",
    "aliases": [
      "aplik_80",
      "vanity_sconce",
      "aplik",
      "vanity_light"
    ],
    "behavior": "luminaire"
  },
  {
    "id": "toilet",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "basin_cabinet_lower",
    "aliases": [
      "lower_basin_cabinet",
      "sink_box_floor",
      "basin_lower"
    ],
    "behavior": "basin"
  },
  {
    "id": "mirror_cabinet_upper",
    "aliases": [
      "upper_mirror_cabinet"
    ],
    "behavior": "standard"
  },
  {
    "id": "sink_susp",
    "aliases": [
      "sink"
    ],
    "behavior": "standard"
  },
  {
    "id": "shower_system",
    "aliases": [
      "shower"
    ],
    "behavior": "standard"
  },
  {
    "id": "fan_wall",
    "aliases": [
      "fan",
      "ventilation"
    ],
    "behavior": "standard"
  },
  {
    "id": "towel_rack",
    "aliases": [
      "towel_hooks"
    ],
    "behavior": "standard"
  },
  {
    "id": "single_towel_hook",
    "aliases": [
      "towel_hook",
      "hook_towel",
      "single_hook"
    ],
    "behavior": "standard"
  },
  {
    "id": "towel_bar",
    "aliases": [
      "towel_rail_single"
    ],
    "behavior": "standard"
  },
  {
    "id": "mirror",
    "aliases": [
      "backlit_mirror"
    ],
    "behavior": "standard"
  },
  {
    "id": "toilet_paper",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "toilet_brush",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "wastebin",
    "aliases": [
      "urn",
      "trash"
    ],
    "behavior": "standard"
  },
  {
    "id": "wall_recess",
    "aliases": [
      "recess",
      "girinti",
      "niche",
      "wall_niche",
      "shower_niche"
    ],
    "behavior": "recess"
  },
  {
    "id": "bed_double",
    "aliases": [
      "bed"
    ],
    "behavior": "standard"
  },
  {
    "id": "bed_single",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "sofa",
    "aliases": [
      "sofa_triple",
      "sofa_double",
      "ottoman",
      "ottoman_module_armrest"
    ],
    "behavior": "standard"
  },
  {
    "id": "chair",
    "aliases": [
      "dining_chair"
    ],
    "behavior": "standard"
  },
  {
    "id": "office_chair",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "table",
    "aliases": [
      "work_table",
      "desk",
      "coffee_table"
    ],
    "behavior": "standard"
  },
  {
    "id": "table_round",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "wardrobe",
    "aliases": [
      "ward_double",
      "ward_single",
      "closet"
    ],
    "behavior": "standard"
  },
  {
    "id": "kitchen_box",
    "aliases": [
      "kitchen_box_door_double",
      "kitchen_box_floor"
    ],
    "behavior": "standard"
  },
  {
    "id": "kitchen_box_wall",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "kitchen_sink",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "fridge",
    "aliases": [
      "refrigerator"
    ],
    "behavior": "standard"
  },
  {
    "id": "suspended_hood",
    "aliases": [
      "range_hood"
    ],
    "behavior": "standard"
  },
  {
    "id": "tv",
    "aliases": [
      "smart_tv"
    ],
    "behavior": "standard"
  },
  {
    "id": "washing_machine",
    "aliases": [
      "dryer_over_washing",
      "washer",
      "dryer"
    ],
    "behavior": "standard"
  },
  {
    "id": "fixture",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "generic_cabinet",
    "aliases": [],
    "behavior": "standard"
  },
  {
    "id": "open_shelving",
    "aliases": [
      "shelving",
      "shelf",
      "pencil_cabinet"
    ],
    "behavior": "shelving"
  }
] as const satisfies readonly AssetRecipe[];

export type AssetRecipeId = typeof ASSET_RECIPES[number]['id'];
