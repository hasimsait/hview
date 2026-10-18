import type { AssetDefinition, AssetPlacement } from './AssetDefinition';

export interface HouseholdDetailModel {
  kind: 'mirror' | 'plate' | 'bowl' | 'mug' | 'glass' | 'kettle' | 'toaster' | 'coffee' | 'microwave' | 'blender' | 'air_fryer'
    | 'laundry' | 'bin' | 'hanger' | 'monitor' | 'laptop' | 'keyboard' | 'mouse' | 'printer' | 'tray' | 'books'
    | 'cable' | 'extension' | 'pipe' | 'trap' | 'hose' | 'panel' | 'stop';
  style?: string;
  color: string;
  count?: number;
  practical?: boolean;
}
const surface = (height: number): AssetPlacement => ({ mount: 'surface', defaultElevation: height });
const floor: AssetPlacement = { mount: 'floor' };
const wall = (height: number, offset: number): AssetPlacement => ({ mount: 'wall', defaultElevation: height, wallOffset: offset });
function detail(key: string, name: string, collection: string, kind: HouseholdDetailModel['kind'], size: [number, number, number], placement: AssetPlacement, description: string, style?: string, color = '#eeeae2', count = 1, practical = false): AssetDefinition {
  const [x, y, z] = size;
  return { key: `detail_${key}`, name, collection, category: ['kettle', 'toaster', 'coffee', 'microwave', 'blender', 'air_fryer', 'monitor', 'laptop', 'printer'].includes(kind) ? 'appliance' : 'decor',
    recipe: 'household_detail', householdDetail: { kind, style, color, count, practical }, defaultDimensions: { x, y, z }, placement, capabilities: { resizable: true }, description,
    source: { retailer: 'Generic', dimensions: 'reference', dimensionNotes: practical
      ? 'Adjustable planning envelope, including visible connectors. Width, height and depth describe the occupied space, not the cable or hose length. Place and rotate manually to check clearances; connections and collisions are not automatic.'
      : 'Adjustable reference dimensions for a generic planning model. Component colours and finishes can be changed independently.' } };
}
export const HOUSEHOLD_DETAILS: readonly AssetDefinition[] = [
  detail('mirror_arch', 'Arched Wall Mirror', 'Mirrors', 'mirror', [.7, 1.1, .025], wall(1, .03), 'Thin framed mirror with an arched top.', 'arch', '#36393a'),
  detail('mirror_floor', 'Full-Length Leaning Mirror', 'Mirrors', 'mirror', [.65, 1.7, .18], floor, 'Full-length framed mirror tilted back on a deep floor support.', 'leaning', '#bb9666'),
  detail('mirror_desk', 'Freestanding Vanity Mirror', 'Mirrors', 'mirror', [.22, .36, .16], surface(.8), 'Circular tabletop mirror on a stem and weighted base.', 'vanity', '#b8b9b7'),
  detail('plate', 'Dinner Plate', 'Crockery', 'plate', [.27, .025, .27], surface(.76), 'Ceramic dinner plate with a shallow well and raised rim.'),
  detail('plate_stack', 'Stack of Dinner Plates', 'Crockery', 'plate', [.27, .075, .27], surface(.9), 'Six stacked ceramic plates.', 'stack', '#eeeae2', 6),
  detail('bowl', 'Cereal Bowl', 'Crockery', 'bowl', [.16, .075, .16], surface(.76), 'Open ceramic bowl with a thick rim.'),
  detail('serving_bowl', 'Large Serving Bowl', 'Crockery', 'bowl', [.30, .12, .30], surface(.9), 'Wide open serving bowl.', 'serving', '#8d9d95'),
  detail('mug', 'Ceramic Mug', 'Crockery', 'mug', [.125, .10, .09], surface(.76), 'Open mug with a curved side handle.', undefined, '#a47153'),
  detail('glass', 'Drinking Glass', 'Crockery', 'glass', [.075, .13, .075], surface(.76), 'Transparent open drinking tumbler.'),
  detail('kettle', 'Electric Kettle', 'Countertop appliances', 'kettle', [.23, .25, .17], surface(.9), 'Kettle with pouring spout, lid, handle and circular power base.', undefined, '#e8e5db'),
  detail('toaster', 'Two-Slice Toaster', 'Countertop appliances', 'toaster', [.28, .20, .18], surface(.9), 'Two open toast slots, lever, control knob and crumb-tray seam.', undefined, '#c3c7c9'),
  detail('coffee', 'Espresso Coffee Machine', 'Countertop appliances', 'coffee', [.24, .34, .35], surface(.9), 'Coffee machine with reservoir, group head, portafilter, drip tray and cup.', undefined, '#3e4245'),
  detail('microwave', 'Countertop Microwave Oven', 'Countertop appliances', 'microwave', [.46, .28, .36], surface(.9), 'Microwave with dark glazed door, side controls and vents.', undefined, '#e0e1df'),
  detail('blender', 'Countertop Blender', 'Countertop appliances', 'blender', [.19, .42, .19], surface(.9), 'Blender motor base with transparent jug, lid and handle.', undefined, '#33383a'),
  detail('air_fryer', 'Basket Air Fryer', 'Countertop appliances', 'air_fryer', [.30, .34, .36], surface(.9), 'Compact air fryer with front drawer, handle, controls and rear vent.', undefined, '#35393b'),
  detail('laundry_open', 'Open Laundry Basket', 'Laundry baskets', 'laundry', [.55, .32, .38], floor, 'Open ventilated laundry basket with two carrying handles.', 'open'),
  detail('laundry_lidded', 'Lidded Laundry Hamper', 'Laundry baskets', 'laundry', [.40, .62, .35], floor, 'Tall ventilated hamper with a removable lid.', 'lidded', '#bda47e'),
  detail('laundry_sorter', 'Two-Compartment Laundry Sorter', 'Laundry baskets', 'laundry', [.70, .60, .38], floor, 'Two separate open fabric bins on a metal support frame.', 'sorter', '#9caaa5'),
  detail('bin_pedal', 'Kitchen Pedal Bin', 'Bins', 'bin', [.30, .64, .36], floor, 'Tall kitchen waste bin with hinged lid and foot pedal.', 'pedal', '#bbc0c3'),
  detail('bin_recycling', 'Three-Compartment Recycling Bin', 'Bins', 'bin', [.65, .52, .32], floor, 'Three waste sorting compartments with individually coloured lids.', 'recycling', '#e6e6df', 3),
  detail('bin_desk', 'Open Wastepaper Basket', 'Bins', 'bin', [.26, .32, .26], floor, 'Open tapered desk bin with a visible interior.', 'open', '#4d585a'),
  detail('hanger_wood', 'Wooden Coat Hanger', 'Coat hangers', 'hanger', [.44, .24, .025], surface(1.4), 'Triangular wooden hanger with a metal hook and trouser bar.', 'wood', '#c7a372'),
  detail('hanger_wire', 'Wire Coat Hanger', 'Coat hangers', 'hanger', [.42, .23, .008], surface(1.4), 'Thin metal hanger with a hooked top and open centre.', 'wire', '#6a6e70'),
  detail('hanger_rack', 'Freestanding Clothes Rail with Hangers', 'Coat hangers', 'hanger', [.95, 1.65, .45], floor, 'Clothes rail with four individual wooden coat hangers.', 'rack', '#30363a', 4),
  detail('monitor', 'Desktop Monitor', 'Desk equipment', 'monitor', [.61, .45, .20], surface(.74), 'Flat 27-inch-style monitor with thin bezel and stand.', undefined, '#303438'),
  detail('laptop', 'Open Laptop Computer', 'Desk equipment', 'laptop', [.33, .24, .28], surface(.74), 'Laptop with an upright display, keyboard and trackpad.', undefined, '#b3b8bd'),
  detail('keyboard', 'Computer Keyboard', 'Desk equipment', 'keyboard', [.44, .025, .14], surface(.74), 'Desktop keyboard with separated keys and space bar.', undefined, '#d4d8d7'),
  detail('mouse', 'Computer Mouse', 'Desk equipment', 'mouse', [.065, .038, .11], surface(.74), 'Rounded desktop mouse with scroll wheel.', undefined, '#3d4448'),
  detail('printer', 'Desktop Printer', 'Desk equipment', 'printer', [.40, .24, .33], surface(.74), 'Compact printer with paper feeder and projecting output tray.', undefined, '#d3d7d8'),
  detail('tray', 'Stackable Letter Trays', 'Desk equipment', 'tray', [.26, .14, .34], surface(.74), 'Two open-front document trays with a few sheets of paper.', undefined, '#454f54'),
  detail('books', 'Desk Books and Notebooks', 'Desk equipment', 'books', [.25, .10, .18], surface(.74), 'Three stacked books with visible page blocks and separate covers.', undefined, '#677c79', 3),
  detail('cable_straight', 'Straight Power Cable with Plug', 'Cables and extension leads', 'cable', [1.2, .045, .08], floor, 'Straight floor cable with a moulded plug and two round pins.', 'straight', '#34383a', 1, true),
  detail('cable_bent', 'Right-Angle Cable Route', 'Cables and extension leads', 'cable', [.8, .045, .6], floor, 'Cable route turning through a rounded right-angle bend, with plug.', 'bent', '#34383a', 1, true),
  detail('cable_loop', 'Looped Power Cable', 'Cables and extension leads', 'cable', [.55, .045, .4], floor, 'Loose loop of power cable with a moulded plug.', 'loop', '#34383a', 1, true),
  detail('extension_4', 'Four-Socket Extension Lead', 'Cables and extension leads', 'extension', [1, .045, .3], floor, 'Four recessed European-style sockets, illuminated switch, trailing cable and plug.', 'four', '#e7e8e2', 4, true),
  detail('extension_6', 'Six-Socket Extension Lead', 'Cables and extension leads', 'extension', [1.2, .045, .3], floor, 'Six recessed European-style sockets, switch, trailing cable and plug.', 'six', '#41474a', 6, true),
  detail('pipe_straight', 'Straight Waste Pipe — 40 mm', 'Plumbing connections', 'pipe', [.40, .05, .05], floor, '40 mm waste pipe with a socket collar and open bore.', 'straight', '#e8e8df', 1, true),
  detail('pipe_elbow', 'Waste Pipe 90-Degree Elbow', 'Plumbing connections', 'pipe', [.16, .16, .05], surface(.3), 'Right-angle waste fitting with two open connection collars.', 'elbow', '#e8e8df', 1, true),
  detail('pipe_tee', 'Waste Pipe Tee Connector', 'Plumbing connections', 'pipe', [.20, .15, .05], surface(.3), 'Tee branch fitting with three open pipe connections.', 'tee', '#e8e8df', 1, true),
  detail('trap_p', 'Basin P-Trap', 'Plumbing connections', 'trap', [.30, .28, .06], surface(.25), 'Curved water trap with vertical basin inlet and horizontal waste outlet.', 'p', '#d6dadd', 1, true),
  detail('trap_bottle', 'Basin Bottle Trap', 'Plumbing connections', 'trap', [.25, .30, .085], surface(.25), 'Bottle trap with removable sump, vertical inlet and horizontal outlet.', 'bottle', '#d6dadd', 1, true),
  detail('hose_inlet', 'Washing-Machine Inlet Hose', 'Appliance hoses', 'hose', [.65, .12, .35], floor, 'Looped supply hose with threaded coupling nuts at both ends.', 'inlet', '#979fa6', 1, true),
  detail('hose_drain', 'Washing-Machine Drain Hose', 'Appliance hoses', 'hose', [.65, .35, .24], floor, 'Ribbed drain hose with a raised hooked outlet for appliance-clearance planning.', 'drain', '#a6adb0', 1, true),
  detail('panel_small', 'Flush Service Access Panel — 20 × 20 cm', 'Access panels', 'panel', [.20, .20, .02], wall(.4, .015), 'Thin framed inspection hatch with recessed opening catch.', 'flush', '#f0eee8', 1, true),
  detail('panel_large', 'Service Access Panel — 40 × 60 cm', 'Access panels', 'panel', [.40, .60, .025], wall(.6, .02), 'Larger inspection hatch with perimeter frame and visible latch.', 'flush', '#f0eee8', 1, true),
  detail('stop_floor', 'Floor-Mounted Door Stop', 'Door stops', 'stop', [.045, .075, .045], floor, 'Short floor stop with rubber buffer and metal fixing base.', 'floor', '#bfc3c5', 1, true),
  detail('stop_wall', 'Wall-Mounted Door Stop', 'Door stops', 'stop', [.045, .045, .09], wall(.12, .046), 'Projecting wall stop with rubber tip and circular fixing plate.', 'wall', '#bfc3c5', 1, true),
  detail('stop_wedge', 'Rubber Wedge Door Stop', 'Door stops', 'stop', [.04, .025, .10], floor, 'Sloping rubber wedge with ribbed grip surface.', 'wedge', '#4c5356', 1, true),
];
