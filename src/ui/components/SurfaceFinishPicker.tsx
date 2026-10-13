import React, { useState, useEffect } from 'react';
import { SurfaceFinishConfig, TileLayoutPattern } from '@core/types/plan';
import { Paintbrush, Layers, Grid, Sparkles, Check, RotateCcw, RotateCw, Disc, EyeOff, Palette, Pipette, Search } from 'lucide-react';
import { useService } from '@ui/context/useService';
import { TOKENS } from '@core/di/tokens';
import type { ITileCatalogService, TileEntry } from '@core/types/services';
// Fast Refresh enabled: component only exports SurfaceFinishPicker

const TILE_LAYOUT_PATTERNS: { id: TileLayoutPattern; label: string; description: string }[] = [
  { id: 'grid', label: 'Grid', description: 'Stack bond aligned grid' },
  { id: 'running_bond', label: 'Running Bond', description: 'Staggered 50% brick bond' },
  { id: 'diagonal_herringbone', label: 'Diagonal Herringbone', description: '45° classic diagonal subway / decor layout' },
  { id: 'herringbone', label: '90° Herringbone', description: 'Perpendicular interlocking rectangular tiles' },
  { id: 'french_pattern', label: 'French Pattern', description: 'Versailles modular non-aligned stone pattern' },
  { id: 'vertical_stack', label: 'Vertical Stack', description: 'Aligned upright tile columns' },
];

const GROUT_COLORS = [
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

interface SurfaceFinishPickerProps {
  currentFinish?: SurfaceFinishConfig;
  onSelectFinish: (finish: SurfaceFinishConfig) => void;
  onClearFinish?: () => void;
  showCeilingsTab?: boolean;
  defaultTab?: TabType;
}

type TabType = 'paint' | 'lambri' | 'tile' | 'glass' | 'metal' | 'ceiling' | 'fabric';

interface PaintCategory {
  id: string;
  name: string;
  colors: { name: string; hex: string }[];
}

const PAINT_CATEGORIES: PaintCategory[] = [
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

const ALL_CURATED_PAINTS = PAINT_CATEGORIES.filter((c) => c.id !== 'all' && c.id !== 'metals').flatMap((c) => c.colors);

const PLASTER_FINISHES = [
  { id: 'smooth', name: 'Smooth Venetian', type: 'plaster' as const, variant: 'smooth', color: '#eae6df', roughness: 0.8 },
  { id: 'stucco', name: 'Stucco Antico', type: 'plaster' as const, variant: 'stucco', color: '#e5e0d8', roughness: 0.95 },
  { id: 'limewash', name: 'Limewash Textured', type: 'plaster' as const, variant: 'limewash', color: '#e2ddd3', roughness: 0.9 },
];

const FURNITURE_WOOD_FINISHES = [
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

const PARQUET_FINISHES = [
  { id: 'parquet_oak', name: 'Scandinavian Oak Parquet', type: 'wood' as const, variant: 'parquet_oak', color: '#dfcfb8', roughness: 0.35 },
  { id: 'parquet_walnut', name: 'Dark Walnut Plank Parquet', type: 'wood' as const, variant: 'parquet_walnut', color: '#3d2e24', roughness: 0.35 },
  { id: 'parquet_light', name: 'Bleached Ash Parquet', type: 'wood' as const, variant: 'parquet_light', color: '#f0ece1', roughness: 0.35 },
  { id: 'parquet_herringbone', name: 'Herringbone Oak Parquet', type: 'wood' as const, variant: 'parquet_herringbone', color: '#d4b896', roughness: 0.35 },
];

const ACOUSTIC_SLAT_VARIANTS = [
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

const ACOUSTIC_BACKING_COLORS = [
  { id: 'black_felt', name: 'Matte Black Felt', hex: '#121212', subtitle: 'Standard high-contrast acoustic felt' },
  { id: 'charcoal_felt', name: 'Charcoal Graphite', hex: '#27272a', subtitle: 'Deep dark grey felt' },
  { id: 'slate_felt', name: 'Slate Grey Felt', hex: '#4b5563', subtitle: 'Neutral mid-grey acoustic backing' },
  { id: 'greige_felt', name: 'Warm Greige Felt', hex: '#d8d2c9', subtitle: 'Warm sand / linen tone backing' },
  { id: 'white_felt', name: 'Crisp White Felt', hex: '#ffffff', subtitle: 'Clean modern white backdrop' },
];


const GLASS_FINISHES = [
  { id: 'frosted_mica', name: 'Frosted Mica Shower Panel', subtitle: 'Pebbled Translucent Acrylic Screen', type: 'glass' as const, variant: 'frosted_mica', color: '#f8fafc', opacity: 0.82 },
  { id: 'frosted', name: 'Frosted Privacy Glass', subtitle: 'Acid-Etched Satin Glass', type: 'glass' as const, variant: 'frosted', color: '#f1f5f9', opacity: 0.75 },
  { id: 'fluted', name: 'Fluted Reeded Glass', subtitle: 'Vertical Ribbed Architectural Glass', type: 'glass' as const, variant: 'fluted', color: '#e2e8f0', opacity: 0.70 },
  { id: 'smoked', name: 'Smoked Grey Glass', subtitle: 'Tinted Grey Privacy Glass', type: 'glass' as const, variant: 'smoked', color: '#334155', opacity: 0.60 },
  { id: 'clear', name: 'Architectural Clear Glass', subtitle: 'High-Transmission Transparent Glass', type: 'glass' as const, variant: 'clear', color: '#d8eeff', opacity: 0.35 },
];

const CEILING_FINISHES = [
  { id: 'clip_in', name: 'Clip-in Modular 60x60', type: 'ceiling' as const, variant: 'clip_in', color: '#f1f5f9', roughness: 0.4 },
  { id: 'gypsum', name: 'Smooth Gypsum Board', type: 'ceiling' as const, variant: 'gypsum', color: '#f8fafc', roughness: 0.8 },
];

const METAL_FINISHES = [
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

const PORCELAIN_FINISHES = [
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


interface FabricColor {
  name: string;
  hex: string;
  variant?: string;
}

interface FabricCategory {
  id: string;
  name: string;
  colors: FabricColor[];
}

const FABRIC_CATEGORIES: FabricCategory[] = [
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

export const SurfaceFinishPicker: React.FC<SurfaceFinishPickerProps> = ({
  currentFinish,
  onSelectFinish,
  onClearFinish,
  showCeilingsTab = false,
  defaultTab,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(
    defaultTab ||
      (currentFinish?.type === 'metal' || currentFinish?.type === 'porcelain'
        ? 'metal'
        : currentFinish?.type === 'fabric'
        ? 'fabric'
        : currentFinish?.type === 'tile'
        ? 'tile'
        : currentFinish?.type === 'wood' || currentFinish?.type === 'lambri'
        ? 'lambri'
        : 'paint')
  );
  const [selectedFabricCategory, setSelectedFabricCategory] = useState<string>('velvet_reds');
  const [selectedPaletteCategory, setSelectedPaletteCategory] = useState<string>('all');
  const [customHex, setCustomHex] = useState(
    currentFinish?.type === 'paint' && currentFinish.color ? currentFinish.color : '#efede8'
  );
  const [paintSearchQuery, setPaintSearchQuery] = useState<string>('');
  const [selectedLambriSlat, setSelectedLambriSlat] = useState<string>(
    currentFinish?.type === 'lambri' && currentFinish.variant ? currentFinish.variant : 'oak_slats'
  );
  const [selectedLambriBacking, setSelectedLambriBacking] = useState<string>(
    currentFinish?.type === 'lambri' && currentFinish.backingColor ? currentFinish.backingColor : '#121212'
  );
  const [customBackingHex, setCustomBackingHex] = useState<string>(selectedLambriBacking);

  useEffect(() => {
    if (currentFinish?.type === 'lambri') {
      if (currentFinish.variant) setSelectedLambriSlat(currentFinish.variant);
      if (currentFinish.backingColor) {
        setSelectedLambriBacking(currentFinish.backingColor);
        setCustomBackingHex(currentFinish.backingColor);
      }
    }
  }, [currentFinish]);

  // Tile catalog — loaded async from public/textures/tiles/tiles.json
  const tileCatalogService = useService<ITileCatalogService>(TOKENS.TileCatalogService);
  const [tileEntries, setTileEntries] = useState<TileEntry[]>(() => tileCatalogService.getAll());

  useEffect(() => {
    return tileCatalogService.onCatalogLoaded((entries) => {
      setTileEntries(entries);
    });
  }, [tileCatalogService]);

  const getGroutWidthForVariant = (variant?: string): number => {
    if (!variant) return 2;
    const entry = tileCatalogService.getById(variant);
    if (entry) return tileCatalogService.getDefaultGroutWidth(entry);
    return 2;
  };

  const currentGroutWidth =
    currentFinish?.type === 'tile'
      ? (currentFinish.groutWidth ?? getGroutWidthForVariant(currentFinish.variant))
      : 2;
  const currentGroutColor = currentFinish?.groutColor || '#d1d5db';
  const [customGroutHex, setCustomGroutHex] = useState(currentGroutColor);

  useEffect(() => {
    setCustomGroutHex(currentGroutColor);
  }, [currentGroutColor]);

  const handleGroutColorChange = (hex: string) => {
    setCustomGroutHex(hex);
    const newWidth = currentGroutWidth === 0 ? 1 : currentGroutWidth;
    if (currentFinish && currentFinish.type === 'tile') {
      onSelectFinish({ ...currentFinish, groutColor: hex, groutWidth: newWidth });
    } else {
      const first = tileEntries[0];
      if (first) {
        onSelectFinish({
          type: 'tile',
          variant: first.id,
          color: first.color,
          roughness: first.roughness,
          rotation: currentFinish?.rotation || 0,
          pattern: tileCatalogService.getDefaultPattern(first),
          groutWidth: newWidth,
          groutColor: hex,
        });
      }
    }
  };

  const isInvisible =
    currentFinish?.type === 'invisible' ||
    currentFinish?.color === 'invisible' ||
    currentFinish?.variant === 'invisible';

  const isCurrent = (type: string, variant?: string, color?: string, backingColor?: string) => {
    if (!currentFinish) return false;
    if (isInvisible) {
      return type === 'invisible' || color === 'invisible';
    }
    if (currentFinish.type !== type) return false;
    if (variant && currentFinish.variant !== variant) return false;
    if (color && currentFinish.color?.toLowerCase() !== color.toLowerCase()) return false;
    if (backingColor && currentFinish.backingColor?.toLowerCase() !== backingColor.toLowerCase()) return false;
    return true;
  };

  return (
    <div className="space-y-3">
      {/* Universal Invisible Option Button */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-slate-800 bg-slate-900/60">
        <button
          type="button"
          onClick={() => onSelectFinish({ type: 'invisible', color: 'invisible' })}
          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            isInvisible
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
            <span>Invisible</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isInvisible ? 'Part / Surface Hidden' : 'Hide Part or Surface'}
          </span>
          {isInvisible && <Check className="w-3.5 h-3.5 text-indigo-400 ml-1" />}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('paint')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'paint'
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Paintbrush className="w-3 h-3" />
          Paint & Plaster
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lambri')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'lambri'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3 h-3" />
          Wood & Parquet
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tile')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'tile'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Grid className="w-3 h-3" />
          Tile & Marble
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('glass')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'glass'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          Glass
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('metal')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'metal'
              ? 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Disc className="w-3 h-3 text-zinc-400" />
          Metal &amp; Fixtures
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fabric')}
          className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'fabric'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-3 h-3 text-rose-400" />
          Velvet &amp; Fabric
        </button>

        {showCeilingsTab && (
          <button
            type="button"
            onClick={() => setActiveTab('ceiling')}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'ceiling'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Grid className="w-3 h-3" />
            Ceiling
          </button>
        )}
      </div>

      {/* Tab 1: Paint & Plaster */}
      {activeTab === 'paint' && (
        <div className="space-y-3">
          {/* Curated Paint Colors */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
              <span>Architectural Wall Paint</span>
              <span className="text-[9px] text-sky-400 font-normal">100 curated designer tones</span>
            </div>

            {/* Search Input for 100 Wall Colors */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search 100 wall colors (e.g. Alabaster, Sage, Navy, #...)"
                value={paintSearchQuery}
                onChange={(e) => setPaintSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              {paintSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPaintSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category filter pills (shown when not searching) */}
            {!paintSearchQuery && (
              <div className="flex flex-wrap gap-1 mb-2">
                {PAINT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedPaletteCategory(cat.id)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                      selectedPaletteCategory === cat.id
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Swatch grid */}
            {(() => {
              let displayColors =
                selectedPaletteCategory === 'all'
                  ? ALL_CURATED_PAINTS
                  : PAINT_CATEGORIES.find((c) => c.id === selectedPaletteCategory)?.colors || [];

              if (paintSearchQuery.trim()) {
                const q = paintSearchQuery.toLowerCase().trim();
                const allPaintsWithMetals = PAINT_CATEGORIES.filter((c) => c.id !== 'all').flatMap((c) => c.colors);
                displayColors = allPaintsWithMetals.filter(
                  (p) => p.name.toLowerCase().includes(q) || p.hex.toLowerCase().includes(q)
                );
              }

              if (displayColors.length === 0) {
                return (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    No wall colors matching "{paintSearchQuery}"
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {displayColors.map((p) => {
                    const active = isCurrent('paint', undefined, p.hex);
                    return (
                      <button
                        key={`${p.name}_${p.hex}`}
                        type="button"
                        onClick={() => {
                          setCustomHex(p.hex);
                          onSelectFinish({
                            type: 'paint',
                            color: p.hex,
                            roughness: 0.85,
                          });
                        }}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                          active
                            ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                        }`}
                        title={`${p.name} (${p.hex})`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-slate-700/60 shadow-inner shrink-0"
                          style={{ backgroundColor: p.hex }}
                        />
                        <span className="text-[10px] text-slate-300 truncate font-medium flex-1">
                          {p.name}
                        </span>
                        {active && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Custom Hex Color Picker */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <input
              type="color"
              value={customHex}
              onChange={(e) => {
                const hex = e.target.value;
                setCustomHex(hex);
                onSelectFinish({
                  type: 'paint',
                  color: hex,
                  roughness: 0.85,
                });
              }}
              className="w-7 h-7 rounded border border-slate-700 bg-slate-800 cursor-pointer p-0.5"
            />
            <div className="flex-1">
              <input
                type="text"
                value={customHex}
                onChange={(e) => {
                  const hex = e.target.value;
                  setCustomHex(hex);
                  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    onSelectFinish({
                      type: 'paint',
                      color: hex,
                      roughness: 0.85,
                    });
                  }
                }}
                placeholder="#RRGGBB"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Textured Plasters */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
              Textured Plaster &amp; Microcement
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {PLASTER_FINISHES.map((pl) => {
                const active = isCurrent('plaster', pl.variant);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'plaster',
                        variant: pl.variant,
                        color: pl.color,
                        roughness: pl.roughness,
                      })
                    }
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded border border-slate-700 shadow-inner shrink-0"
                      style={{ backgroundColor: pl.color }}
                    />
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 font-medium">{pl.name}</div>
                      <div className="text-[10px] text-slate-400">Micro-textured architectural mineral finish</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wood & Parquet (Furniture Hardwoods, Flooring, and Dual-Tone Lambri) */}
      {activeTab === 'lambri' && (
        <div className="space-y-4">
          {/* Section 1: Solid Hardwood & Furniture Veneers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-slate-400">
              <span>Solid Hardwood &amp; Furniture Veneers</span>
              <span className="text-[9px] text-amber-400 font-normal">Photographic PBR</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {FURNITURE_WOOD_FINISHES.map((w) => {
                const active = currentFinish?.type === 'wood' && currentFinish?.variant === w.variant;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'wood',
                        variant: w.variant,
                        color: w.color,
                        roughness: w.roughness,
                      })
                    }
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-amber-500 bg-amber-500/15 shadow-sm'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-md border border-slate-700 shadow-inner shrink-0 bg-cover bg-center overflow-hidden"
                      style={{
                        backgroundImage: `url(${w.imageUrl})`,
                        backgroundColor: w.color,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-semibold truncate">{w.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{w.subtitle}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Parquet & Wood Plank Flooring */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400">
              Flooring &amp; Parquet Patterns
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PARQUET_FINISHES.map((p) => {
                const active = currentFinish?.type === 'wood' && currentFinish?.variant === p.variant;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'wood',
                        variant: p.variant,
                        color: p.color,
                        roughness: p.roughness,
                      })
                    }
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-amber-500 bg-amber-500/15'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-center font-bold text-[8px] text-slate-900"
                      style={{ backgroundColor: p.color }}
                    >
                      #
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-200 font-medium truncate">{p.name}</div>
                    </div>
                    {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Dual-Tone Acoustic Lambri (Slats + Felt Backing) */}
          <div className="space-y-2.5 p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/10">
            <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-amber-400">
              <span>Acoustic Slats &amp; Lambri</span>
              <span className="text-[9px] text-slate-400 font-normal">Dual-Tone Backing</span>
            </div>

            {/* Preview of Slat on Backing */}
            {(() => {
              const currentSlat =
                ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                ACOUSTIC_SLAT_VARIANTS[0];
              const effectiveBacking = selectedLambriBacking || '#121212';
              const backingInfo = ACOUSTIC_BACKING_COLORS.find(
                (b) => b.hex.toLowerCase() === effectiveBacking.toLowerCase()
              );
              const backingLabel = backingInfo ? backingInfo.name : effectiveBacking;

              return (
                <div className="flex items-center gap-3 p-2 rounded-lg border border-slate-800 bg-slate-950/80">
                  <div
                    className="w-12 h-10 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-around px-1"
                    style={{ backgroundColor: effectiveBacking }}
                  >
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                    <div className="w-1.5 h-8 rounded-sm shadow-sm" style={{ backgroundColor: currentSlat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-amber-200 font-semibold truncate">
                      {currentSlat.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Backing: <span className="text-slate-300 font-medium">{backingLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'lambri',
                        variant: currentSlat.variant,
                        color: currentSlat.color,
                        backingColor: effectiveBacking,
                        roughness: 0.55,
                      })
                    }
                    className="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-semibold hover:bg-amber-400 transition-colors shrink-0"
                  >
                    Apply Lambri
                  </button>
                </div>
              );
            })()}

            {/* Step A: Slat Finish Selection */}
            <div>
              <div className="text-[9px] uppercase font-medium text-slate-400 mb-1">
                1. Select Slat Finish (Protrusion)
              </div>
              <div className="grid grid-cols-3 gap-1">
                {ACOUSTIC_SLAT_VARIANTS.map((slat) => {
                  const active =
                    currentFinish?.type === 'lambri'
                      ? currentFinish.variant === slat.variant
                      : selectedLambriSlat === slat.variant;
                  return (
                    <button
                      key={slat.id}
                      type="button"
                      onClick={() => {
                        setSelectedLambriSlat(slat.variant);
                        onSelectFinish({
                          type: 'lambri',
                          variant: slat.variant,
                          color: slat.color,
                          backingColor: selectedLambriBacking,
                          roughness: 0.55,
                        });
                      }}
                      className={`flex items-center gap-1.5 p-1.5 rounded border text-left transition-all ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300'
                      }`}
                      title={slat.name}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded border border-slate-700 shadow-inner shrink-0"
                        style={{ backgroundColor: slat.color }}
                      />
                      <span className="text-[10px] truncate font-medium flex-1">
                        {slat.woodName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step B: Acoustic Backing Felt Selection */}
            <div>
              <div className="text-[9px] uppercase font-medium text-slate-400 mb-1">
                2. Select Acoustic Felt Backing (Background)
              </div>
              <div className="grid grid-cols-5 gap-1 mb-1.5">
                {ACOUSTIC_BACKING_COLORS.map((b) => {
                  const active =
                    currentFinish?.type === 'lambri' && currentFinish.backingColor
                      ? currentFinish.backingColor.toLowerCase() === b.hex.toLowerCase()
                      : selectedLambriBacking.toLowerCase() === b.hex.toLowerCase();
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedLambriBacking(b.hex);
                        setCustomBackingHex(b.hex);
                        const currentSlatObj =
                          ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                          ACOUSTIC_SLAT_VARIANTS[0];
                        onSelectFinish({
                          type: 'lambri',
                          variant: currentSlatObj.variant,
                          color: currentSlatObj.color,
                          backingColor: b.hex,
                          roughness: 0.55,
                        });
                      }}
                      className={`flex flex-col items-center gap-1 p-1 rounded border text-center transition-all ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 shadow-sm'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                      title={`${b.name} (${b.subtitle})`}
                    >
                      <div
                        className="w-4 h-4 rounded border border-slate-700 shadow-inner"
                        style={{ backgroundColor: b.hex }}
                      />
                      <span className="text-[8px] text-slate-300 leading-tight truncate w-full">
                        {b.name.replace(' Felt', '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Backing Color Picker */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-[9px] text-slate-400 shrink-0">Custom Felt Hex:</span>
                <input
                  type="color"
                  value={
                    customBackingHex.startsWith('#') && customBackingHex.length === 7
                      ? customBackingHex
                      : '#121212'
                  }
                  onChange={(e) => {
                    const hex = e.target.value;
                    setCustomBackingHex(hex);
                    setSelectedLambriBacking(hex);
                    const currentSlatObj =
                      ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                      ACOUSTIC_SLAT_VARIANTS[0];
                    onSelectFinish({
                      type: 'lambri',
                      variant: currentSlatObj.variant,
                      color: currentSlatObj.color,
                      backingColor: hex,
                      roughness: 0.55,
                    });
                  }}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customBackingHex}
                  onChange={(e) => {
                    const hex = e.target.value;
                    setCustomBackingHex(hex);
                    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                      setSelectedLambriBacking(hex);
                      const currentSlatObj =
                        ACOUSTIC_SLAT_VARIANTS.find((s) => s.variant === selectedLambriSlat) ||
                        ACOUSTIC_SLAT_VARIANTS[0];
                      onSelectFinish({
                        type: 'lambri',
                        variant: currentSlatObj.variant,
                        color: currentSlatObj.color,
                        backingColor: hex,
                        roughness: 0.55,
                      });
                    }
                  }}
                  className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="#121212"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Tile & Stone */}
      {activeTab === 'tile' && (
        <div className="space-y-2">
          {/* Orientation / Flip Control Bar */}
          <div className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">Orientation:</span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {(currentFinish?.rotation || 0) % 180 === 90 ? 'Vertical (90°)' : 'Horizontal (0°)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: 0 });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: 0 });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  (currentFinish?.rotation || 0) === 0
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Horizontal layout (brick layout, long side parallel to ground)"
              >
                Horizontal (0°)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: 90 });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: 90 });
                  }
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  (currentFinish?.rotation || 0) === 90
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Vertical layout (upright layout)"
              >
                Vertical (90°)
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentRot = currentFinish?.rotation || 0;
                  const nextRot = (currentRot + 90) % 360;
                  if (currentFinish && currentFinish.type === 'tile') {
                    onSelectFinish({ ...currentFinish, rotation: nextRot });
                  } else {
                    const first = tileEntries[0];
                    if (first) onSelectFinish({ type: 'tile', variant: first.id, color: first.color, roughness: first.roughness, rotation: nextRot });
                  }
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Rotate +90°"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Layout Pattern Selector Bar */}
          <div className="space-y-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium">Layout Pattern:</span>
              </div>
              <span className="text-[11px] text-amber-400 font-semibold">
                {TILE_LAYOUT_PATTERNS.find((p) => p.id === (currentFinish?.pattern || 'grid'))?.label || 'Grid'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {TILE_LAYOUT_PATTERNS.map((p) => {
                const isSelected = (currentFinish?.pattern || 'grid') === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (currentFinish && currentFinish.type === 'tile') {
                        onSelectFinish({ ...currentFinish, pattern: p.id });
                      } else {
                        const first = tileEntries[0];
                        if (first) {
                          onSelectFinish({
                            type: 'tile',
                            variant: first.id,
                            color: first.color,
                            roughness: first.roughness,
                            rotation: currentFinish?.rotation || 0,
                            pattern: p.id,
                            groutWidth: currentGroutWidth,
                            groutColor: currentGroutColor,
                          });
                        }
                      }
                    }}
                    className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors text-center truncate ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={p.description}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grout Specifications: Joint Width & Joint Color */}
          <div className="space-y-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {/* Grout Width Header & Width Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-[11px] font-medium">Grout Joint Width:</span>
                <span className="text-[11px] text-sky-400 font-semibold">
                  {currentGroutWidth === 0 ? 'None (0 mm)' : `${currentGroutWidth} mm`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { value: 0, label: 'None' },
                  { value: 1, label: '1 mm' },
                  { value: 2, label: '2 mm' },
                  { value: 3, label: '3 mm' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (currentFinish && currentFinish.type === 'tile') {
                        onSelectFinish({ ...currentFinish, groutWidth: opt.value });
                      } else {
                        const first = tileEntries[0];
                        if (first) {
                          onSelectFinish({
                            type: 'tile',
                            variant: first.id,
                            color: first.color,
                            roughness: first.roughness,
                            rotation: 0,
                            pattern: tileCatalogService.getDefaultPattern(first),
                            groutWidth: opt.value,
                            groutColor: currentGroutColor,
                          });
                        }
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      currentGroutWidth === opt.value
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title={`${opt.label} grout width`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grout Color Header, Custom Picker, and Hex Input */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Palette className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-[11px] font-medium shrink-0">Grout Color:</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-slate-600 shadow-inner shrink-0"
                    style={{ backgroundColor: currentGroutColor }}
                    title={`Active grout color: ${currentGroutColor}`}
                  />
                  <span className="text-[11px] text-sky-400 font-semibold truncate">
                    {GROUT_COLORS.find((c) => c.hex.toLowerCase() === currentGroutColor.toLowerCase())?.name || currentGroutColor}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <label
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700 text-[10px] font-medium transition-colors"
                    title="Click to open color picker palette or eyedropper"
                  >
                    <Pipette className="w-3 h-3 text-sky-400" />
                    <span>Picker</span>
                    <input
                      type="color"
                      value={currentGroutColor.startsWith('#') && currentGroutColor.length === 7 ? currentGroutColor : '#d1d5db'}
                      onChange={(e) => handleGroutColorChange(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  <input
                    type="text"
                    value={customGroutHex}
                    onChange={(e) => {
                      setCustomGroutHex(e.target.value);
                      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                        handleGroutColorChange(e.target.value);
                      }
                    }}
                    onBlur={() => {
                      if (/^#[0-9A-Fa-f]{6}$/.test(customGroutHex)) {
                        handleGroutColorChange(customGroutHex);
                      } else {
                        setCustomGroutHex(currentGroutColor);
                      }
                    }}
                    placeholder="#d1d5db"
                    className="w-16 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200 text-center uppercase focus:outline-none focus:border-sky-500"
                    title="Hex color code (e.g. #d1d5db)"
                  />
                </div>
              </div>

              {currentGroutWidth === 0 && (
                <div className="text-[9px] text-amber-400/90 italic">
                  Note: Joint width is currently None (0 mm). Selecting a color will set width to 1 mm.
                </div>
              )}

              {/* Architectural Preset Color Palette */}
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {GROUT_COLORS.map((gc) => {
                  const isSelected = currentGroutColor.toLowerCase() === gc.hex.toLowerCase();
                  return (
                    <button
                      key={gc.id}
                      type="button"
                      onClick={() => handleGroutColorChange(gc.hex)}
                      className={`flex items-center gap-1.5 p-1 rounded border text-left transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500/20 shadow-sm ring-1 ring-sky-500/50'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                      }`}
                      title={`${gc.name} (${gc.hex})`}
                    >
                      <div
                        className="w-3 h-3 rounded-full border border-slate-700/80 shadow-inner shrink-0"
                        style={{ backgroundColor: gc.hex }}
                      />
                      <span className="text-[9px] text-slate-300 truncate font-medium flex-1">
                        {gc.name}
                      </span>
                      {isSelected && <Check className="w-2.5 h-2.5 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
            <span>Ceramic, Porcelain &amp; Natural Stone</span>
            <span className="text-emerald-400 text-[9px] lowercase font-normal">brick horizontal default</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {tileEntries.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-3 animate-pulse">Loading tile catalog…</div>
            ) : (
              tileEntries.map((t) => {
                const active = isCurrent('tile', t.id);
                const swatchUrl = t.textures[0] ?? null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const defPattern = tileCatalogService.getDefaultPattern(t);
                      const pattern = (t.name.toLowerCase().includes('decor') || t.name.toLowerCase().includes('sage'))
                        ? defPattern
                        : (currentFinish?.pattern || defPattern);
                      onSelectFinish({
                        type: 'tile',
                        variant: t.id,
                        color: t.color,
                        roughness: t.roughness,
                        metalness: t.metalness,
                        rotation: currentFinish?.rotation || 0,
                        pattern,
                        groutWidth: currentFinish?.groutWidth ?? tileCatalogService.getDefaultGroutWidth(t),
                        groutColor: currentGroutColor,
                      });
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    {/* Swatch: real image (textures[0]) or colour square for procedural */}
                    <div
                      className="relative w-7 h-7 rounded border border-slate-700 shadow-inner shrink-0 overflow-hidden flex items-center justify-center"
                      style={
                        swatchUrl
                          ? {
                              backgroundImage: `url(${swatchUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : { backgroundColor: t.color }
                      }
                    >
                      {!swatchUrl && (
                        <span className="text-[10px] text-slate-700">⊞</span>
                      )}
                      {/* Multi-variant badge */}
                      {t.textures.length > 1 && (
                        <span
                          className="absolute bottom-0.5 right-0.5 bg-emerald-600 text-white text-[7px] font-bold rounded px-0.5 leading-none"
                          title={`${t.textures.length} variants`}
                        >
                          {t.textures.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 font-medium">{t.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.textures.length === 0
                          ? 'Procedural / synthetic tile pattern'
                          : t.textures.length > 1
                          ? `${t.textures.length} variants · wet-area architectural tile`
                          : 'Wet-area architectural tile & grout grid'}
                      </div>
                    </div>
                    {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Glass */}
      {activeTab === 'glass' && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Architectural Glass & Shower Partitions
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {GLASS_FINISHES.map((g) => {
              const active = isCurrent('glass', g.variant);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    onSelectFinish({
                      type: 'glass',
                      variant: g.variant,
                      color: g.color,
                      roughness: 0.1,
                    })
                  }
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                    active
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded border border-cyan-400/40 shadow-inner shrink-0 flex items-center justify-center text-[10px] text-cyan-200 bg-cyan-500/20 backdrop-blur-sm"
                  >
                    ✧
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-200 font-medium">{g.name}</div>
                    <div className="text-[10px] text-slate-400">{g.subtitle || 'Physically-based transmission shader'}</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Metal & Fixtures */}
      {activeTab === 'metal' && (
        <div className="space-y-3">
          {/* Section 1: Architectural Metals & Hardware */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Disc className="w-3 h-3 text-slate-400" />
              Metals &amp; Powder Coated Hardware
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {METAL_FINISHES.map((m) => {
                const active = isCurrent('metal', m.variant);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'metal',
                        variant: m.variant,
                        color: m.color,
                        roughness: m.roughness,
                        metalness: m.metalness,
                      })
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md border border-slate-700/80 shadow-sm shrink-0 flex items-center justify-center"
                      style={{ background: m.swatchBackground }}
                    >
                      {active && (
                        <Check className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-medium truncate">{m.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{m.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Vitreous Porcelain & Sanitary Ware */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-slate-400" />
              Vitreous China &amp; Sanitary Porcelain
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PORCELAIN_FINISHES.map((p) => {
                const active = isCurrent('porcelain', p.variant);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      onSelectFinish({
                        type: 'porcelain',
                        variant: p.variant,
                        color: p.color,
                        roughness: p.roughness,
                        metalness: p.metalness,
                      })
                    }
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md border border-slate-700/80 shadow-sm shrink-0 flex items-center justify-center"
                      style={{ background: p.swatchBackground }}
                    >
                      {active && (
                        <Check className="w-3.5 h-3.5 text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-200 font-medium truncate">{p.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{p.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Ceiling (if enabled) */}
      {showCeilingsTab && activeTab === 'ceiling' && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            Ceiling Finishes &amp; Systems
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {CEILING_FINISHES.map((c) => {
              const active = isCurrent('ceiling', c.variant);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onSelectFinish({
                      type: 'ceiling',
                      variant: c.variant,
                      color: c.color,
                      roughness: c.roughness,
                    })
                  }
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                    active
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded border border-slate-700 shadow-inner shrink-0 flex items-center justify-center text-[10px] text-purple-300"
                    style={{ backgroundColor: c.color }}
                  >
                    ▦
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-200 font-medium">{c.name}</div>
                    <div className="text-[10px] text-slate-400">Suspended ceiling tile grid at room height</div>
                  </div>
                  {active && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Fabric & Velvet */}
      {activeTab === 'fabric' && (
        <div className="space-y-3.5">
          {/* Section 1: Real Photographic Velvet Collections */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Photographic Velvet Collections</span>
              <span className="text-[9px] text-rose-400 font-normal">Real Reflections &amp; Folds</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
              {PHOTOGRAPHIC_FABRIC_COLLECTIONS.map((item) => {
                const active =
                  currentFinish?.type === 'fabric' &&
                  (currentFinish.variant === item.variant ||
                    (!currentFinish.variant && currentFinish.color?.toLowerCase() === item.color.toLowerCase()));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const isLinenItem = item.variant?.includes('linen');
                      onSelectFinish({
                        type: 'fabric',
                        variant: item.variant,
                        color: item.color,
                        roughness: 0.82,
                        metalness: 0.02,
                        mappingMode: item.mappingMode || (isLinenItem ? 'tiled' : 'stretched'),
                        scale: item.scale || (isLinenItem ? 3.5 : 1.0),
                      });
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/30'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-md border border-slate-700/80 shadow-md shrink-0 bg-cover bg-center overflow-hidden"
                      style={{ backgroundImage: `url(${item.photoUrl})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-slate-200 font-medium truncate">{item.name}</span>
                        {item.tag && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Velvet Color Palette with Photographic Base */}
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Velvet Color Palette</span>
              <span className="text-[9px] text-slate-500">Photographic Tints</span>
            </div>
            {/* Category Pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              {FABRIC_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedFabricCategory(cat.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                    selectedFabricCategory === cat.id
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Colors Grid */}
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {(FABRIC_CATEGORIES.find((c) => c.id === selectedFabricCategory)?.colors || []).map((col) => {
                const active =
                  currentFinish?.type === 'fabric' &&
                  currentFinish.color?.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={`${col.name}_${col.hex}`}
                    type="button"
                    onClick={() => {
                      onSelectFinish({
                        type: 'fabric',
                        variant: col.variant || 'velvet_neutral_silver',
                        color: col.hex,
                        roughness: 0.82,
                        metalness: 0.02,
                        mappingMode: currentFinish?.mappingMode || 'stretched',
                        scale: currentFinish?.scale || 1.0,
                      });
                    }}
                    className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/30'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                    title={`${col.name} (${col.hex})`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-slate-700/60 shadow-inner shrink-0 relative overflow-hidden"
                      style={{
                        backgroundColor: col.hex,
                        backgroundImage:
                          'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.2) 100%)',
                      }}
                    />
                    <div className="truncate flex-1 min-w-0">
                      <div className="text-[10px] text-slate-200 truncate font-medium">{col.name}</div>
                      <div className="text-[8px] text-slate-500 font-mono">{col.hex}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Texture Mapping & Weave Scale Options */}
          {currentFinish?.type === 'fabric' && (
            <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Fabric Texture Mapping</span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {(currentFinish.mappingMode || (currentFinish.variant?.includes('linen') ? 'tiled' : 'stretched')) === 'tiled'
                    ? `Tiled (${(currentFinish.scale || (currentFinish.variant?.includes('linen') ? 3.5 : 2.0)).toFixed(1)}x)`
                    : 'Stretched (Fitted)'}
                </span>
              </div>

              {/* Mode Toggle Buttons: Stretched vs Tiled */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onSelectFinish({
                      ...currentFinish,
                      mappingMode: 'stretched',
                      scale: 1.0,
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium border transition-all ${
                    (currentFinish.mappingMode || (currentFinish.variant?.includes('linen') ? 'tiled' : 'stretched')) === 'stretched'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Stretched (Fitted)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const isLinen = currentFinish.variant?.includes('linen');
                    onSelectFinish({
                      ...currentFinish,
                      mappingMode: 'tiled',
                      scale: currentFinish.scale || (isLinen ? 3.5 : 2.0),
                    });
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium border transition-all ${
                    (currentFinish.mappingMode || (currentFinish.variant?.includes('linen') ? 'tiled' : 'stretched')) === 'tiled'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-sm'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  Tiled (Repeating)
                </button>
              </div>

              {/* Weave / Pattern Density Options (Active when Tiled) */}
              {(currentFinish.mappingMode || (currentFinish.variant?.includes('linen') ? 'tiled' : 'stretched')) === 'tiled' && (
                <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span>Pattern Weave Density</span>
                    <span className="text-slate-500 font-mono">
                      {(currentFinish.scale || (currentFinish.variant?.includes('linen') ? 3.5 : 2.0)).toFixed(1)} repeats/m
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Fine (4x)', value: 4.0 },
                      { label: 'Standard (3.5x)', value: 3.5 },
                      { label: 'Medium (2.5x)', value: 2.5 },
                      { label: 'Coarse (1.5x)', value: 1.5 },
                    ].map((preset) => {
                      const currentScale = currentFinish.scale || (currentFinish.variant?.includes('linen') ? 3.5 : 2.0);
                      const isPresetActive = Math.abs(currentScale - preset.value) < 0.1;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            onSelectFinish({
                              ...currentFinish,
                              mappingMode: 'tiled',
                              scale: preset.value,
                            });
                          }}
                          className={`py-1 px-1 rounded text-[8.5px] font-medium border text-center transition-all ${
                            isPresetActive
                              ? 'border-rose-500/60 bg-rose-500/20 text-rose-200 font-semibold'
                              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Reset / Clear Button */}
      {onClearFinish && currentFinish && (
        <button
          type="button"
          onClick={onClearFinish}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Default Finish
        </button>
      )}
    </div>
  );
};
