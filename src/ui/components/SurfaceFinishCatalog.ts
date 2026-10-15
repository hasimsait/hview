import type { SurfaceFinishConfig, TileLayoutPattern } from '@core/types/plan';

export const TILE_LAYOUT_PATTERNS: { id: TileLayoutPattern; label: string; description: string }[] = [
  { id: 'grid', label: 'Grid', description: 'Stack bond aligned grid' },
  { id: 'running_bond', label: 'Running Bond', description: 'Staggered 50% brick bond' },
  { id: 'diagonal_herringbone', label: 'Diagonal Herringbone', description: '45° classic diagonal subway / decor layout' },
  { id: 'herringbone', label: '90° Herringbone', description: 'Perpendicular interlocking rectangular tiles' },
  { id: 'french_pattern', label: 'French Pattern', description: 'Versailles modular non-aligned stone pattern' },
  { id: 'vertical_stack', label: 'Vertical Stack', description: 'Aligned upright tile columns' },
];

export const GROUT_COLORS = [
  { id: 'white', name: 'Pure White', hex: '#ffffff' },
  { id: 'super_white', name: 'Bright White', hex: '#f8fafc' },
  { id: 'ivory', name: 'Alabaster Ivory', hex: '#f7f4ed' },
  { id: 'light_gray', name: 'Silver / Light Gray', hex: '#d1d5db' },
  { id: 'cement_gray', name: 'Cement Gray', hex: '#9ca3af' },
  { id: 'dark_gray', name: 'Slate / Dark Gray', hex: '#4b5563' },
  { id: 'anthracite', name: 'Anthracite', hex: '#27272a' },
  { id: 'black', name: 'Jet Black', hex: '#18181b' },
  { id: 'greige', name: 'Modern Greige', hex: '#d8d2c9' },
  { id: 'sand', name: 'Sand Dune', hex: '#d9cbba' },
  { id: 'terracotta', name: 'Terracotta', hex: '#b36d5e' },
  { id: 'sage', name: 'Sage Olive', hex: '#7d8a7c' },
  { id: 'navy', name: 'Midnight Navy', hex: '#1e293b' },
  { id: 'burgundy', name: 'Burgundy', hex: '#831843' },
  { id: 'dusty_rose', name: 'Dusty Rose', hex: '#c99292' },
  { id: 'blue', name: 'Coastal Blue', hex: '#2563eb' },
];

export interface SurfaceFinishPickerProps {
  currentFinish?: SurfaceFinishConfig;
  onSelectFinish: (finish: SurfaceFinishConfig) => void;
  onClearFinish?: () => void;
  showCeilingsTab?: boolean;
  defaultTab?: TabType;
}

export type TabType = 'paint' | 'lambri' | 'tile' | 'glass' | 'metal' | 'ceiling' | 'fabric';

export interface PaintCategory {
  id: string;
  name: string;
  colors: { name: string; hex: string }[];
}

export const PAINT_CATEGORIES: PaintCategory[] = [
  {
    id: 'all',
    name: 'All (100)',
    colors: [],
  },
  {
    id: 'whites',
    name: 'Whites & Off-Whites (15)',
    colors: [
      { name: 'Chantilly Lace', hex: '#fbfbf9' },
      { name: 'Simply White', hex: '#f7f6ef' },
      { name: 'White Dove', hex: '#f3f1ea' },
      { name: 'Swiss Coffee', hex: '#f1ede3' },
      { name: 'Alabaster', hex: '#f0ece2' },
      { name: 'Greek Villa', hex: '#f0ece1' },
      { name: 'Pure White', hex: '#ffffff' },
      { name: 'Oxford White', hex: '#f5f5f1' },
      { name: 'Super White', hex: '#f8fafc' },
      { name: 'Cloud White', hex: '#f4f2e9' },
      { name: 'Pale Oak', hex: '#e9e4dc' },
      { name: 'Linen White', hex: '#f6f1e5' },
      { name: 'School House White', hex: '#eee9dd' },
      { name: 'All White', hex: '#fdfdfc' },
      { name: 'Wimborne White', hex: '#fbf8f0' },
    ],
  },
  {
    id: 'neutrals',
    name: 'Greiges & Neutrals (15)',
    colors: [
      { name: 'Revere Pewter', hex: '#ccc7b9' },
      { name: 'Agreeable Gray', hex: '#d1cbc1' },
      { name: 'Edgecomb Gray', hex: '#ded8cc' },
      { name: 'Repose Gray', hex: '#ccc8c0' },
      { name: 'Accessible Beige', hex: '#d4ccbf' },
      { name: 'Balanced Beige', hex: '#c8beae' },
      { name: 'Pashmina', hex: '#b7aea2' },
      { name: 'Collingwood', hex: '#d9d4cc' },
      { name: 'Manchester Tan', hex: '#ded3be' },
      { name: 'Pale Smoke', hex: '#c5cdc8' },
      { name: 'Modern Gray', hex: '#d8d2c9' },
      { name: 'Gossamer Veil', hex: '#d8d4cb' },
      { name: "Elephant's Breath", hex: '#c8bfb8' },
      { name: 'Skimming Stone', hex: '#ddd7ce' },
      { name: "Joa's White", hex: '#d4c7b5' },
    ],
  },
  {
    id: 'earth',
    name: 'Earth & Clay (14)',
    colors: [
      { name: 'Terracotta Clay', hex: '#b36d5e' },
      { name: 'Burnt Sienna', hex: '#934d3f' },
      { name: 'Setting Plaster', hex: '#dfb8a7' },
      { name: 'Red Earth', hex: '#a65946' },
      { name: 'Baked Earth', hex: '#c4785a' },
      { name: 'Desert Dune', hex: '#cfb997' },
      { name: 'Raw Umber', hex: '#735843' },
      { name: 'Warm Ochre', hex: '#c9975b' },
      { name: 'Dusty Peach', hex: '#d8a48f' },
      { name: 'Cinnamon Spice', hex: '#8c5847' },
      { name: 'Foxy Terracotta', hex: '#9d5341' },
      { name: 'Tuscan Sun', hex: '#d9a752' },
      { name: 'Amber Glow', hex: '#c88647' },
      { name: 'Caramel Warmth', hex: '#a4683c' },
    ],
  },
  {
    id: 'botanical',
    name: 'Botanical Greens (14)',
    colors: [
      { name: 'Evergreen Fog', hex: '#969e92' },
      { name: 'Clary Sage', hex: '#a7ada1' },
      { name: 'Rosemary', hex: '#586355' },
      { name: 'Sage Olive', hex: '#7d8a7c' },
      { name: 'Muted Eucalyptus', hex: '#94a395' },
      { name: 'Deep Forest', hex: '#2d4a3e' },
      { name: 'Laurel Green', hex: '#607262' },
      { name: 'Green Smoke', hex: '#6f7e77' },
      { name: 'Spanish Olive', hex: '#70735d' },
      { name: 'Peale Green', hex: '#3e4e43' },
      { name: 'Bancha Green', hex: '#4f573e' },
      { name: 'Mint Cream', hex: '#d6e5db' },
      { name: 'Olive Branch', hex: '#5a6349' },
      { name: 'Lichen Green', hex: '#8a9482' },
    ],
  },
  {
    id: 'coastal',
    name: 'Coastal Blues (14)',
    colors: [
      { name: 'Hale Navy', hex: '#2b343d' },
      { name: 'Naval', hex: '#1e2d3d' },
      { name: "Gentleman's Gray", hex: '#26343d' },
      { name: 'De Nimes', hex: '#566a77' },
      { name: 'Newburyport Blue', hex: '#354b5e' },
      { name: 'Stiffkey Blue', hex: '#2c3e4c' },
      { name: 'Midnight Navy', hex: '#1e293b' },
      { name: 'Nordic Blue', hex: '#526b7c' },
      { name: 'Slate Blue', hex: '#3b4e61' },
      { name: 'Powder Sky', hex: '#b8cde3' },
      { name: 'Deep Ocean', hex: '#162a3f' },
      { name: 'Dusty Denim', hex: '#4d647d' },
      { name: 'Pigeon Blue', hex: '#6b7a82' },
      { name: 'Aegean Teal', hex: '#4a6b6c' },
    ],
  },
  {
    id: 'monochrome',
    name: 'Charcoals & Blacks (14)',
    colors: [
      { name: 'Iron Ore', hex: '#333434' },
      { name: 'Kendall Charcoal', hex: '#4c4e4d' },
      { name: 'Peppercorn', hex: '#484747' },
      { name: 'Wrought Iron', hex: '#363737' },
      { name: 'Railings', hex: '#26292b' },
      { name: 'Off-Black', hex: '#232426' },
      { name: 'Down Pipe', hex: '#464b4c' },
      { name: 'Tricorn Black', hex: '#1c1c1c' },
      { name: 'Urbane Bronze', hex: '#48443f' },
      { name: 'Cheating Heart', hex: '#34383a' },
      { name: 'Witching Hour', hex: '#2b2e32' },
      { name: 'Slate Grey', hex: '#71717a' },
      { name: 'Anthracite', hex: '#3f3f46' },
      { name: 'Pitch Black', hex: '#18181b' },
    ],
  },
  {
    id: 'pastels',
    name: 'Pastels & Accents (14)',
    colors: [
      { name: 'Sulking Room Pink', hex: '#9d7c77' },
      { name: 'Calamine', hex: '#e5d1cb' },
      { name: 'First Light', hex: '#f3e6e1' },
      { name: 'Intimate White', hex: '#ede0dc' },
      { name: 'Dusty Rose', hex: '#c99292' },
      { name: 'French Lavender', hex: '#9e9ab8' },
      { name: 'Muted Lilac', hex: '#b0a7ba' },
      { name: 'Sea Salt', hex: '#cdd3cc' },
      { name: 'Quiet Moments', hex: '#c9d2cd' },
      { name: 'Silver Mist', hex: '#cbd3d6' },
      { name: 'Soft Mustard', hex: '#dfbe7d' },
      { name: 'Warm Taupe', hex: '#9f8d83' },
      { name: 'Cashmere', hex: '#c2b6a6' },
      { name: 'Morning Sunshine', hex: '#f0d999' },
    ],
  },
  {
    id: 'metals',
    name: 'Hardware Metals (6)',
    colors: [
      { name: 'Polished Chrome', hex: '#f1f5f9' },
      { name: 'Satin Chrome', hex: '#e2e8f0' },
      { name: 'Polished Brass', hex: '#ebd48e' },
      { name: 'Brushed Brass', hex: '#d4b359' },
      { name: 'Matte Black Powder Coat', hex: '#18181b' },
      { name: 'Matte White Powder Coat', hex: '#f8fafc' },
    ],
  },
];

export const ALL_CURATED_PAINTS = PAINT_CATEGORIES.filter((c) => c.id !== 'all' && c.id !== 'metals').flatMap((c) => c.colors);

export const PLASTER_FINISHES = [
  { id: 'smooth', name: 'Smooth Venetian', type: 'plaster' as const, variant: 'smooth', color: '#eae6df', roughness: 0.8 },
  { id: 'stucco', name: 'Stucco Antico', type: 'plaster' as const, variant: 'stucco', color: '#e5e0d8', roughness: 0.95 },
  { id: 'limewash', name: 'Limewash Textured', type: 'plaster' as const, variant: 'limewash', color: '#e2ddd3', roughness: 0.9 },
];

export const FURNITURE_WOOD_FINISHES = [
  {
    id: 'natural_oak',
    name: 'Natural Scandinavian Oak',
    subtitle: 'Golden blonde natural grain veneer',
    type: 'wood' as const,
    variant: 'natural_oak',
    imageUrl: '/textures/wood/wood_natural_oak.jpg',
    color: '#dfcbaf',
    roughness: 0.45,
  },
  {
    id: 'american_walnut',
    name: 'American Walnut',
    subtitle: 'Rich dark chocolate wood veneer',
    type: 'wood' as const,
    variant: 'american_walnut',
    imageUrl: '/textures/wood/wood_american_walnut.jpg',
    color: '#543f31',
    roughness: 0.45,
  },
  {
    id: 'golden_teak',
    name: 'Golden Teak',
    subtitle: 'Warm amber tropical hardwood veneer',
    type: 'wood' as const,
    variant: 'golden_teak',
    imageUrl: '/textures/wood/wood_golden_teak.jpg',
    color: '#946132',
    roughness: 0.45,
  },
  {
    id: 'smoked_walnut',
    name: 'Smoked Walnut',
    subtitle: 'Deep charcoal-smoked walnut veneer',
    type: 'wood' as const,
    variant: 'smoked_walnut',
    imageUrl: '/textures/wood/wood_smoked_walnut.jpg',
    color: '#42362f',
    roughness: 0.50,
  },
  {
    id: 'dark_wenge',
    name: 'Dark Wenge',
    subtitle: 'Near-black exotic espresso hardwood',
    type: 'wood' as const,
    variant: 'dark_wenge',
    imageUrl: '/textures/wood/wood_dark_wenge.jpg',
    color: '#27201b',
    roughness: 0.50,
  },
  {
    id: 'bleached_birch',
    name: 'Bleached Birch',
    subtitle: 'Light Scandinavian blonde birch veneer',
    type: 'wood' as const,
    variant: 'bleached_birch',
    imageUrl: '/textures/wood/wood_bleached_birch.jpg',
    color: '#dfcfb6',
    roughness: 0.45,
  },
  {
    id: 'light_ash',
    name: 'Light Ash',
    subtitle: 'Pale neutral linear ash grain veneer',
    type: 'wood' as const,
    variant: 'light_ash',
    imageUrl: '/textures/wood/wood_light_ash.jpg',
    color: '#d4cbbe',
    roughness: 0.45,
  },
];

export const PARQUET_FINISHES = [
  { id: 'parquet_oak', name: 'Scandinavian Oak Parquet', type: 'wood' as const, variant: 'parquet_oak', color: '#dfcfb8', roughness: 0.35 },
  { id: 'parquet_walnut', name: 'Dark Walnut Plank Parquet', type: 'wood' as const, variant: 'parquet_walnut', color: '#3d2e24', roughness: 0.35 },
  { id: 'parquet_light', name: 'Bleached Ash Parquet', type: 'wood' as const, variant: 'parquet_light', color: '#f0ece1', roughness: 0.35 },
  { id: 'parquet_herringbone', name: 'Herringbone Oak Parquet', type: 'wood' as const, variant: 'parquet_herringbone', color: '#d4b896', roughness: 0.35 },
];

export const ACOUSTIC_SLAT_VARIANTS = [
  { id: 'oak_slats', name: 'Natural Oak Slats', variant: 'oak_slats', color: '#d4b996', woodName: 'Scandinavian Oak' },
  { id: 'walnut_slats', name: 'American Walnut Slats', variant: 'walnut_slats', color: '#543f31', woodName: 'Dark Walnut' },
  { id: 'teak_slats', name: 'Golden Teak Slats', variant: 'teak_slats', color: '#946132', woodName: 'Golden Teak' },
  { id: 'ash_slats', name: 'Smoked Ash Slats', variant: 'ash_slats', color: '#5a4e44', woodName: 'Smoked Ash' },
  { id: 'wenge_slats', name: 'Dark Wenge Slats', variant: 'wenge_slats', color: '#27201b', woodName: 'Dark Wenge' },
  { id: 'birch_slats', name: 'Bleached Birch Slats', variant: 'birch_slats', color: '#dfcfb6', woodName: 'Bleached Birch' },
  { id: 'white_slat', name: 'Crisp White Painted Slats', variant: 'white_slat', color: '#f8fafc', woodName: 'White Painted' },
  { id: 'fluted_panel', name: 'Sage Fluted Panel', variant: 'fluted_panel', color: '#3a4843', woodName: 'Sage Fluted' },
  { id: 'beadboard', name: 'Classic Beadboard', variant: 'beadboard', color: '#f5f5f4', woodName: 'White Beadboard' },
];

export const ACOUSTIC_BACKING_COLORS = [
  { id: 'black_felt', name: 'Matte Black Felt', hex: '#121212', subtitle: 'Standard high-contrast acoustic felt' },
  { id: 'charcoal_felt', name: 'Charcoal Graphite', hex: '#27272a', subtitle: 'Deep dark grey felt' },
  { id: 'slate_felt', name: 'Slate Grey Felt', hex: '#4b5563', subtitle: 'Neutral mid-grey acoustic backing' },
  { id: 'greige_felt', name: 'Warm Greige Felt', hex: '#d8d2c9', subtitle: 'Warm sand / linen tone backing' },
  { id: 'white_felt', name: 'Crisp White Felt', hex: '#ffffff', subtitle: 'Clean modern white backdrop' },
];


export const GLASS_FINISHES = [
  { id: 'frosted_mica', name: 'Frosted Mica Shower Panel', subtitle: 'Pebbled Translucent Acrylic Screen', type: 'glass' as const, variant: 'frosted_mica', color: '#f8fafc', opacity: 0.82 },
  { id: 'frosted', name: 'Frosted Privacy Glass', subtitle: 'Acid-Etched Satin Glass', type: 'glass' as const, variant: 'frosted', color: '#f1f5f9', opacity: 0.75 },
  { id: 'fluted', name: 'Fluted Reeded Glass', subtitle: 'Vertical Ribbed Architectural Glass', type: 'glass' as const, variant: 'fluted', color: '#e2e8f0', opacity: 0.70 },
  { id: 'smoked', name: 'Smoked Grey Glass', subtitle: 'Tinted Grey Privacy Glass', type: 'glass' as const, variant: 'smoked', color: '#334155', opacity: 0.60 },
  { id: 'clear', name: 'Architectural Clear Glass', subtitle: 'High-Transmission Transparent Glass', type: 'glass' as const, variant: 'clear', color: '#d8eeff', opacity: 0.35 },
];

export const CEILING_FINISHES = [
  { id: 'clip_in', name: 'Clip-in Modular 60x60', type: 'ceiling' as const, variant: 'clip_in', color: '#f1f5f9', roughness: 0.4 },
  { id: 'gypsum', name: 'Smooth Gypsum Board', type: 'ceiling' as const, variant: 'gypsum', color: '#f8fafc', roughness: 0.8 },
];

export const METAL_FINISHES = [
  {
    id: 'chrome_shiny',
    name: 'Polished Chrome',
    subtitle: 'Mirror Polished Silver',
    type: 'metal' as const,
    variant: 'chrome_shiny',
    color: '#f1f5f9',
    roughness: 0.06,
    metalness: 0.96,
    swatchBackground: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f1f5f9 45%, #cbd5e1 75%, #94a3b8 100%)',
  },
  {
    id: 'chrome_satin',
    name: 'Satin Chrome',
    subtitle: 'Brushed Stainless Finish',
    type: 'metal' as const,
    variant: 'chrome_satin',
    color: '#e2e8f0',
    roughness: 0.20,
    metalness: 0.90,
    swatchBackground: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 45%, #e2e8f0 75%, #cbd5e1 100%)',
  },
  {
    id: 'brass_shiny',
    name: 'Polished Brass',
    subtitle: 'Mirror Polished Warm Gold',
    type: 'metal' as const,
    variant: 'brass_shiny',
    color: '#ebd48e',
    roughness: 0.08,
    metalness: 0.92,
    swatchBackground: 'radial-gradient(circle at 35% 35%, #fffdf2 0%, #faeab8 40%, #ebd48e 70%, #c9a848 100%)',
  },
  {
    id: 'brass_brushed',
    name: 'Brushed Brass',
    subtitle: 'Satin Matte Gold Metal',
    type: 'metal' as const,
    variant: 'brass_brushed',
    color: '#d4b359',
    roughness: 0.26,
    metalness: 0.88,
    swatchBackground: 'linear-gradient(135deg, #faedc8 0%, #e5c875 45%, #d4b359 75%, #aa8828 100%)',
  },
  {
    id: 'matte_black_powder',
    name: 'Matte Black Powder Coat',
    subtitle: 'Electrostatic Matte Black Metal',
    type: 'metal' as const,
    variant: 'matte_black_powder',
    color: '#18181b',
    roughness: 0.70,
    metalness: 0.15,
    swatchBackground: 'linear-gradient(135deg, #27272a 0%, #18181b 100%)',
  },
  {
    id: 'matte_white_powder',
    name: 'Matte White Powder Coat',
    subtitle: 'Electrostatic Matte White Metal',
    type: 'metal' as const,
    variant: 'matte_white_powder',
    color: '#f8fafc',
    roughness: 0.70,
    metalness: 0.05,
    swatchBackground: 'linear-gradient(135deg, #ffffff 0%, #f4f4f5 100%)',
  },
  {
    id: 'gunmetal',
    name: 'Gunmetal Titanium',
    subtitle: 'Dark Charcoal Brushed Metallic',
    type: 'metal' as const,
    variant: 'gunmetal',
    color: '#334155',
    roughness: 0.24,
    metalness: 0.88,
    swatchBackground: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
  },
  {
    id: 'copper_brushed',
    name: 'Brushed Copper',
    subtitle: 'Rose Copper Satin Metal',
    type: 'metal' as const,
    variant: 'copper_brushed',
    color: '#c27852',
    roughness: 0.26,
    metalness: 0.88,
    swatchBackground: 'linear-gradient(135deg, #fed7aa 0%, #c27852 50%, #9a3412 100%)',
  },
];

export const PORCELAIN_FINISHES = [
  {
    id: 'porcelain_white',
    name: 'Gloss White Porcelain',
    subtitle: 'Glazed Sanitary Ceramic Ware',
    type: 'porcelain' as const,
    variant: 'porcelain_white',
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0.02,
    swatchBackground: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f8fafc 55%, #e2e8f0 100%)',
  },
  {
    id: 'porcelain_matte',
    name: 'Matte White Porcelain',
    subtitle: 'Honed Matte Sanitaryware',
    type: 'porcelain' as const,
    variant: 'porcelain_matte',
    color: '#f8fafc',
    roughness: 0.45,
    metalness: 0.02,
    swatchBackground: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
  },
];

export interface PhotographicFabricItem {
  id: string;
  name: string;
  subtitle: string;
  variant: string;
  color: string;
  photoUrl: string;
  tag?: string;
  mappingMode?: 'stretched' | 'tiled';
  scale?: number;
}

export const PHOTOGRAPHIC_FABRIC_COLLECTIONS: PhotographicFabricItem[] = [
  {
    id: 'velvet_ruby_red',
    name: 'Ruby Red Velvet',
    subtitle: 'Photographic Upholstery Velvet with Reflective Sheen',
    variant: 'velvet_ruby_red',
    color: '#8e1624',
    photoUrl: '/textures/fabrics/velvet_ruby_red.jpg',
    tag: 'Red Velvet',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_wine_burgundy',
    name: 'Wine Burgundy Velvet',
    subtitle: 'Photographic Deep Bordeaux Soft Sheen',
    variant: 'velvet_wine_burgundy',
    color: '#54121d',
    photoUrl: '/textures/fabrics/velvet_wine_burgundy.jpg',
    tag: 'Wine Velvet',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_emerald_green',
    name: 'Emerald Green Velvet',
    subtitle: 'Photographic Jewel Green Radiant Sheen',
    variant: 'velvet_emerald_green',
    color: '#0b6654',
    photoUrl: '/textures/fabrics/velvet_emerald_green.jpg',
    tag: 'Green Velvet',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_forest_green',
    name: 'Forest Botanical Velvet',
    subtitle: 'Photographic Dark Green Directional Sheen',
    variant: 'velvet_forest_green',
    color: '#1a3d2b',
    photoUrl: '/textures/fabrics/velvet_forest_green.jpg',
    tag: 'Green Velvet',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_royal_navy',
    name: 'Royal Sapphire Velvet',
    subtitle: 'Photographic Midnight Blue Specular Highlights',
    variant: 'velvet_royal_navy',
    color: '#1a2639',
    photoUrl: '/textures/fabrics/velvet_royal_navy.jpg',
    tag: 'Jewel Tone',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_champagne',
    name: 'Champagne Ivory Velvet',
    subtitle: 'Photographic Warm Silk Velvet Drapes',
    variant: 'velvet_champagne',
    color: '#ede6d6',
    photoUrl: '/textures/fabrics/velvet_champagne.jpg',
    tag: 'Neutral',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_charcoal',
    name: 'Charcoal Anthracite Velvet',
    subtitle: 'Photographic Dark Silver Luster Velvet',
    variant: 'velvet_charcoal',
    color: '#26282d',
    photoUrl: '/textures/fabrics/velvet_charcoal.jpg',
    tag: 'Monochrome',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'velvet_neutral_silver',
    name: 'Silver Mist Velvet',
    subtitle: 'Photographic Neutral Velvet (Reflective Folds)',
    variant: 'velvet_neutral_silver',
    color: '#a0a5ad',
    photoUrl: '/textures/fabrics/velvet_neutral_silver.jpg',
    tag: 'Custom Tint',
    mappingMode: 'stretched',
    scale: 1.0,
  },
  {
    id: 'linen_weave',
    name: 'Natural Woven Linen',
    subtitle: 'Photographic Organic Warp & Weft Threads (Tiled)',
    variant: 'linen_weave',
    color: '#d5cbbe',
    photoUrl: '/textures/fabrics/fabric_linen_weave.jpg',
    tag: 'Tiled Weave',
    mappingMode: 'tiled',
    scale: 3.5,
  },
];


export interface FabricColor {
  name: string;
  hex: string;
  variant?: string;
}

export interface FabricCategory {
  id: string;
  name: string;
  colors: FabricColor[];
}

export const FABRIC_CATEGORIES: FabricCategory[] = [
  {
    id: 'velvet_reds',
    name: 'Red & Burgundy Velvet',
    colors: [
      { name: 'Ruby Velvet', hex: '#8e1624', variant: 'velvet_ruby_red' },
      { name: 'Crimson Velvet', hex: '#a8202e', variant: 'velvet_ruby_red' },
      { name: 'Wine Burgundy Velvet', hex: '#54121d', variant: 'velvet_wine_burgundy' },
      { name: 'Terracotta Rust Velvet', hex: '#a84b39', variant: 'velvet_neutral_silver' },
      { name: 'Dusty Rose Velvet', hex: '#ba7979', variant: 'velvet_neutral_silver' },
      { name: 'Garnet Velvet', hex: '#731728', variant: 'velvet_ruby_red' },
    ],
  },
  {
    id: 'velvet_greens',
    name: 'Green & Botanical Velvet',
    colors: [
      { name: 'Emerald Velvet', hex: '#0b6654', variant: 'velvet_emerald_green' },
      { name: 'Forest Green Velvet', hex: '#1a3d2b', variant: 'velvet_forest_green' },
      { name: 'Sage Olive Velvet', hex: '#5f6f59', variant: 'velvet_neutral_silver' },
      { name: 'Deep Moss Velvet', hex: '#3a4d39', variant: 'velvet_neutral_silver' },
      { name: 'Midnight Jade Velvet', hex: '#163832', variant: 'velvet_emerald_green' },
      { name: 'Pine Needle Velvet', hex: '#234e3e', variant: 'velvet_forest_green' },
    ],
  },
  {
    id: 'velvet_neutrals',
    name: 'Neutrals & Jewel Tones',
    colors: [
      { name: 'Champagne Cream Velvet', hex: '#ede6d6', variant: 'velvet_champagne' },
      { name: 'Oatmeal Linen Velvet', hex: '#d5cbbe', variant: 'linen_weave' },
      { name: 'Warm Greige Velvet', hex: '#9e9587', variant: 'velvet_neutral_silver' },
      { name: 'Midnight Navy Velvet', hex: '#1a2639', variant: 'velvet_royal_navy' },
      { name: 'Royal Sapphire Velvet', hex: '#1e3a5f', variant: 'velvet_royal_navy' },
      { name: 'Charcoal Velvet', hex: '#26282d', variant: 'velvet_charcoal' },
    ],
  },
];

