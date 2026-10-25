/** Procedural kitchenware geometry; dimensions remain on the asset definition. */
export type KitchenwareKind = 'plate' | 'bowl' | 'glass' | 'mug' | 'stemware' | 'bottle'
  | 'jug' | 'teapot' | 'french_press' | 'jar' | 'food_container' | 'lid'
  | 'pan' | 'pot' | 'oven_dish' | 'baking_tin' | 'board' | 'utensil' | 'grater'
  | 'colander' | 'cutlery_tray' | 'shelf_insert' | 'plate_rack' | 'lid_rack'
  | 'storage_box' | 'bottle_rack' | 'dish_rack';

export interface KitchenwareModel {
  kind: KitchenwareKind;
  color: string;
  material: 'ceramic' | 'glass' | 'steel' | 'plastic' | 'wood';
  lidMaterial?: KitchenwareModel['material'];
  lidColor?: string;
  withLid?: boolean;
  round?: boolean;
  coated?: boolean;
  style?: 'loaf' | 'muffin' | 'tart' | 'raised' | 'lazy_susan' | 'spoon' | 'fork' | 'knife'
    | 'turner' | 'ladle' | 'whisk' | 'tongs' | 'scoop' | 'masher' | 'can_opener' | 'slicer' | 'skimmer' | 'infuser';
}
