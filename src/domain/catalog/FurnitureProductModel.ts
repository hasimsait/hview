/** Bundled planning geometry for sourced retail furniture, separate from retailer metadata. */
export type FurnitureProductKind = 'bookcase' | 'desk' | 'wardrobe' | 'coffee_table'
  | 'sofa' | 'armchair' | 'tv_stand' | 'bedside' | 'shoe_cabinet' | 'shoe_bench'
  | 'sideboard' | 'dining_chair' | 'floor_lamp' | 'washer' | 'bed';

export interface FurnitureProductModel {
  kind: FurnitureProductKind;
  style?: string;
  color?: string;
  accentColor?: string;
  fabricColor?: string;
  material?: 'paint' | 'wood' | 'fabric';
  shelves?: number;
  columns?: number;
  doors?: number;
  drawers?: number;
  seats?: number;
  mirrored?: boolean;
  ringBack?: boolean;
}
