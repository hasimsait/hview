import type { AssetDefinition, AssetPlacement } from './AssetDefinition';

export interface LightingComponentModel {
  kind: 'downlight' | 'surface_spot' | 'track' | 'pendant' | 'wall_light' | 'cabinet_light' | 'cove_light';
  style: 'round' | 'square' | 'double' | 'straight' | 'l_shape' | 'dome' | 'globe' | 'linear' | 'up_down' | 'opal' | 'bar' | 'strip' | 'vertical';
  color: string;
}
const ceiling = (height: number): AssetPlacement => ({ mount: 'ceiling', ceilingOffset: height });
const wall = (depth: number): AssetPlacement => ({ mount: 'wall', defaultElevation: 1.8, wallOffset: depth / 2 + .001 });
function fixture(key: string, name: string, collection: string, model: LightingComponentModel, size: [number, number, number], placement: AssetPlacement, description: string): AssetDefinition {
  const [x, y, z] = size;
  return { key: `lighting_${key}`, name, category: 'decor', collection, recipe: 'lighting_component', lightingComponent: model,
    defaultDimensions: { x, y, z }, placement,
    capabilities: { resizable: true, lighting: { type: model.kind === 'pendant' ? 'chandelier' : 'spot', defaultColor: '#fff2dc' } },
    description,
    source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: 'Adjustable planning dimensions. Includes a working light with on/off, brightness and colour controls.' },
  };
}
export const LIGHTING_COMPONENTS: readonly AssetDefinition[] = [
  fixture('cabinet_vertical', 'Cabinet Interior Vertical LED Profile', 'Under-cabinet lighting', { kind: 'cabinet_light', style: 'vertical', color: '#b7bec1' }, [.018, 1.2, .015], { mount: 'surface', defaultElevation: .15 }, 'Vertical aluminum channel with a continuous diffuser for wardrobe and cabinet side panels.'),
  fixture('downlight_round', 'Round Recessed LED Downlight', 'Recessed downlights', { kind: 'downlight', style: 'round', color: '#f3f1eb' }, [.10, .025, .10], ceiling(.025), 'Thin circular trim and recessed diffuser with a downward light beam.'),
  fixture('downlight_square', 'Square Recessed LED Downlight', 'Recessed downlights', { kind: 'downlight', style: 'square', color: '#f3f1eb' }, [.10, .025, .10], ceiling(.025), 'Square ceiling trim with a recessed lens and a soft-edged downward beam.'),
  fixture('spot_single', 'Surface-Mounted Cylinder Spotlight', 'Spotlights', { kind: 'surface_spot', style: 'round', color: '#25272b' }, [.08, .14, .08], ceiling(.14), 'Cylindrical ceiling housing, anti-glare baffle and a working downward spotlight.'),
  fixture('spot_double', 'Twin Surface-Mounted Spotlights', 'Spotlights', { kind: 'surface_spot', style: 'double', color: '#25272b' }, [.24, .15, .09], ceiling(.15), 'Two cylindrical spot heads on a shared ceiling plate, each casting a downward beam.'),
  fixture('track_straight', 'Three-Head Ceiling Track Lighting', 'Track lighting', { kind: 'track', style: 'straight', color: '#25272b' }, [1.2, .25, .12], ceiling(.25), 'Straight ceiling track with three suspended spot heads and three light beams.'),
  fixture('track_corner', 'L-Shaped Five-Head Track Lighting', 'Track lighting', { kind: 'track', style: 'l_shape', color: '#25272b' }, [1.2, .25, .6], ceiling(.25), 'Corner track with five spot heads distributed along both arms.'),
  fixture('pendant_dome', 'Dome Pendant Light', 'Pendant lighting', { kind: 'pendant', style: 'dome', color: '#3c433f' }, [.40, .8, .40], ceiling(.8), 'Open-bottom metal shade with a suspension cable, ceiling canopy and warm downward light.'),
  fixture('pendant_globe', 'Opal Globe Pendant Light', 'Pendant lighting', { kind: 'pendant', style: 'globe', color: '#c0a36d' }, [.30, .75, .30], ceiling(.75), 'Opal glass globe with a cord and canopy. Its room light illuminates surrounding surfaces.'),
  fixture('pendant_linear', 'Linear Dining Pendant Light', 'Pendant lighting', { kind: 'pendant', style: 'linear', color: '#25272b' }, [1.2, .7, .08], ceiling(.7), 'Suspended linear fixture with a continuous visible diffuser and three distributed downward light sources.'),
  fixture('wall_up_down', 'Up-and-Down Wall Light', 'Wall lighting', { kind: 'wall_light', style: 'up_down', color: '#25272b' }, [.10, .20, .12], wall(.12), 'Wall-mounted cylindrical fitting with separate upward and downward beams.'),
  fixture('wall_opal', 'Opal Wall Sconce', 'Wall lighting', { kind: 'wall_light', style: 'opal', color: '#c0a36d' }, [.18, .25, .16], wall(.16), 'Frosted opal shade and wall plate with warm room illumination.'),
  fixture('cabinet_bar', 'Under-Cabinet LED Light Bar', 'Under-cabinet lighting', { kind: 'cabinet_light', style: 'bar', color: '#d3d5d8' }, [.60, .02, .045], { mount: 'surface', defaultElevation: 1.4 }, 'Slim light bar with a frosted underside and three downward light sources. Position underneath a wall cabinet.'),
  fixture('cabinet_strip', 'Under-Cabinet LED Strip', 'Under-cabinet lighting', { kind: 'cabinet_light', style: 'strip', color: '#f3f1eb' }, [1.0, .008, .012], { mount: 'surface', defaultElevation: 1.4 }, 'Thin strip with visible LED segments and distributed task lighting. Resize its length to match the cabinet run.'),
  fixture('cove_channel', 'Concealed Ceiling Cove Lighting', 'Concealed ceiling lighting', { kind: 'cove_light', style: 'linear', color: '#f3f1eb' }, [1.2, .08, .12], { ...ceiling(.12), wallOffset: .061 }, 'Paintable open cove channel with a concealed LED strip and continuous upward area lighting. A 4 cm gap above the channel lights the ceiling.'),
];
