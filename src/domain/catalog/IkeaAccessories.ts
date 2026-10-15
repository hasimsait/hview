import type { AssetDefinition, AssetPlacement } from './AssetDefinition';
import type { AccessoryModel } from './AccessoryModel';

const WHITE = '#f4f1e9', BLACK = '#242427', GREY = '#62666a', BEIGE = '#cbbda6', GREEN = '#64796b', PINK = '#d6a4a4', GOLD = '#c4a35b', WOOD = '#c7a576';
const shelf: AssetPlacement = { mount: 'surface', defaultElevation: .75 };
const counter: AssetPlacement = { mount: 'surface', defaultElevation: .9 };
const wall: AssetPlacement = { mount: 'wall', defaultElevation: 1.35 };
const floor: AssetPlacement = { mount: 'floor' };
const guide = 'https://www.ikea.com/gb/en/files/pdf/5b/0b/5b0b019f/billy_buying_guide_feb_22.pdf';
type Options = Partial<Omit<AccessoryModel, 'kind' | 'color'>> & {
  placement?: AssetPlacement; estimate?: string; url?: string; description?: string;
};

/** Sizes are W × D × H in cm. Any unpublished extent is explicitly an estimate. */
function product(article: string, range: string, label: string, collection: string, kind: AccessoryModel['kind'], size: [number, number, number], color: string, slug: string, options: Options = {}): AssetDefinition {
  const { placement, estimate, url, description, ...model } = options;
  const isLamp = kind.endsWith('_lamp');
  const category = collection === 'Kitchen accessories' ? 'kitchen' : collection === 'Bathroom accessories' ? 'bathroom'
    : ['Storage boxes', 'Baskets', 'Trolleys', 'Desk organisers'].includes(collection) ? 'storage' : kind === 'tray_table' ? 'table' : 'decor';
  return {
    key: `ikea_${article}`, name: `IKEA ${range} ${label}`, category, collection, recipe: 'ikea_accessory',
    description: description ?? `${label}. Editable ${collection.toLowerCase()} model${estimate ? '; some planning dimensions are estimated' : ' using published product dimensions'}.`,
    defaultDimensions: { x: size[0] / 100, z: size[1] / 100, y: size[2] / 100 },
    placement: placement ?? (['rug', 'trolley', 'basket', 'bin', 'brush', 'floor_lamp', 'tray_table'].includes(kind) ? floor
      : ['round_mirror', 'rectangular_mirror', 'picture_frame', 'clock', 'pegboard', 'ledge', 'spice_rack'].includes(kind) ? { ...wall, wallOffset: size[1] / 200 + .005 } : shelf),
    accessory: { kind, color, ...model },
    capabilities: isLamp ? { lighting: { type: 'diffuse', defaultColor: '#fff5ea', defaultIntensity: 1 } } : undefined,
    source: { retailer: 'IKEA', productCode: article, url: url ?? `https://www.ikea.com/gb/en/p/${slug}-${article}/`, dimensions: estimate ? 'estimated' : 'listed', dimensionNotes: estimate },
  };
}

export const IKEA_ACCESSORIES: readonly AssetDefinition[] = [
  // Vases: hollow profiles rather than solid cylinders.
  product('10470991', 'PÅDRAG', 'Vase — Clear Glass, 17 cm', 'Vases', 'vase', [12, 12, 17], WHITE, 'padrag-vase-clear-glass', { material: 'glass', style: 'ribbed' }),
  product('20406297', 'BERÄKNA', 'Vase — Clear Glass, 30 cm', 'Vases', 'vase', [16, 16, 30], WHITE, 'beraekna-vase-clear-glass', { material: 'glass' }),
  product('20327945', 'BERÄKNA', 'Vase — Clear Glass, 18 cm', 'Vases', 'vase', [15, 15, 18], WHITE, 'beraekna-vase-clear-glass', { material: 'glass', style: 'rounded' }),
  product('80457774', 'BERÄKNA', 'Bud Vase — Clear Glass, 15 cm', 'Vases', 'vase', [6, 6, 15], WHITE, 'beraekna-vase-clear-glass', { material: 'glass', style: 'bottle' }),
  product('90611949', 'BERÄKNA', 'Vase — Light Pink Glass, 18 cm', 'Vases', 'vase', [15, 15, 18], PINK, 'beraekna-vase-glass-light-pink', { material: 'glass', style: 'rounded' }),
  product('20511953', 'KONSTFULL', 'Vase — Patterned Clear Glass, 26 cm', 'Vases', 'vase', [16, 16, 26], WHITE, 'konstfull-vase-clear-glass-patterned', { material: 'glass', style: 'ribbed' }),
  product('60511951', 'KONSTFULL', 'Vase — Patterned Clear Glass, 10 cm', 'Vases', 'vase', [10, 10, 10], WHITE, 'konstfull-vase-clear-glass-patterned', { material: 'glass', style: 'rounded', estimate: 'Published height 10 cm; diameter estimated at 10 cm.', url: 'https://www.ikea.com/se/en/p/konstfull-vase-clear-glass-patterned-60511951/' }),
  product('30511962', 'KONSTFULL', 'Vase — Green Glass, 19 cm', 'Vases', 'vase', [15, 15, 19], GREEN, 'konstfull-vase-green', { material: 'glass', style: 'rounded', estimate: 'Published height 19 cm; diameter estimated at 15 cm.', url: 'https://www.ikea.com/ma/en/p/konstfull-vase-green-30511962/' }),
  product('10635181', 'PÄRLGLADA', 'Vase — Clear Glass, 24 cm', 'Vases', 'vase', [9, 9, 24], WHITE, 'paerlglada-vase-clear-glass', { material: 'glass', style: 'ribbed' }),
  product('70635183', 'PÄRLGLADA', 'Vase — Clear Glass, 18 cm', 'Vases', 'vase', [8, 8, 18], WHITE, 'paerlglada-vase-clear-glass', { material: 'glass', style: 'ribbed' }),

  // Plant pots use the outside diameter, not the nursery-pot size in the title.
  product('60414078', 'GRADVIS', 'Plant Pot — Pink, 12 cm', 'Plant pots', 'plant_pot', [13, 13, 12], PINK, 'gradvis-plant-pot-pink', { material: 'ceramic', style: 'ribbed' }),
  product('40414079', 'GRADVIS', 'Plant Pot — Grey, 15 cm', 'Plant pots', 'plant_pot', [16, 16, 15], GREY, 'gradvis-plant-pot-grey', { material: 'ceramic', style: 'ribbed' }),
  product('60609231', 'DAKSJUS', 'Plant Pot — Dark Green, 12 cm', 'Plant pots', 'plant_pot', [14, 14, 13.5], '#405e46', 'daksjus-plant-pot-dark-green', { material: 'ceramic', estimate: 'Published height 13.5 cm; outside diameter estimated at 14 cm.' }),
  product('00609229', 'DAKSJUS', 'Plant Pot — Light Green, 15 cm', 'Plant pots', 'plant_pot', [17, 17, 16], '#a1b28c', 'daksjus-plant-pot-light-green', { material: 'ceramic', estimate: 'Published height 16 cm; outside diameter estimated at 17 cm.' }),
  product('30454891', 'MUSKOTBLOMMA', 'Plant Pot with Saucer — Terracotta, 15 cm', 'Plant pots', 'plant_pot', [18, 18, 16], '#b46e4e', 'muskotblomma-plant-pot-with-saucer-in-outdoor-terracotta', { material: 'ceramic', style: 'saucer', estimate: 'Published height 16 cm and nursery-pot diameter 15 cm; saucer footprint estimated at 18 cm.' }),
  product('00454883', 'MUSKOTBLOMMA', 'Plant Pot with Saucer — Terracotta, 12 cm', 'Plant pots', 'plant_pot', [15, 15, 13], '#b46e4e', 'muskotblomma-plant-pot-with-saucer-in-outdoor-terracotta', { material: 'ceramic', style: 'saucer', estimate: 'Published nursery-pot diameter 12 cm; outside footprint and height estimated.' }),
  product('30544458', 'BUSKVERK', 'Plant Pot — Grey, 9 cm', 'Plant pots', 'plant_pot', [10, 10, 9], '#95958d', 'buskverk-plant-pot-in-outdoor-grey', { material: 'ceramic', estimate: 'Published height 9 cm; outside diameter estimated at 10 cm.' }),
  product('00533574', 'SOJABÖNA', 'Plant Pot — White, 9 cm', 'Plant pots', 'plant_pot', [10, 10, 10], WHITE, 'sojaboena-plant-pot-white', { material: 'ceramic', estimate: 'Published nursery-pot diameter 9 cm; outside diameter and height estimated at 10 cm.' }),
  product('00510836', 'SKOGSVINBÄR', 'Plant Pot — Grey, 24 cm', 'Plant pots', 'plant_pot', [27, 27, 25], '#888b86', 'skogsvinbaer-plant-pot-in-outdoor-grey', { material: 'ceramic', estimate: 'Published height 25 cm; outside diameter estimated at 27 cm.' }),

  // Foliage spread is adjustable and varies; published height is preserved.
  product('50621002', 'FEJKA', 'Artificial Potted Grass — 21 cm', 'Artificial plants', 'plant', [20, 20, 21], '#658347', 'fejka-artificial-potted-plant-in-outdoor-grass', { style: 'grass', estimate: 'Published height 21 cm; foliage spread estimated at 20 cm.' }),
  product('40452368', 'FEJKA', 'Artificial Potted Eucalyptus — 65 cm', 'Artificial plants', 'plant', [40, 40, 65], '#81967a', 'fejka-artificial-potted-plant-in-outdoor-eucalyptus', { estimate: 'Published height 65 cm; foliage spread estimated at 40 cm.' }),
  product('20615234', 'FEJKA', 'Artificial White Orchid — 58 cm', 'Artificial plants', 'plant', [32, 26, 58], '#477449', 'fejka-artificial-potted-plant-orchid-white', { style: 'orchid', estimate: 'Published height 58 cm; foliage spread estimated at 32 × 26 cm.' }),
  product('40610607', 'FEJKA', 'Artificial Potted Bamboo — 180 cm', 'Artificial plants', 'plant', [65, 65, 180], '#5a7a43', 'fejka-artificial-potted-plant-in-outdoor-bamboo', { placement: floor, style: 'bamboo', estimate: 'Published height 180 cm; foliage spread estimated at 65 cm.' }),
  product('70610601', 'FEJKA', 'Artificial Bird of Paradise — 180 cm', 'Artificial plants', 'plant', [90, 75, 180], '#426c42', 'fejka-artificial-potted-plant-in-outdoor-bird-of-paradise', { placement: floor, style: 'broadleaf', estimate: 'Published height 180 cm; foliage spread estimated at 90 × 75 cm.' }),
  product('30615276', 'FEJKA', 'Artificial Weeping Fig — 170 cm', 'Artificial plants', 'plant', [75, 75, 170], '#587347', 'fejka-artificial-potted-plant-in-outdoor-weeping-fig', { placement: floor, estimate: 'Published height 170 cm; foliage spread estimated at 75 cm.' }),
  product('10610604', 'FEJKA', 'Artificial Weeping Fig — 210 cm', 'Artificial plants', 'plant', [90, 90, 210], '#587347', 'fejka-artificial-potted-plant-in-outdoor-weeping-fig', { placement: floor, estimate: 'Published height 210 cm; foliage spread estimated at 90 cm.' }),

  product('40342134', 'FULLTALIG', 'Candlesticks — Black, Set of 3', 'Candles & lanterns', 'candlesticks', [30, 12, 20], BLACK, 'fulltalig-candlestick-set-of-3-black', { material: 'metal', estimate: 'Published holder heights 10, 15 and 20 cm; arranged set footprint estimated at 30 × 12 cm.' }),
  product('00608970', 'FULLTALIG', 'Candlesticks — Brass Colour, Set of 3', 'Candles & lanterns', 'candlesticks', [30, 12, 20], GOLD, 'fulltalig-candlestick-set-of-3-brass-colour', { material: 'metal', estimate: 'Holder heights 10, 15 and 20 cm; arranged set footprint estimated at 30 × 12 cm.' }),
  product('10156109', 'BORRBY', 'Pillar Candle Lantern — Black, 28 cm', 'Candles & lanterns', 'lantern', [15, 15, 28], BLACK, 'borrby-lantern-for-block-candle-in-outdoor-black', { material: 'metal' }),
  product('30270142', 'BORRBY', 'Pillar Candle Lantern — White, 28 cm', 'Candles & lanterns', 'lantern', [15, 15, 28], WHITE, 'borrby-lantern-for-block-candle-in-outdoor-white', { material: 'metal' }),
  product('10608856', 'BORRBY', 'Tealight Lantern — White, 20 cm', 'Candles & lanterns', 'lantern', [11, 11, 20], WHITE, 'borrby-lantern-for-tealight-in-outdoor-white', { material: 'metal', estimate: 'Published height 20 cm; footprint estimated at 11 × 11 cm.' }),
  product('60259143', 'GLASIG', 'Candle Dish — Clear Glass, 10 × 10 cm', 'Candles & lanterns', 'dish', [10, 10, 1.5], WHITE, 'glasig-candle-dish-clear-glass', { material: 'glass', estimate: 'Published footprint 10 × 10 cm; height estimated at 1.5 cm.' }),

  product('70590448', 'LINDBYN', 'Round Mirror — Black, 50 cm', 'Mirrors', 'round_mirror', [50, 2.5, 50], BLACK, 'lindbyn-mirror-black', { material: 'metal', estimate: 'Published diameter 50 cm; frame depth estimated at 2.5 cm.' }),
  product('90439218', 'LINDBYN', 'Round Mirror — Black, 110 cm', 'Mirrors', 'round_mirror', [110, 2.5, 110], BLACK, 'lindbyn-mirror-black', { material: 'metal', estimate: 'Published diameter 110 cm; frame depth estimated at 2.5 cm.' }),
  product('80485569', 'LINDBYN', 'Round Mirror — Gold Colour, 80 cm', 'Mirrors', 'round_mirror', [80, 2.5, 80], GOLD, 'lindbyn-mirror-gold-colour', { material: 'metal', estimate: 'Published diameter 80 cm; frame depth estimated at 2.5 cm.' }),
  product('50600293', 'LINDBYN', 'Round Mirror — Gold Colour, 50 cm', 'Mirrors', 'round_mirror', [50, 2.5, 50], GOLD, 'lindbyn-mirror-gold-colour', { material: 'metal', estimate: 'Published diameter 50 cm; frame depth estimated at 2.5 cm.' }),
  product('20458615', 'LINDBYN', 'Rounded Rectangle Mirror — Black, 40 × 130 cm', 'Mirrors', 'rectangular_mirror', [40, 2.5, 130], BLACK, 'lindbyn-mirror-black', { style: 'rounded', estimate: 'Published width and height; frame depth estimated at 2.5 cm.' }),
  product('30590445', 'LINDBYN', 'Rounded Rectangle Mirror — Black, 28 × 60 cm', 'Mirrors', 'rectangular_mirror', [28, 2.5, 60], BLACK, 'lindbyn-mirror-black', { style: 'rounded', estimate: 'Published width and height; frame depth estimated at 2.5 cm.' }),
  product('30458610', 'LINDBYN', 'Rounded Rectangle Mirror — Black, 60 × 120 cm', 'Mirrors', 'rectangular_mirror', [60, 2.5, 120], BLACK, 'lindbyn-mirror-black', { style: 'rounded', estimate: 'Published width and height; frame depth estimated at 2.5 cm.' }),
  product('50605484', 'NISSEDAL', 'Square Mirror — Black, 65 × 65 cm', 'Mirrors', 'rectangular_mirror', [65, 2, 65], BLACK, 'nissedal-mirror-black', { estimate: 'Published width and height; frame depth estimated at 2 cm.' }),
  product('50295660', 'FISKBO', 'Picture Frame — Black, 30 × 40 cm Print', 'Picture frames', 'picture_frame', [33, 1, 43], BLACK, 'fiskbo-frame-black'),
  product('50295655', 'FISKBO', 'Picture Frame — Black, 40 × 50 cm Print', 'Picture frames', 'picture_frame', [43, 1, 53], BLACK, 'fiskbo-frame-black', { estimate: 'Published print size 40 × 50 cm; outer frame estimated at 43 × 53 × 1 cm.' }),
  product('50297961', 'FISKBO', 'Picture Frame — Black, 50 × 70 cm Print', 'Picture frames', 'picture_frame', [53, 1, 73], BLACK, 'fiskbo-frame-black', { estimate: 'Published print size 50 × 70 cm; outer frame estimated at 53 × 73 × 1 cm.' }),
  product('00300353', 'FISKBO', 'Picture Frame — Black, 10 × 15 cm Print', 'Picture frames', 'picture_frame', [13, 1, 18], BLACK, 'fiskbo-frame-black', { estimate: 'Published print size 10 × 15 cm; outer frame estimated at 13 × 18 × 1 cm.' }),
  product('00286762', 'LOMVIKEN', 'Picture Frame — Aluminium, 30 × 40 cm Print', 'Picture frames', 'picture_frame', [30.5, 2, 40.5], '#b9bdc2', 'lomviken-frame-aluminium', { material: 'metal', estimate: 'Published print size 30 × 40 cm; outside frame and depth estimated.', url: 'https://www.ikea.com/kr/en/p/lomviken-frame-aluminium-00286762/' }),
  product('30557078', 'TROMMA', 'Wall Clock — White, 25 cm', 'Clocks', 'clock', [25, 4, 25], WHITE, 'tromma-wall-clock-white', { estimate: 'Published diameter 25 cm; depth estimated at 4 cm.' }),
  product('30540851', 'PLUTTIS', 'Wall Clock — Red, 28 cm', 'Clocks', 'clock', [28, 4, 28], '#aa3b32', 'pluttis-wall-clock-red', { estimate: 'Published diameter 28 cm; depth estimated at 4 cm.' }),

  // Official buying guide specifies each article and full W × D × H.
  ...([
    ['10395421', 'TJENA', 'Lidded Storage Box — White, Small', [18, 25, 15], WHITE],
    ['60395485', 'TJENA', 'Lidded Storage Box — Black, Small', [18, 25, 15], BLACK],
    ['90395422', 'TJENA', 'Lidded Storage Box — White, Shallow', [25, 35, 10], WHITE],
    ['40395486', 'TJENA', 'Lidded Storage Box — Black, Shallow', [25, 35, 10], BLACK],
    ['60395428', 'TJENA', 'Lidded Storage Box — White, Medium', [25, 35, 20], WHITE],
    ['30395477', 'TJENA', 'Lidded Storage Box — Black, Medium', [25, 35, 20], BLACK],
    ['20280207', 'KUGGIS', 'Lidded Storage Box — White, Small', [18, 26, 8], WHITE],
    ['60280205', 'KUGGIS', 'Lidded Storage Box — White, Medium', [26, 35, 15], WHITE],
    ['40477665', 'TJOG', 'Lidded Storage Box — Dark Grey', [25, 36, 15], GREY],
    ['70474608', 'TJOG', 'Lidded Storage Box — Dark Beige', [25, 36, 15], BEIGE],
    ['40474596', 'BULLIG', 'Storage Box — Bamboo / Brown', [25, 32, 25], WOOD],
  ] as const).map(([code, range, label, size, color]) => product(code, range, label, 'Storage boxes', 'storage_box', [...size], color, '', { style: range === 'BULLIG' ? undefined : 'lidded', url: guide, material: range === 'BULLIG' ? 'wood' : 'paint' })),
  product('70515500', 'DRÖNJÖNS', 'Mesh Storage Box — White', 'Storage boxes', 'storage_box', [33, 37, 33], WHITE, 'droenjoens-storage-box-white', { url: 'https://www.ikea.com/no/en/p/droenjoens-storage-box-white-70515500/', material: 'metal' }),

  product('60322173', 'FLÅDIS', 'Woven Seagrass Basket — 25 cm', 'Baskets', 'basket', [25, 25, 32], WOOD, 'fladis-basket-seagrass', { style: 'woven', material: 'wood' }),
  product('20110540', 'KNIPSA', 'Seagrass Storage Basket', 'Baskets', 'storage_box', [32, 33, 32], WOOD, 'knipsa-basket-seagrass', { style: 'woven', material: 'wood', placement: floor }),
  product('20588711', 'RISATORP', 'Mesh Basket — Dark Grey', 'Baskets', 'wire_basket', [25, 26, 18], GREY, 'risatorp-basket-dark-grey', { material: 'metal' }),
  product('80588690', 'RISATORP', 'Mesh Basket — Pink', 'Baskets', 'wire_basket', [25, 26, 18], PINK, 'risatorp-basket-pink', { material: 'metal' }),
  product('10618172', 'RISATORP', 'Mesh Basket — Bright Red', 'Baskets', 'wire_basket', [25, 26, 18], '#b83831', 'risatorp-basket-bright-red', { material: 'metal' }),
  product('00527634', 'RISATORP', 'Divided Basket — White, Tall', 'Baskets', 'wire_basket', [33, 24, 23], WHITE, 'risatorp-basket-with-compartments-white', { style: 'compartments', material: 'metal' }),
  product('50527636', 'RISATORP', 'Divided Basket — White, Shallow', 'Baskets', 'wire_basket', [33, 24, 11], WHITE, 'risatorp-basket-with-compartments-white', { style: 'compartments', material: 'metal' }),
  product('20527633', 'RISATORP', 'Large Mesh Basket — White', 'Baskets', 'wire_basket', [27, 42, 23], WHITE, 'risatorp-basket-white', { material: 'metal' }),

  ...([
    ['30586783', 'White', WHITE, 'white', [35, 45, 77]],
    ['40582181', 'Black', BLACK, 'black', [35, 45, 77]],
    ['10586784', 'Grey-Blue', '#788c9b', 'grey-blue', [35, 45, 77]],
    ['20591662', 'Grey-Green', GREEN, 'grey-green', [35, 45, 77]],
    ['30629711', 'Beige', BEIGE, 'beige', [35, 45, 77]],
    ['00586789', 'White, Compact', WHITE, 'white', [28, 38, 61]],
    ['50591769', 'Grey-Green, Compact', GREEN, 'grey-green', [28, 38, 61]],
    ['10591766', 'Grey-Blue, Compact', '#788c9b', 'grey-blue', [28, 38, 61]],
  ] as const).map(([code, label, color, slug, size]) => product(code, 'RÅSKOG', `Three-Tier Trolley — ${label}`, 'Trolleys', 'trolley', [...size], color, `raskog-trolley-${slug}`, { style: 'rounded', material: 'metal' })),
  ...([
    ['20399777', 'Black', BLACK, 'black'], ['40465733', 'White', WHITE, 'white'],
    ['40585801', 'Beige', BEIGE, 'beige'], ['10606782', 'Light Green', '#a5b6a1', 'light-green'],
  ] as const).map(([code, label, color, slug]) => product(code, 'NISSAFORS', `Three-Tier Trolley — ${label}`, 'Trolleys', 'trolley', [50.5, 30, 83], color, `nissafors-trolley-${slug}`, { material: 'metal' })),

  product('10321618', 'SKÅDIS', 'Pegboard — White, 76 × 56 cm', 'Wall organisers', 'pegboard', [76, 2.5, 56], WHITE, 'skadis-pegboard-white', { estimate: 'Published width and height; installed depth estimated at 2.5 cm.' }),
  product('50534378', 'SKÅDIS', 'Pegboard — Black, 76 × 56 cm', 'Wall organisers', 'pegboard', [76, 2.5, 56], BLACK, 'skadis-pegboard-black', { estimate: 'Published width and height; installed depth estimated at 2.5 cm.' }),
  product('50320805', 'SKÅDIS', 'Pegboard — White, 36 × 56 cm', 'Wall organisers', 'pegboard', [36, 2.5, 56], WHITE, 'skadis-pegboard-white', { estimate: 'Published width and height; installed depth estimated at 2.5 cm.' }),
  product('00320803', 'SKÅDIS', 'Pegboard — White, 56 × 56 cm', 'Wall organisers', 'pegboard', [56, 2.5, 56], WHITE, 'skadis-pegboard-white', { estimate: 'Published width and height; installed depth estimated at 2.5 cm.' }),
  ...([
    ['40291766', 'White, 55 cm', WHITE, 'white', 55], ['20291767', 'Black, 55 cm', BLACK, 'black', 55],
    ['90292103', 'White, 115 cm', WHITE, 'white', 115], ['70292104', 'Black, 115 cm', BLACK, 'black', 115],
    ['70586941', 'Oak Effect, 115 cm', WOOD, 'oak-effect', 115], ['70586936', 'Walnut Effect, 55 cm', '#765640', 'walnut-effect', 55],
  ] as const).map(([code, label, color, slug, width]) => product(code, 'MOSSLANDA', `Picture Ledge — ${label}`, 'Wall organisers', 'ledge', [width, 12, 6], color, `mosslanda-picture-ledge-${slug}`, { estimate: 'Published length; planning depth 12 cm and height 6 cm are estimates.' })),
  product('20487175', 'BEKVÄM', 'Wall-Mounted Spice Rack — Aspen', 'Kitchen accessories', 'spice_rack', [40, 10, 9], WOOD, 'bekvaem-spice-rack-aspen', { material: 'wood' }),

  product('50213546', 'KORKEN', 'Glass Jar with Clip-Top Lid — 1 L', 'Kitchen accessories', 'jar', [12, 12, 16.5], WHITE, 'korken-jar-with-lid-clear-glass', { material: 'glass', placement: counter }),
  product('70213545', 'KORKEN', 'Glass Jar with Clip-Top Lid — 0.5 L', 'Kitchen accessories', 'jar', [11, 11, 10.5], WHITE, 'korken-jar-with-lid-clear-glass', { material: 'glass', placement: counter, estimate: 'Published height 10.5 cm; diameter estimated at 11 cm.' }),
  product('70213550', 'KORKEN', 'Glass Jar with Clip-Top Lid — 1.8 L', 'Kitchen accessories', 'jar', [12, 12, 21.5], WHITE, 'korken-jar-with-lid-clear-glass', { material: 'glass', placement: counter, estimate: 'Published height 21.5 cm; diameter estimated at 12 cm.' }),
  product('90213549', 'KORKEN', 'Glass Jar with Clip-Top Lid — 2 L', 'Kitchen accessories', 'jar', [11, 11, 30.5], WHITE, 'korken-jar-with-lid-clear-glass', { material: 'glass', placement: counter, estimate: 'Published height 30.5 cm; diameter estimated at 11 cm.' }),
  product('10541366', 'KORKEN', 'Bottle-Shaped Glass Jar — 1 L', 'Kitchen accessories', 'jar', [9, 9, 23], WHITE, 'korken-bottle-shaped-jar-with-lid-clear-glass', { material: 'glass', style: 'bottle', placement: counter, estimate: 'Published height 23 cm; diameter estimated at 9 cm.' }),
  product('50541374', 'KORKEN', 'Bottle-Shaped Glass Jar — 1.4 L', 'Kitchen accessories', 'jar', [10, 10, 28], WHITE, 'korken-bottle-shaped-jar-with-lid-clear-glass', { material: 'glass', style: 'bottle', placement: counter, estimate: 'Published height 28 cm; diameter estimated at 10 cm.' }),
  product('30011832', 'ORDNING', 'Cutlery Stand — Stainless Steel, 13.5 cm', 'Kitchen accessories', 'utensil_holder', [12, 12, 13.5], '#b5bdc4', 'ordning-cutlery-stand-stainless-steel', { material: 'metal', placement: counter }),
  product('20605881', 'ORDNING', 'Cutlery Stand — White, 13.5 cm', 'Kitchen accessories', 'utensil_holder', [12, 12, 13.5], WHITE, 'ordning-cutlery-stand-white', { material: 'metal', placement: counter }),
  product('30131716', 'ORDNING', 'Kitchen Utensil Holder — Stainless Steel, 18 cm', 'Kitchen accessories', 'utensil_holder', [12, 12, 18], '#b5bdc4', 'ordning-kitchen-utensil-rack-stainless-steel', { material: 'metal', placement: counter }),
  product('80233430', 'APTITLIG', 'Bamboo Chopping Board — 45 × 28 cm', 'Kitchen accessories', 'chopping_board', [45, 28, 1.6], WOOD, 'aptitlig-chopping-board-bamboo', { material: 'wood', placement: counter, estimate: 'Published length and width; thickness estimated at 1.6 cm.' }),
  product('60233426', 'APTITLIG', 'Bamboo Chopping Board — 24 × 15 cm', 'Kitchen accessories', 'chopping_board', [24, 15, 1.2], WOOD, 'aptitlig-chopping-board-bamboo', { material: 'wood', placement: counter, estimate: 'Published length and width; thickness estimated at 1.2 cm.' }),

  product('90322303', 'TACKAN', 'Soap Dispenser — White / Clear Glass', 'Bathroom accessories', 'soap_pump', [6, 6, 17], WHITE, 'tackan-soap-dispenser-white', { material: 'glass', placement: counter, estimate: 'Published diameter 6 cm; height estimated at 17 cm.' }),
  product('60493004', 'EKOLN', 'Soap Dispenser — Beige', 'Bathroom accessories', 'soap_pump', [8, 8, 18], BEIGE, 'ekoln-soap-dispenser-beige', { material: 'ceramic', placement: counter, estimate: 'Published height 18 cm; footprint estimated at 8 cm.', url: 'https://www.ikea.com/qa/en/p/ekoln-soap-dispenser-beige-60493004/' }),
  product('40441619', 'EKOLN', 'Soap Dispenser — Dark Grey', 'Bathroom accessories', 'soap_pump', [8, 8, 18], GREY, 'ekoln-soap-dispenser-dark-grey', { material: 'ceramic', placement: counter, estimate: 'Published height 18 cm; footprint estimated at 8 cm.', url: 'https://www.ikea.com/ae/en/p/ekoln-soap-dispenser-dark-grey-40441619/' }),
  product('50618226', 'EKOLN', 'Soap Dispenser — Dark Yellow', 'Bathroom accessories', 'soap_pump', [8, 8, 18], '#b39449', 'ekoln-soap-dispenser-dark-yellow', { material: 'ceramic', placement: counter, estimate: 'Published height 18 cm; footprint estimated at 8 cm.', url: 'https://www.ikea.com/qa/en/p/ekoln-soap-dispenser-dark-yellow-50618226/' }),
  product('00441621', 'EKOLN', 'Toothbrush Holder — Dark Grey', 'Bathroom accessories', 'tumbler', [9, 6, 11], GREY, 'ekoln-toothbrush-holder-dark-grey', { material: 'ceramic', placement: counter, estimate: 'Published height 11 cm; footprint estimated at 9 × 6 cm.' }),
  product('20493001', 'EKOLN', 'Soap Dish — Beige', 'Bathroom accessories', 'soap_dish', [13, 9, 2], BEIGE, 'ekoln-soap-dish-beige', { material: 'ceramic', placement: counter, estimate: 'Published length and width; height estimated at 2 cm.' }),
  product('70618225', 'EKOLN', 'Soap Dish — Dark Yellow', 'Bathroom accessories', 'soap_dish', [13, 9, 2], '#b39449', 'ekoln-soap-dish-dark-yellow', { material: 'ceramic', placement: counter, estimate: 'Published length and width; height estimated at 2 cm.' }),
  product('90493007', 'EKOLN', 'Toilet Brush Set — Beige', 'Bathroom accessories', 'brush', [10, 10, 38], BEIGE, 'ekoln-toilet-brush-beige', { material: 'ceramic', estimate: 'Published height 38 cm; footprint estimated at 10 cm.', url: 'https://www.ikea.com/qa/en/p/ekoln-toilet-brush-beige-90493007/' }),
  product('20593736', 'EKOLN', 'Lidded Waste Bin — Grey-Turquoise, 3 L', 'Bathroom accessories', 'bin', [17, 17, 24], '#8ba4a2', 'ekoln-waste-bin-light-grey-turquoise', { estimate: 'Published height 24 cm; footprint estimated at 17 cm.' }),

  product('80494880', 'DRÖNJÖNS', 'Mesh Pen Cup — White', 'Desk organisers', 'pen_cup', [10, 10, 11], WHITE, 'droenjoens-pen-cup-white', { material: 'metal', estimate: 'Planning dimensions estimated at 10 × 10 × 11 cm.', url: 'https://www.ikea.com/sg/en/p/droenjoens-pen-cup-white-80494880/' }),
  product('10439694', 'DRÖNJÖNS', 'Mesh Magazine File — White', 'Desk organisers', 'magazine_file', [10, 25, 30], WHITE, 'dronjons-magazine-file-white', { material: 'metal', estimate: 'Planning dimensions estimated at 10 × 25 × 30 cm.', url: 'https://www.ikea.com/es/en/p/dronjons-magazine-file-white-10439694/' }),
  product('60460107', 'DRÖNJÖNS', 'Mesh Wastepaper Basket — White', 'Desk organisers', 'bin', [25, 25, 35], WHITE, 'droenjoens-wastepaper-basket-white', { material: 'metal', estimate: 'Planning dimensions estimated at 25 × 25 × 35 cm.' }),

  // Covers are shown with a filled cushion for planning; fill depth is an estimate.
  ...([
    ['80598731', 'Unbleached', WHITE, 'unbleached', 50], ['00598725', 'White', '#ffffff', 'white', 50],
    ['90598759', 'Yellow', '#cba34c', 'yellow', 50], ['20598748', 'Green', '#66856b', 'green', 50],
    ['50598737', 'Dark Grey', GREY, 'dark-grey', 50], ['70598755', 'Pink', PINK, 'pink', 50],
    ['70598779', 'Unbleached', WHITE, 'unbleached', 65], ['40598785', 'Yellow', '#cba34c', 'yellow', 65],
  ] as const).map(([code, label, color, slug, width]) => product(code, 'GURLI', `Cushion Cover — ${label}, ${width} × ${width} cm`, 'Cushions', 'cushion', [width, 14, width], color, `gurli-cushion-cover-${slug}`, { material: 'fabric', placement: { mount: 'surface', defaultElevation: .45 }, estimate: 'Published cover width and height; shown filled with an estimated 14 cm depth. Inner cushion sold separately.' })),
  ...([
    ['20470047', 'Black / Natural, 155 × 220 cm', 'black-natural', 155, 220],
    ['20528878', 'Black / Natural, 80 × 150 cm', 'black-natural', 80, 150],
    ['40456757', 'Natural / Black, 120 × 180 cm', 'natural-black', 120, 180],
    ['40592825', 'Natural / Black, 50 × 80 cm', 'natural-black', 50, 80],
  ] as const).map(([code, label, slug, width, depth]) => product(code, 'TIPHEDE', `Flatwoven Rug — ${label}`, 'Rugs', 'rug', [width, depth, .3], slug === 'black-natural' ? '#79766d' : '#c9bfa9', `tiphede-rug-flatwoven-${slug}`, { material: 'fabric', estimate: 'Published width and length; thickness estimated at 3 mm.' })),

  product('60358015', 'TOKABO', 'Mushroom Table Lamp — Opal White Glass', 'Table lamps', 'mushroom_lamp', [13, 13, 15], WHITE, 'tokabo-table-lamp-glass-opal-white'),
  product('10096375', 'FADO', 'Globe Table Lamp — White Glass, 25 cm', 'Table lamps', 'globe_lamp', [25, 25, 24], WHITE, 'fado-table-lamp-white'),
  product('20592628', 'FADO', 'Globe Table Lamp — Pink Glass, 25 cm', 'Table lamps', 'globe_lamp', [25, 25, 24], PINK, 'fado-table-lamp-pink-glass'),
  product('90331388', 'RANARP', 'Adjustable Desk Lamp — Black', 'Table lamps', 'task_lamp', [25, 35, 42], BLACK, 'ranarp-work-lamp-black', { material: 'metal', estimate: 'Published height 42 cm and shade diameter 19 cm; posed footprint estimated at 25 × 35 cm.' }),
  product('70231318', 'RANARP', 'Adjustable Desk Lamp — Off-White', 'Table lamps', 'task_lamp', [25, 35, 42], WHITE, 'ranarp-work-lamp-off-white', { material: 'metal', estimate: 'Published height 42 cm; posed footprint estimated at 25 × 35 cm.' }),
  product('00331378', 'RANARP', 'Floor Reading Lamp — Black', 'Floor lamps', 'floor_lamp', [35, 55, 153], BLACK, 'ranarp-floor-reading-lamp-black', { material: 'metal', estimate: 'Published height 153 cm; posed footprint estimated at 35 × 55 cm.', url: 'https://www.ikea.com/qa/en/p/ranarp-floor-reading-lamp-black-00331378/' }),
  product('20390951', 'RANARP', 'Pendant Lamp — Black, 38 cm', 'Pendant lamps', 'pendant_lamp', [38, 38, 70], BLACK, 'ranarp-pendant-lamp-black', { material: 'metal', placement: { mount: 'ceiling', ceilingOffset: .7 }, estimate: 'Published shade diameter 38 cm and shade height 20 cm; total hanging drop estimated at 70 cm.' }),
  product('20390970', 'RANARP', 'Pendant Lamp — Off-White, 38 cm', 'Pendant lamps', 'pendant_lamp', [38, 38, 70], WHITE, 'ranarp-pendant-lamp-off-white', { material: 'metal', placement: { mount: 'ceiling', ceilingOffset: .7 }, estimate: 'Published shade diameter 38 cm and shade height 20 cm; total hanging drop estimated at 70 cm.' }),
  product('50411990', 'GLADOM', 'Tray Side Table — Black', 'Side tables', 'tray_table', [45, 45, 53], BLACK, 'gladom-tray-table-black', { material: 'metal' }),
  product('70337819', 'GLADOM', 'Tray Side Table — White', 'Side tables', 'tray_table', [45, 45, 53], WHITE, 'gladom-tray-table-white', { material: 'metal', url: 'https://www.ikea.com/de/en/p/gladom-tray-table-white-70337819/' }),
  product('70578451', 'GLADOM', 'Tray Side Table — Dark Grey-Green', 'Side tables', 'tray_table', [45, 45, 53], '#4b6359', 'gladom-tray-table-dark-grey-green', { material: 'metal', url: 'https://www.ikea.com/ae/en/p/gladom-tray-table-dark-grey-green-70578451/' }),
];
