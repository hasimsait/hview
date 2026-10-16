import { AssetCatalog } from '../catalog/AssetCatalog';
import { Column } from '../elements/Column';
import { BasinCabinet,Luminaire,Shelving,StandardFurniture,type Furniture } from '../elements/Furniture';
import { Door,SlidingDoor,WindowOpening,type Opening } from '../elements/Opening';
import { Room } from '../elements/Room';
import { Wall } from '../elements/Wall';
import { WallRecess } from '../elements/WallRecess';
import type { ColumnData,FurnitureData,OpeningData,RoomData,WallData } from '../model/PlanData';

export class PlanElementFactory {
  constructor(readonly catalog = new AssetCatalog()) { }
  furniture(data: FurnitureData): Furniture {
    const key = this.catalog.canonicalKey(data.assetKey);
    const behavior = this.catalog.behavior(key);
    const definition = this.catalog.get(key);
    // Old exports gave this unrecognised robot a 60 cm cabinet height. Correct
    // only that exact legacy placeholder; keep explicitly resized modern models.
    const legacyRobot = key === 'robot_vacuum' && data.assetKey !== key
      && Math.abs(data.dimensions.x - .35) < 1e-6 && Math.abs(data.dimensions.z - .46) < 1e-6 && Math.abs(data.dimensions.y - .6) < 1e-6;
    // Fixed-size fittings must not inherit an old outlet's rectangular face or
    // concealed-box depth when added, replaced, or loaded from a saved plan.
    const dimensions = definition?.capabilities?.resizable === false ? definition.defaultDimensions
      : legacyRobot ? { ...data.dimensions, y: .15 } : data.dimensions;
    // Keep the back of a wall-mounted fitting against the same wall face when
    // replacing an oversized housing with its thin visible projection.
    const depthShift = definition?.capabilities?.resizable === false && definition.placement?.mount === 'wall'
      ? (dimensions.z - data.dimensions.z) / 2 : 0;
    const position = depthShift ? {
      ...data.position,
      x: data.position.x + Math.sin(data.rotationY) * depthShift,
      z: data.position.z + Math.cos(data.rotationY) * depthShift,
    } : data.position;
    const appliance = key === 'robot_vacuum' || key === 'air_purifier';
    const input = { ...data, dimensions, position, category: appliance ? 'appliance' as const : data.category, displayName: this.catalog.get(key)?.source ? this.catalog.get(key)!.name : data.displayName, assetKey: key, lightConfig: behavior === 'luminaire' ? data.lightConfig : undefined, hasLids: behavior === 'shelving' ? data.hasLids : undefined, shelfCount: behavior === 'shelving' ? data.shelfCount : undefined, recessHostId: behavior === 'recess' ? data.recessHostId : undefined };
    const constructors = { standard: StandardFurniture, luminaire: Luminaire, shelving: Shelving, basin: BasinCabinet, recess: WallRecess };
    return new constructors[behavior](input);
  }
  opening(data: OpeningData): Opening {
    const constructors = { door: Door, door_coupe: SlidingDoor, window: WindowOpening, french_window: WindowOpening };
    const Constructor = constructors[data.type];
    if (!Constructor) throw new Error(`Unsupported opening type: ${data.type}`);
    return new Constructor(data);
  }
  wall(data: WallData): Wall { return new Wall(data, data.openings.map(opening => this.opening(opening))); }
  room(data: RoomData): Room { return new Room(data); }
  column(data: ColumnData): Column { return new Column(data); }
}
