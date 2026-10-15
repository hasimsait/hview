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
    const input = { ...data, displayName: this.catalog.get(key)?.source ? this.catalog.get(key)!.name : data.displayName, assetKey: key, lightConfig: behavior === 'luminaire' ? data.lightConfig : undefined, hasLids: behavior === 'shelving' ? data.hasLids : undefined, shelfCount: behavior === 'shelving' ? data.shelfCount : undefined, recessHostId: behavior === 'recess' ? data.recessHostId : undefined };
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
