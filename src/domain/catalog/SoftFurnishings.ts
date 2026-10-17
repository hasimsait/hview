import type { AssetDefinition, AssetPlacement } from './AssetDefinition';
import type { WindowDressingStyle } from '../model/WindowDressing';

export interface SoftFurnishingModel {
  kind: 'rug' | 'cushion' | 'throw' | 'bedding' | 'curtain' | 'blind' | 'towel';
  style: 'border' | 'striped' | 'geometric' | 'round' | 'runner' | 'shag' | 'jute' | 'square' | 'piped' | 'lumbar' | 'bolster' | 'draped' | 'fringed' | 'folded' | 'knitted' | 'duvet' | 'quilt' | 'pillows' | 'bed_runner' | 'bed_set' | 'diamond' | 'chevron' | 'checker' | 'grid' | WindowDressingStyle;
  color: string;
  accentColor: string;
  fabric?: 'linen' | 'velvet' | 'cotton' | 'knit' | 'jute';
}
const surface = (defaultElevation: number): AssetPlacement => ({ mount: 'surface', defaultElevation });
const ceiling: AssetPlacement = { mount: 'ceiling', ceilingOffset: 2.6, wallOffset: .11 };
function textile(key: string, name: string, collection: string, kind: SoftFurnishingModel['kind'], style: SoftFurnishingModel['style'], size: [number, number, number], color: string, accentColor: string, placement: AssetPlacement, description: string, fabric: SoftFurnishingModel['fabric'] = 'cotton'): AssetDefinition {
  const [x, y, z] = size;
  return { key: `textile_${key}`, name, collection, category: 'decor', recipe: 'soft_furnishing', defaultDimensions: { x, y, z }, placement,
    softFurnishing: { kind, style, color, accentColor, fabric }, capabilities: { resizable: true }, description,
    source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: `Adjustable planning dimensions. Fabric, colours and component finishes can be changed independently.${kind === 'curtain' ? ' Curtain drop fits the room height when added.' : ''}` } };
}
export const SOFT_FURNISHINGS: readonly AssetDefinition[] = [
  textile('rug_border', 'Bordered Wool-Style Rug', 'Rugs', 'rug', 'border', [2, .012, 3], '#d1c7b5', '#6a7166', { mount: 'floor' }, 'Soft rectangular rug with rounded corners, a contrasting woven border and bound edges.'),
  textile('rug_striped', 'Striped Flatwoven Rug', 'Rugs', 'rug', 'striped', [1.6, .006, 2.3], '#dfd7c5', '#67736f', { mount: 'floor' }, 'Low flatwoven rug with contrasting stripes and short fringe.'),
  textile('rug_geometric', 'Geometric Area Rug', 'Rugs', 'rug', 'geometric', [2, .01, 2.9], '#ded5c4', '#a66e53', { mount: 'floor' }, 'Rectangular woven rug with a repeating diamond motif and bound edges.'),
  textile('rug_round', 'Round Woven Rug', 'Rugs', 'rug', 'round', [1.8, .009, 1.8], '#c6b79d', '#a58d6b', { mount: 'floor' }, 'Circular woven rug with a contrasting outer binding.'),
  textile('rug_runner', 'Hallway Runner Rug', 'Rugs', 'rug', 'runner', [.8, .008, 2.5], '#787d72', '#d3c7ad', { mount: 'floor' }, 'Long narrow runner with a contrasting double border for entrances and hallways.'),
  textile('rug_shag', 'Deep-Pile Shag Rug', 'Rugs', 'rug', 'shag', [1.6, .035, 2.3], '#e1dacf', '#d4c9b8', { mount: 'floor' }, 'Thick rug with a softly irregular pile surface and rounded corners.'),
  textile('rug_jute', 'Natural Jute Rug', 'Rugs', 'rug', 'jute', [2, .01, 3], '#b99869', '#917448', { mount: 'floor' }, 'Natural-tone rectangular rug with raised woven bands and a bound edge.', 'jute'),
  textile('cushion_linen', 'Linen Scatter Cushion', 'Cushions', 'cushion', 'square', [.5, .5, .16], '#c7bea8', '#b6aa91', surface(.45), 'Plump square cushion with softly pinched corners and a stitched perimeter.', 'linen'),
  textile('cushion_velvet', 'Piped Velvet Cushion', 'Cushions', 'cushion', 'piped', [.5, .5, .16], '#315749', '#c1a86d', surface(.45), 'Padded velvet-look cushion with contrasting piping.', 'velvet'),
  textile('cushion_round', 'Round Tufted Cushion', 'Cushions', 'cushion', 'round', [.45, .45, .14], '#b97d62', '#93604b', surface(.45), 'Round cushion with a recessed centre button and a piped edge.', 'velvet'),
  textile('cushion_lumbar', 'Striped Lumbar Cushion', 'Cushions', 'cushion', 'lumbar', [.6, .3, .14], '#e0d7c4', '#777c70', surface(.45), 'Long rectangular support cushion with a contrasting stripe and piping.'),
  textile('cushion_bolster', 'Bolster Cushion', 'Cushions', 'cushion', 'bolster', [.6, .18, .18], '#87745e', '#c7b692', surface(.45), 'Cylindrical cushion with circular end panels and contrasting seams.'),
  textile('throw_draped', 'Draped Sofa Throw', 'Throws', 'throw', 'draped', [.7, .6, 1.1], '#8b9a8e', '#d7d0bd', surface(.05), 'Soft cloth laid across a seat or arm and hanging down its front edge. Adjust elevation to align its upper surface with the sofa.'),
  textile('throw_fringe', 'Fringed Cotton Throw', 'Throws', 'throw', 'fringed', [.8, .55, 1.2], '#d5c7ad', '#b49d7c', surface(.05), 'Draped cotton throw with visible folds and tassels along its lower edge.'),
  textile('throw_folded', 'Folded Cotton Throw', 'Throws', 'throw', 'folded', [.6, .07, .45], '#9c7160', '#d8c5ab', surface(.45), 'Three softly rounded folded layers with stitched edges.'),
  textile('throw_knit', 'Chunky Knit Throw', 'Throws', 'throw', 'knitted', [.8, .6, 1.2], '#d2c9b8', '#b5a88d', surface(.05), 'Draped blanket with raised knitted ribs and a fringed lower edge.', 'knit'),
  textile('bedding_single', 'Single Duvet', 'Bedding', 'bedding', 'duvet', [1.4, .14, 2], '#e5dfd2', '#b7aa94', surface(.47), 'Padded single-bed duvet with a soft top surface and turned-down cuff.'),
  textile('bedding_double', 'Double Duvet', 'Bedding', 'bedding', 'duvet', [2, .14, 2.2], '#8e9f9b', '#dcd8c9', surface(.47), 'Padded double-bed duvet with a turned-down contrasting cuff.'),
  textile('bedding_king', 'King-Size Duvet', 'Bedding', 'bedding', 'duvet', [2.4, .14, 2.2], '#c4ae92', '#e6dece', surface(.47), 'Wide king-size duvet with rounded edges and a contrasting cuff.'),
  textile('bedding_quilt', 'Quilted Bedspread', 'Bedding', 'bedding', 'quilt', [2.2, .06, 2.4], '#8b9583', '#b9c0ae', surface(.47), 'Soft bedspread with a visible stitched grid and bound edges.'),
  textile('bedding_pillows', 'Pair of Bed Pillows', 'Bedding', 'bedding', 'pillows', [1.4, .16, .5], '#efeadf', '#d4cbb9', surface(.49), 'Two plump bed pillows with independently editable pillowcases and piping.'),
  textile('bedding_set', 'Double Bedding Set', 'Bedding', 'bedding', 'bed_set', [1.8, .24, 2.05], '#d2c6b3', '#6d817a', surface(.47), 'Duvet, folded cuff, two pillows and a contrasting bed runner. Place on an existing mattress.'),
  textile('blind_roller', 'Fabric Roller Blind', 'Blinds', 'blind', 'roller', [1.2, 1.6, .075], '#ded8cb', '#e7e6e0', { mount: 'wall', defaultElevation: .9, wallOffset: .045 }, 'Fabric roller blind with a top roller, headrail and bottom bar. Raise or lower it in the inspector.'),
  textile('blind_roman', 'Roman Fabric Blind', 'Blinds', 'blind', 'roman', [1.2, 1.6, .10], '#c7bba5', '#ede5d8', { mount: 'wall', defaultElevation: .9, wallOffset: .06 }, 'Soft fabric blind with horizontal folds that gather below the headrail when raised.', 'linen'),
  textile('blind_venetian', 'Venetian Blind', 'Blinds', 'blind', 'venetian', [1.2, 1.6, .06], '#e1ddd3', '#bab5a9', { mount: 'wall', defaultElevation: .9, wallOffset: .04 }, 'Horizontal slats, ladder tapes, headrail and bottom rail. Raise or lower the slat stack.'),
  textile('curtain_voile', 'Voile Sheer Curtain Pair', 'Sheer curtains', 'curtain', 'sheer', [1.8, 2.6, .12], '#f4f1e8', '#eeeae1', ceiling, 'Translucent pleated voile panels on a ceiling track, with an open/close control.'),
  textile('curtain_linen', 'Linen-Look Sheer Curtain Pair', 'Sheer curtains', 'curtain', 'sheer', [1.8, 2.6, .12], '#d8ccb5', '#eeeae1', ceiling, 'Natural-tone sheer panels with soft vertical folds and visible transparency.', 'linen'),
  textile('curtain_blackout', 'Blackout Curtain Pair — Oatmeal', 'Blackout curtains', 'curtain', 'blackout', [1.8, 2.6, .16], '#b6a78f', '#eee9df', { ...ceiling, wallOffset: .13 }, 'Opaque floor-length pleated panels with a ceiling track and open/close control.'),
  textile('curtain_velvet', 'Velvet Blackout Curtain Pair — Deep Navy', 'Blackout curtains', 'curtain', 'blackout', [1.8, 2.6, .16], '#344357', '#d8c9b1', { ...ceiling, wallOffset: .13 }, 'Heavy opaque velvet-look panels with deep folds and an open/close control.', 'velvet'),
  textile('curtain_layered', 'Layered Sheer and Blackout Curtains', 'Layered curtains', 'curtain', 'layered', [1.8, 2.6, .22], '#59685e', '#f1ecdf', { ...ceiling, wallOffset: .15 }, 'Separate translucent inner panels and opaque outer panels on twin tracks. The open/close control moves the outer pair.'),
  textile('towel_diamond', 'Folded Hand Towel — Navy Diamonds', 'Folded towels', 'towel', 'diamond', [.3, .04, .25], '#eee8dc', '#314d70', surface(.9), 'Folded hand towel with navy diamond outlines, soft terry layers and contrasting hems. Folded size: 30 × 25 × 4 cm.'),
  textile('towel_chevron', 'Folded Bath Towel — Terracotta Chevrons', 'Folded towels', 'towel', 'chevron', [.4, .07, .3], '#eee3d2', '#ad6048', surface(.9), 'Folded bath towel with bold terracotta zigzags, soft terry layers and contrasting hems. Folded size: 40 × 30 × 7 cm.'),
  textile('towel_checker', 'Folded Hand Towel — Sage Checks', 'Folded towels', 'towel', 'checker', [.3, .04, .25], '#f1ecdf', '#547966', surface(.9), 'Folded hand towel with sage checkerboard squares, soft terry layers and contrasting hems. Folded size: 30 × 25 × 4 cm.'),
  textile('towel_grid', 'Folded Washcloth — Mustard Grid', 'Folded towels', 'towel', 'grid', [.15, .02, .15], '#f4edde', '#a47b2f', surface(.9), 'Small folded washcloth with a mustard windowpane grid, soft terry layers and contrasting hems. Folded size: 15 × 15 × 2 cm.'),
];
