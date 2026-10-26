/** Procedural kitchenware geometry; dimensions remain on the asset definition. */
export type KitchenwareKind = 'plate' | 'bowl' | 'glass' | 'mug' | 'stemware' | 'bottle'
  | 'jug' | 'teapot' | 'french_press' | 'jar' | 'food_container' | 'lid'
  | 'pan' | 'pot' | 'oven_dish' | 'baking_tin' | 'board' | 'utensil' | 'grater'
  | 'colander' | 'cutlery_tray' | 'shelf_insert' | 'plate_rack' | 'lid_rack'
  | 'storage_box' | 'bottle_rack' | 'dish_rack' | 'set' | 'mortar' | 'funnel'
  | 'rolling_pin' | 'scale' | 'thermometer' | 'juicer' | 'salad_spinner' | 'ice_tray' | 'brush'
  | 'scissors' | 'garlic_press' | 'bag' | 'textile' | 'packet' | 'mill'
  | 'knife_block' | 'cutlery_stand' | 'serving_stand' | 'rail' | 'hook'
  | 'wall_shelf' | 'bin' | 'basket' | 'coaster' | 'clip' | 'cutter' | 'rack' | 'roll_holder' | 'splatter_screen' | 'cap';

export interface KitchenwareModel {
  kind: KitchenwareKind;
  color: string;
  material: 'ceramic' | 'glass' | 'steel' | 'plastic' | 'wood' | 'fabric' | 'stone' | 'cork';
  lidMaterial?: KitchenwareModel['material'];
  lidColor?: string;
  withLid?: boolean;
  round?: boolean;
  coated?: boolean;
  transparent?: boolean;
  matte?: boolean;
  bodyHeightRatio?: number;
  bodyWidthRatio?: number;
  style?: 'loaf' | 'muffin' | 'tart' | 'raised' | 'lazy_susan' | 'spoon' | 'fork' | 'knife'
    | 'turner' | 'ladle' | 'whisk' | 'tongs' | 'scoop' | 'masher' | 'can_opener' | 'slicer' | 'skimmer' | 'infuser'
    | 'rod' | 'corner' | 'peeler' | 'corkscrew' | 'tenderizer' | 'pastry_brush' | 'box' | 'mitt' | 'napkins' | 'folded' | 'mat';
  tiers?: number;
  columns?: number;
  rows?: number;
  /** Repeated nested dishes share one prototype rather than one draw per piece. */
  count?: number;
  stackStep?: number;
  /** Component sizes and positions are fractions of the parent W × D × H envelope. */
  components?: readonly { model: KitchenwareModel; size: [number, number, number]; at: [number, number, number] }[];
}
