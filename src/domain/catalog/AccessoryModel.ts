/** Product geometry data lives with the catalogue so exports need no remote models. */
export type AccessoryKind = 'vase' | 'plant_pot' | 'plant' | 'candlesticks' | 'lantern' | 'dish'
  | 'basket' | 'wire_basket' | 'storage_box' | 'magazine_file' | 'pen_cup' | 'trolley'
  | 'round_mirror' | 'rectangular_mirror' | 'picture_frame' | 'clock' | 'pegboard' | 'ledge'
  | 'spice_rack' | 'jar' | 'utensil_holder' | 'chopping_board' | 'soap_pump' | 'tumbler'
  | 'soap_dish' | 'brush' | 'bin' | 'cushion' | 'rug' | 'globe_lamp' | 'mushroom_lamp'
  | 'task_lamp' | 'floor_lamp' | 'pendant_lamp' | 'tray_table';

export interface AccessoryModel {
  kind: AccessoryKind;
  color: string;
  material?: 'paint' | 'glass' | 'wood' | 'metal' | 'fabric' | 'ceramic';
  accentColor?: string;
  style?: 'ribbed' | 'bottle' | 'rounded' | 'lidded' | 'fabric' | 'woven' | 'compartments' | 'grass' | 'bamboo' | 'orchid' | 'broadleaf' | 'saucer';
}
