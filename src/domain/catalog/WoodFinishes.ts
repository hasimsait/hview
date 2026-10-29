export interface WoodFinish {
  id: string;
  name: string;
  subtitle: string;
  type: 'wood';
  variant: string;
  imageUrl: string;
  color: string;
  roughness: number;
  /** Remap the source photo to this base tone while retaining its relative grain. */
  matchTone?: boolean;
}

/** Existing light finishes retain their original photo colours. Dark finishes
 * carry their final colour in the texture, with no second material tint. */
export const FURNITURE_WOOD_FINISHES: readonly WoodFinish[] = [
  { id: 'light_beige_laminate', name: 'Light Beige Wood-Effect Laminate', subtitle: 'Kitchen photo reference · fine horizontal printed grain', type: 'wood', variant: 'light_beige_laminate', imageUrl: '/textures/wood/wood_light_beige_laminate.jpg', color: '#ffffff', roughness: .65 },
  { id: 'natural_oak', name: 'Natural Scandinavian Oak', subtitle: 'Golden blonde natural grain veneer', type: 'wood', variant: 'natural_oak', imageUrl: '/textures/wood/wood_natural_oak.jpg', color: '#dfcbaf', roughness: .45 },
  { id: 'american_walnut', name: 'American Walnut', subtitle: 'Rich dark chocolate wood veneer', type: 'wood', variant: 'american_walnut', imageUrl: '/textures/wood/wood_american_walnut.jpg', color: '#543f31', roughness: .45, matchTone: true },
  { id: 'golden_teak', name: 'Golden Teak', subtitle: 'Warm amber tropical hardwood veneer', type: 'wood', variant: 'golden_teak', imageUrl: '/textures/wood/wood_golden_teak.jpg', color: '#946132', roughness: .45 },
  { id: 'smoked_walnut', name: 'Smoked Walnut', subtitle: 'Deep charcoal-smoked walnut veneer', type: 'wood', variant: 'smoked_walnut', imageUrl: '/textures/wood/wood_smoked_walnut.jpg', color: '#42362f', roughness: .50, matchTone: true },
  { id: 'dark_wenge', name: 'Dark Wenge', subtitle: 'Near-black exotic espresso hardwood', type: 'wood', variant: 'dark_wenge', imageUrl: '/textures/wood/wood_dark_wenge.jpg', color: '#27201b', roughness: .50, matchTone: true },
  { id: 'deep_chocolate_walnut', name: 'Deep Chocolate Walnut', subtitle: 'Deep warm brown with walnut grain', type: 'wood', variant: 'deep_chocolate_walnut', imageUrl: '/textures/wood/wood_american_walnut.jpg', color: '#39241a', roughness: .50, matchTone: true },
  { id: 'espresso_walnut', name: 'Espresso Walnut', subtitle: 'Very dark coffee brown with walnut grain', type: 'wood', variant: 'espresso_walnut', imageUrl: '/textures/wood/wood_smoked_walnut.jpg', color: '#281a14', roughness: .50, matchTone: true },
  { id: 'black_brown_wood', name: 'Black-Brown Wood', subtitle: 'Near-black brown with fine straight grain', type: 'wood', variant: 'black_brown_wood', imageUrl: '/textures/wood/wood_dark_wenge.jpg', color: '#1b1410', roughness: .50, matchTone: true },
  { id: 'bleached_birch', name: 'Bleached Birch', subtitle: 'Light Scandinavian blonde birch veneer', type: 'wood', variant: 'bleached_birch', imageUrl: '/textures/wood/wood_bleached_birch.jpg', color: '#dfcfb6', roughness: .45 },
  { id: 'light_ash', name: 'Light Ash', subtitle: 'Pale neutral linear ash grain veneer', type: 'wood', variant: 'light_ash', imageUrl: '/textures/wood/wood_light_ash.jpg', color: '#d4cbbe', roughness: .45 },
];

export function woodFinish(variant?: string): WoodFinish | undefined {
  return FURNITURE_WOOD_FINISHES.find(finish => finish.variant === variant?.toLowerCase());
}
