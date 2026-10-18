import type { AssetDefinition } from './AssetDefinition';

export type DailyLifeKind = 'cat_tree' | 'cat_tray' | 'cat_litter' | 'cat_fountain' | 'cat_feeder' | 'cat_house'
  | 'vanity_bottles' | 'hot_air_brush' | 'jewelry_tray' | 'dishwasher' | 'garment_short' | 'garment_coat'
  | 'boots_large' | 'boots_women' | 'sneakers_large' | 'sneakers_women' | 'drawer_organizer' | 'trouser_rack';
export interface DailyLifeModel { kind: DailyLifeKind; }
function asset(kind: DailyLifeKind, name: string, collection: string, size: [number, number, number], description: string, surface = false): AssetDefinition {
  return { key: `life_${kind}`, name, collection, category: kind === 'dishwasher' ? 'appliance' : 'decor', recipe: 'daily_life', dailyLife: { kind },
    defaultDimensions: { x: size[0], y: size[1], z: size[2] }, placement: kind.startsWith('garment_') ? { mount: 'surface', defaultElevation: kind === 'garment_coat' ? .45 : .85 } : surface ? { mount: 'surface', defaultElevation: .85 } : { mount: 'floor' },
    capabilities: { resizable: true }, description, source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: 'Reference planning envelope, not a verified manufacturer specification. Adjust to the actual item.' } };
}
export const DAILY_LIFE_ASSETS: readonly AssetDefinition[] = [
  asset('cat_tree', 'Cat Scratching Tower with Hideaway', 'Pet furniture', [.65, 1.50, .55], 'Sisal scratching posts, staggered platforms, a cubby with an open entrance and a padded top perch.'),
  asset('cat_tray', 'Cat Food and Water Bowl Tray', 'Pet care', [.42, .065, .24], 'Two open stainless-steel bowls in a washable raised-rim feeding tray.'),
  asset('cat_litter', 'Covered Cat Litter Box', 'Pet care', [.42, .43, .56], 'Enclosed litter tray with a hood, front doorway and carrying handle.'),
  asset('cat_fountain', 'Stainless-Steel Tray Cat Water Fountain', 'Pet care', [.25, .16, .25], 'Brushed-steel basin, visible water surface and a raised drinking spout.'),
  asset('cat_feeder', 'Automatic Cat Feeder', 'Pet care', [.20, .34, .34], 'Dry-food hopper with lid, control display, dispensing chute and projecting steel bowl.'),
  asset('cat_house', 'Waist-Height Cat House on Scratching Posts', 'Pet furniture', [.65, 1.30, .50], 'Elevated enclosed hideaway at approximately 87 cm above the floor on four sisal-wrapped scratching columns, with a step platform.'),
  asset('vanity_bottles', 'Perfume and Skin-Care Bottle Set', 'Vanity accessories', [.22, .16, .10], 'Perfume, serum, lotion and cream containers on a shallow tray. 10 cm depth fits shallow mirrored cabinets.', true),
  asset('hot_air_brush', 'Hot-Air Styling Brush', 'Vanity accessories', [.32, .065, .065], 'Generic Philips-style brush-shaped hair dryer with a handle, oval bristle barrel, controls and cord stub. Reference dimensions only.', true),
  asset('jewelry_tray', 'Jewelry and Key Dish', 'Vanity accessories', [.14, .025, .10], 'Shallow open dish holding a ring, bracelet and a key. Suitable for nightstands and mirrored-cabinet shelves.', true),
  asset('dishwasher', 'Standard 60 cm Dishwasher', 'Kitchen appliances', [.60, .845, .60], 'Freestanding full-size dishwasher with front door, recessed handle, control strip, plinth and side panels.'),
  asset('garment_short', 'Hanging Shirt and Jacket Garment Envelope', 'Wardrobe storage', [.52, 1.05, .065], 'Short hanging garment envelope with shoulder shaping, hanger hook, front zipper and a visible jacket silhouette.'),
  asset('garment_coat', 'Hanging Long-Coat Garment Envelope', 'Wardrobe storage', [.60, 1.55, .085], 'Long hanging garment envelope for a coat, with hanger hook, zipper and a full-length coat silhouette.'),
  asset('boots_large', 'EU 47 Ankle Boots — Pair', 'Footwear', [.27, .20, .34], 'Large adult ankle boots with shafts, tongues, laces and treaded soles. 34 cm reference outer length.'),
  asset('boots_women', 'Women’s Tall Boots — Pair', 'Footwear', [.22, .46, .28], 'Tall women’s boots with shaped shafts, ankle panels, heels and separate soles. Reference size.'),
  asset('sneakers_large', 'EU 47 Sneakers — Pair', 'Footwear', [.27, .13, .34], 'Large adult sneakers with contrasting midsoles, toes, tongues and laces. 34 cm reference outer length.'),
  asset('sneakers_women', 'Women’s Sneakers — Pair', 'Footwear', [.22, .115, .28], 'Women’s sneakers with contrasting midsoles, heel counters, tongues and laces. Reference size.'),
  asset('drawer_organizer', 'Modular Drawer Cutlery Organizer', 'Drawer inserts', [.45, .055, .48], 'Fixed 8.5 × 22 cm compartment modules. Reducing width or depth removes complete compartments rather than shrinking them.', true),
  asset('trouser_rack', 'Pull-Out Wardrobe Trouser Rack', 'Drawer inserts', [.50, .075, .45], 'Telescopic side rails, front pull bar and fixed-spacing trouser bars. Place on an internal drawer to slide with it.', true),
];
