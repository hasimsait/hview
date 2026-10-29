import type { AssetDefinition } from './AssetDefinition';
import { BILLY_FINISHES } from './BillyFinishes';

const bauhaus = (slug: string, productCode: string, dimensions: 'listed' | 'estimated' = 'listed') => ({ retailer: 'BAUHAUS', url: `https://www.bauhaus.com.tr/${slug}-${productCode}`, productCode, dimensions });
const ikea = (url: string, productCode: string) => ({ retailer: 'IKEA', url, productCode, dimensions: 'listed' as const });
const countertop = { mount: 'surface' as const, defaultElevation: 0.9 };

export const CURATED_ASSETS: readonly AssetDefinition[] = [
  {
    key: 'black_angled_range_hood', name: 'Black Angled Glass Range Hood', category: 'appliance', recipe: 'angled_range_hood',
    description: 'Wall-mounted extractor hood with an inclined black-glass canopy and chimney. Reference-inspired 60 cm model.',
    defaultDimensions: { x: 0.6, y: 0.75, z: 0.35 }, placement: { mount: 'wall', defaultElevation: 1.55, wallOffset: 0.18 },
    source: { retailer: 'Image reference', dimensions: 'estimated' },
  },
  {
    key: 'black_four_burner_gas_cooktop', name: 'Black Glass Four-Burner Gas Cooktop', category: 'appliance', recipe: 'gas_cooktop',
    description: 'Inset cooktop with four gas burners, pan supports, and side controls. Reference-inspired 60 cm model.',
    defaultDimensions: { x: 0.6, y: 0.055, z: 0.52 }, placement: countertop,
    source: { retailer: 'Image reference', dimensions: 'estimated' },
  },
  {
    key: 'black_built_in_electric_oven', name: 'Black Built-In Electric Oven', category: 'appliance', recipe: 'built_in_oven',
    description: 'Built-in oven with a glazed door, oven racks, stainless-steel handle, and twin control knobs.',
    defaultDimensions: { x: 0.595, y: 0.595, z: 0.57 }, placement: { mount: 'wall', defaultElevation: 0.15, wallOffset: 0.3 },
    source: { retailer: 'Image reference', dimensions: 'estimated' },
  },
  {
    key: 'curtain_pelmet', name: 'Decorative Ceiling Cornice / Curtain Pelmet', category: 'architecture', recipe: 'curtain_pelmet', collection: 'Curtain pelmets',
    description: 'Paintable ceiling framing with a stepped cove profile, 12 cm high and 12 cm deep, for concealing curtain rails.',
    defaultDimensions: { x: 1.6, y: 0.12, z: 0.12 }, placement: { mount: 'ceiling', ceilingOffset: 0.12 },
    source: { retailer: 'Image reference', dimensions: 'reference' },
  },
  {
    key: 'primanova_biga_black_soap_dispenser', name: 'Primanova Biga Soap Dispenser — Black / Chrome', category: 'bathroom', recipe: 'soap_dispenser',
    description: '420 ml pump dispenser with a black glass-look plastic body and chrome pump.',
    defaultDimensions: { x: 0.075, y: 0.2, z: 0.075 }, placement: countertop,
    source: bauhaus('primanova-biga-sivi-sabunluk-siyah-krom', '61160743'),
  },
  {
    key: 'primanova_lenox_white_toothbrush_tumbler', name: 'Primanova Lenox Toothbrush Tumbler — White', category: 'bathroom', recipe: 'toothbrush_tumbler',
    description: 'White plastic countertop tumbler with a chrome trim ring.',
    defaultDimensions: { x: 0.08, y: 0.105, z: 0.08 }, placement: countertop,
    source: bauhaus('primanova-lenox-dis-fircalik-beyaz', '60953621'),
  },
  {
    key: 'primanova_lenox_white_soap_dish', name: 'Primanova Lenox Soap Dish — White', category: 'bathroom', recipe: 'soap_dish',
    description: 'Round white countertop soap dish with chrome trim, 13 cm in diameter.',
    defaultDimensions: { x: 0.13, y: 0.03, z: 0.13 }, placement: countertop,
    source: bauhaus('primanova-lenox-sabunluk-beyaz', '60953612'),
  },
  {
    key: 'primanova_lenox_black_pedal_bin', name: 'Primanova Lenox 5 L Pedal Bin — Black', category: 'bathroom', recipe: 'pedal_bin',
    description: 'Compact black plastic pedal bin with a soft-close lid and stainless-steel foot pedal.',
    defaultDimensions: { x: 0.21, y: 0.28, z: 0.21 }, placement: { mount: 'floor' },
    source: bauhaus('primanova-lenox-5l-pedalli-cop-kovasi-siyah', '61263217'),
  },
  {
    key: 'primanova_lenox_beige_toilet_brush', name: 'Primanova Lenox Toilet Brush Set — Beige', category: 'bathroom', recipe: 'brush_set',
    description: 'Freestanding beige plastic toilet-brush holder with a slim handle.',
    defaultDimensions: { x: 0.085, y: 0.33, z: 0.085 }, placement: { mount: 'floor' },
    source: bauhaus('primanova-lenox-tuvalet-fircasi-bej', '61331080'),
  },
  {
    key: 'penta_leaf_chrome_towel_rail', name: 'Penta Leaf Towel Rail — Chrome', category: 'bathroom', recipe: 'towel_bar',
    description: 'Wall-mounted chrome towel rail. The 60 cm planning width is adjustable.',
    defaultDimensions: { x: 0.6, y: 0.05, z: 0.08 }, placement: { mount: 'wall', defaultElevation: 1.3, wallOffset: 0.04 },
    source: bauhaus('penta-leaf-uzun-havluluk', '61360996', 'estimated'),
  },
  {
    key: 'primanova_black_paper_towel_holder', name: 'Primanova Under-Cabinet Paper Towel Holder — Black', category: 'kitchen', recipe: 'paper_towel_holder',
    description: 'Black cabinet-mounted paper-towel holder with a horizontal roll support.',
    defaultDimensions: { x: 0.24, y: 0.087, z: 0.105 }, placement: { mount: 'wall', defaultElevation: 1.35, wallOffset: 0.06 },
    source: bauhaus('primanova-kagit-havlu-askisi-siyah', '61478668'),
  },
  {
    key: 'ikea_hemnes_90_white_light_brown', name: 'IKEA HEMNES Bookcase — White Stain / Light Brown', category: 'storage', recipe: 'hemnes_bookcase',
    description: 'Solid-pine bookcase with framed sides, shaped top trim, and adjustable shelves. 90 × 37 × 197 cm.',
    defaultDimensions: { x: 0.9, y: 1.97, z: 0.37 }, placement: { mount: 'floor' },
    source: ikea('https://www.ikea.com.tr/en/product/hemnes-white-stain-light-brown-90x197-cm-bookcase-60413502', '60413502'),
  },
  {
    key: 'ikea_hemnes_90_black_brown_light_brown', name: 'IKEA HEMNES Bookcase — Black-Brown / Light Brown', category: 'storage', recipe: 'hemnes_bookcase',
    description: 'Solid-pine bookcase with a dark frame, contrasting wood top, and adjustable shelves. 90 × 37 × 197 cm.',
    defaultDimensions: { x: 0.9, y: 1.97, z: 0.37 }, placement: { mount: 'floor' },
    source: ikea('https://www.ikea.com.tr/en/product/hemnes-black-brown-brown-90x197-cm-bookcase-20452294', '20452294'),
  },
  {
    key: 'ikea_hemnes_49_white', name: 'IKEA HEMNES Narrow Bookcase — White Stain', category: 'storage', recipe: 'hemnes_bookcase',
    description: 'Narrow solid-pine bookcase with framed sides and adjustable shelves. 49 × 37 × 197 cm.',
    defaultDimensions: { x: 0.49, y: 1.97, z: 0.37 }, placement: { mount: 'floor' },
    source: ikea('https://www.ikea.com/de/en/p/hemnes-bookcase-white-stain-40371763/', '40371763'),
  },
  {
    key: 'ikea_hemnes_49_light_brown', name: 'IKEA HEMNES Narrow Bookcase — Light Brown', category: 'storage', recipe: 'hemnes_bookcase',
    description: 'Narrow natural-pine bookcase with framed sides and adjustable shelves. 49 × 37 × 197 cm.',
    defaultDimensions: { x: 0.49, y: 1.97, z: 0.37 }, placement: { mount: 'floor' },
    source: ikea('https://www.ikea.com.tr/en/product/hemnes-light-brown-49x197-cm-bookcase-30371711', '30371711'),
  },
  {
    key: 'ikea_billy_80_white', name: 'IKEA BILLY Bookcase — White', category: 'storage', recipe: 'billy_bookcase',
    description: 'White bookcase with a recessed plinth and adjustable shelves. 80 × 28 × 202 cm.',
    defaultDimensions: { x: 0.8, y: 2.02, z: 0.28 }, placement: { mount: 'floor' },
    source: ikea('https://www.ikea.com.tr/en/product/billy-white-80x28x202-cm-bookcase-00263850', '00263850'),
  },
  ...BILLY_FINISHES.map(finish => ({
    key: `ikea_billy_oxberg_80_${finish.id.replace('billy_', '')}`,
    name: `IKEA BILLY / OXBERG Panel/Glass-Door Bookcase — ${finish.name.replace('BILLY ', '')}`,
    category: 'storage', recipe: 'billy_bookcase' as const, cabinetDoors: 2 as const, collection: 'IKEA BILLY / OXBERG',
    description: '80 × 30 × 202 cm bookcase with two 192 cm framed doors, upper clear glass, lower wood panels, round wood knobs and a recessed 10 cm plinth. Editable shelves and opening doors.',
    defaultDimensions: { x: .8, y: 2.02, z: .3 }, placement: { mount: 'floor' as const },
    aliases: [`billy_panel_glass_${finish.id.replace('billy_', '')}`, `billy_oxberg_${finish.id.replace('billy_', '')}`],
    source: { retailer: 'IKEA / user photo reference', dimensions: 'reference' as const, dimensionNotes: 'Nominal 80 × 30 × 202 cm case and 192 cm doors supplied by the user; wood knobs project 24 mm beyond the case front. Frame, panel/glass split, knobs and finish tones matched visually to the supplied photos; wood grain reuses bundled photographic veneer.' },
  })),
  ...BILLY_FINISHES.map(finish => ({
    key: `ikea_billy_oxberg_glass_80_${finish.id.replace('billy_', '')}`,
    name: `IKEA BILLY / OXBERG Full Glass-Door Bookcase — ${finish.name.replace('BILLY ', '')}`,
    category: 'storage', recipe: 'billy_bookcase' as const, cabinetDoors: 2 as const, collection: 'IKEA BILLY / OXBERG',
    description: '80 × 30 × 202 cm bookcase with two full-height framed glass doors, central wood rails, round knobs and a recessed 10 cm plinth. Opening doors and editable shelves.',
    defaultDimensions: { x: .8, y: 2.02, z: .3 }, placement: { mount: 'floor' as const },
    aliases: [`billy_full_glass_${finish.id.replace('billy_', '')}`],
    source: { retailer: 'IKEA', url: 'https://www.ikea.com/gb/en/p/oxberg-glass-door-white-90275617/', dimensions: 'reference' as const,
      dimensionNotes: 'Nominal 80 × 30 × 202 cm planning case with 192 cm doors above a 10 cm plinth. Full-glass door construction references OXBERG; wood knobs project 24 mm. Finish tones use the user photo references and bundled photographic veneer grain.' },
  })),
  ...BILLY_FINISHES.flatMap(finish => [false, true].map(glass => ({
    key: `ikea_billy_${glass ? 'oxberg_' : ''}extension_80_${finish.id.replace('billy_', '')}`,
    name: `IKEA BILLY${glass ? ' / OXBERG' : ''} Height Extension — ${glass ? 'Glass Doors' : 'Open'} — ${finish.name.replace('BILLY ', '')}`,
    category: 'storage', recipe: 'billy_bookcase' as const, cabinetDoors: (glass ? 2 : 0) as 0 | 2, collection: 'IKEA BILLY / OXBERG',
    description: `80 × ${glass ? '30' : '28'} × 35 cm height extension for the 202 cm BILLY. ${glass ? 'Two opening framed glass doors and wood knobs.' : 'Open front.'} Sits on the existing bookcase top without a second base or plinth; combined height 237 cm.`,
    defaultDimensions: { x: .8, y: .35, z: glass ? .3 : .28 }, placement: { mount: 'surface' as const, defaultElevation: 2.02 },
    aliases: [`billy_extender_${glass ? 'glass_' : ''}${finish.id.replace('billy_', '')}`],
    source: { retailer: 'IKEA', url: 'https://www.ikea.com/gb/en/p/billy-height-extension-unit-white-40263853/', dimensions: 'reference' as const,
      dimensionNotes: 'BILLY extension body listed at 80 × 28 × 35 cm; nominal 30 cm depth with OXBERG doors, plus 24 mm knob projection. Open bottom rests on the existing bookcase top. Finish tones use the user photo references and bundled photographic veneer grain.' },
  }))),
];
