/** Local planning geometry; no product models or textures are fetched at runtime. */
export type BathroomKind = 'caddy' | 'wall_shelf' | 'rail' | 'towel_ring' | 'swivel_rail' | 'freestanding_rail'
  | 'hooks' | 'door_hooks' | 'roll_holder' | 'pump_holder' | 'handshower_bracket'
  | 'shower_head' | 'shower_kit' | 'shower_system' | 'hose' | 'tap' | 'curtain'
  | 'curtain_rod' | 'curtain_ring' | 'towel' | 'squeegee' | 'mirror_arm' | 'stool'
  | 'bathroom_set' | 'box_set' | 'laundry_basket' | 'hanging_storage' | 'shelving';

export interface BathroomModel {
  kind: BathroomKind;
  color: string;
  accentColor?: string;
  tiers?: number;
  count?: number;
  sprays?: number;
  corner?: boolean;
  wire?: boolean;
  suction?: boolean;
  glass?: boolean;
  pattern?: 'plain' | 'stripes' | 'dots';
}
