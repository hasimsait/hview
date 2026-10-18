import type { AssetDefinition, AssetPlacement } from './AssetDefinition';

export interface ArchitecturalFinishModel {
  kind: 'skirting' | 'architrave' | 'sill' | 'threshold' | 'cornice' | 'pelmet' | 'panelling' | 'moulding';
  style: 'flat' | 'chamfered' | 'ogee' | 'oak' | 'stepped' | 'fluted' | 'stone' | 'metal' | 'cove' | 'returned' | 'shaker' | 'slatted' | 'beadboard' | 'chair_rail' | 'picture_rail' | 'frame';
  material?: 'wood' | 'stone' | 'metal';
}

const wall = (height: number, depth: number): AssetPlacement => ({ mount: 'wall', defaultElevation: height, wallOffset: depth / 2 + .001 });
const ceiling = (height: number, depth: number): AssetPlacement => ({ mount: 'ceiling', ceilingOffset: height, wallOffset: depth / 2 + .001 });

function finish(key: string, name: string, collection: string, model: ArchitecturalFinishModel,
  size: [number, number, number], placement: AssetPlacement, description: string): AssetDefinition {
  const [x, y, z] = size;
  return { key: `finish_${key}`, name, category: 'architecture', recipe: 'architectural_finish', collection,
    architecturalFinish: model, defaultDimensions: { x, y, z }, placement,
    capabilities: { resizable: true },
    description,
    source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: 'Adjustable planning dimensions. Set the size and position to suit your room.' },
  };
}

/** Generic finish profiles, not manufacturer-specific products or installation drawings. Sizes are metres, W × H × D. */
export const ARCHITECTURAL_FINISHES: readonly AssetDefinition[] = [
  finish('skirting_flat', 'Square-Edge Skirting Board', 'Skirting boards', { kind: 'skirting', style: 'flat' }, [2.4, .08, .015], wall(0, .015), 'Simple paintable baseboard with a square top. One straight length; fit separate pieces between doorways.'),
  finish('skirting_chamfered', 'Chamfered Skirting Board', 'Skirting boards', { kind: 'skirting', style: 'chamfered' }, [2.4, .10, .018], wall(0, .018), 'Paintable baseboard with a bevelled upper edge.'),
  finish('skirting_ogee', 'Ogee Skirting Board', 'Skirting boards', { kind: 'skirting', style: 'ogee' }, [2.4, .15, .022], wall(0, .022), 'Traditional tall baseboard with a curved ogee and stepped upper edge.'),
  finish('skirting_oak', 'Oak Skirting Board', 'Skirting boards', { kind: 'skirting', style: 'oak', material: 'wood' }, [2.4, .08, .018], wall(0, .018), 'Natural oak baseboard with a gently rounded top edge.'),
  finish('architrave_flat', 'Square-Edge Door Architrave', 'Door architraves', { kind: 'architrave', style: 'flat' }, [.94, 2.17, .018], wall(0, .018), 'Open three-sided door surround with 7 cm face widths. Dimensions describe the outside of the surround; align it with an existing doorway.'),
  finish('architrave_stepped', 'Stepped Door Architrave', 'Door architraves', { kind: 'architrave', style: 'stepped' }, [.94, 2.17, .025], wall(0, .025), 'Open three-sided door casing with mitred corners and stepped relief. Outside dimensions include the 7 cm trim.'),
  finish('architrave_fluted', 'Fluted Door Architrave', 'Door architraves', { kind: 'architrave', style: 'fluted' }, [.94, 2.17, .025], wall(0, .025), 'Open door surround with three raised flutes on each 7 cm trim face and mitred corners.'),
  finish('sill_painted', 'Painted Window Sill', 'Window sills', { kind: 'sill', style: 'flat' }, [1.2, .03, .25], wall(.87, .25), 'Paintable window board with a projecting front nosing. Set its elevation to the underside of the window opening.'),
  finish('sill_stone', 'Stone Window Sill', 'Window sills', { kind: 'sill', style: 'stone', material: 'stone' }, [1.2, .03, .25], wall(.87, .25), 'Pale stone sill with a bevelled front edge and drip groove. Width includes any desired side overhang.'),
  finish('threshold_oak', 'Oak Door Threshold', 'Thresholds', { kind: 'threshold', style: 'oak', material: 'wood' }, [.9, .018, .12], { mount: 'floor' }, 'Low oak saddle with sloped edges for a doorway. Position across the opening.'),
  finish('threshold_metal', 'Metal Floor Transition Strip', 'Thresholds', { kind: 'threshold', style: 'metal', material: 'metal' }, [.9, .005, .04], { mount: 'floor' }, 'Thin aluminium transition strip with shallow ramps and fixing screws.'),
  finish('threshold_stone', 'Stone Door Threshold', 'Thresholds', { kind: 'threshold', style: 'stone', material: 'stone' }, [.9, .02, .15], { mount: 'floor' }, 'Bevelled pale stone saddle for bathroom and entrance transitions.'),
  finish('cornice_cove', 'Cove Ceiling Cornice', 'Ceiling cornices', { kind: 'cornice', style: 'cove' }, [2.4, .12, .12], ceiling(.12, .12), 'Curved ceiling coving with stepped edges, placed against the wall at ceiling height.'),
  finish('cornice_stepped', 'Stepped Ceiling Cornice', 'Ceiling cornices', { kind: 'cornice', style: 'stepped' }, [2.4, .10, .10], ceiling(.10, .10), 'Three-tier geometric ceiling moulding with a flat back and ceiling edge.'),
  finish('cornice_ogee', 'Ogee Ceiling Cornice', 'Ceiling cornices', { kind: 'cornice', style: 'ogee' }, [2.4, .15, .15], ceiling(.15, .15), 'Traditional S-curve crown moulding with projecting upper and lower beads.'),
  finish('pelmet_flat', 'Plain Curtain Pelmet', 'Curtain pelmets', { kind: 'pelmet', style: 'flat' }, [1.8, .15, .22], ceiling(.15, .22), 'Hollow ceiling-mounted curtain valance with a plain front and top. Place in front of the curtain rail.'),
  finish('pelmet_stepped', 'Stepped Curtain Pelmet', 'Curtain pelmets', { kind: 'pelmet', style: 'stepped' }, [1.8, .18, .22], ceiling(.18, .22), 'Hollow curtain valance with three stepped front bands and a top board; space behind the front conceals rails.'),
  finish('pelmet_returned', 'Box Curtain Pelmet with End Returns', 'Curtain pelmets', { kind: 'pelmet', style: 'returned' }, [1.8, .15, .22], ceiling(.15, .22), 'Hollow box pelmet with a front, top and side returns. Its back and underside remain open for ceiling-mounted curtains.'),
  finish('panelling_shaker', 'Shaker Wall Panelling', 'Wall panelling', { kind: 'panelling', style: 'shaker' }, [1.2, 1.0, .025], wall(0, .025), 'Paintable recessed wall panels with stiles, rails and a projecting top cap. Panel count follows the width.'),
  finish('panelling_slatted', 'Oak Slat Wall Panel', 'Wall panelling', { kind: 'panelling', style: 'slatted', material: 'wood' }, [.6, 2.4, .022], wall(0, .022), 'Vertical oak slats on a dark acoustic-style backing. Slat and backing finishes can be changed separately.'),
  finish('panelling_beadboard', 'Beadboard Wall Panelling', 'Wall panelling', { kind: 'panelling', style: 'beadboard' }, [1.2, 1.0, .018], wall(0, .018), 'Paintable tongue-and-groove style boards with narrow vertical beads and a top cap.'),
  finish('moulding_chair_rail', 'Chair Rail Moulding', 'Decorative mouldings', { kind: 'moulding', style: 'chair_rail' }, [2.4, .06, .025], wall(.9, .025), 'Profiled horizontal dado rail for dividing wall finishes at chair height.'),
  finish('moulding_picture_rail', 'Picture Rail Moulding', 'Decorative mouldings', { kind: 'moulding', style: 'picture_rail' }, [2.4, .04, .025], wall(2.1, .025), 'Projecting picture rail with a recessed upper lip.'),
  finish('moulding_frame', 'Decorative Wall Moulding Frame', 'Decorative mouldings', { kind: 'moulding', style: 'frame' }, [.7, 1.0, .018], wall(.3, .018), 'Open rectangular wall moulding with mitred corners and stepped relief. The centre remains open to show the wall finish.'),
];
