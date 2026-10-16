import { finite,immutable,positive } from '../model/Immutable';
import type { RoomData,SurfaceFinishConfig } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { PlanElement,type PlanElementVisitor } from './PlanElement';

export class Room extends PlanElement {
  readonly kind = 'room';
  private readonly state: Readonly<RoomData>;
  constructor(data: RoomData) {
    super(data.id); positive(data.height, 'Room height'); finite(data.area, 'Room area');
    if (data.ceilingHeight !== undefined && positive(data.ceilingHeight, 'Ceiling height') > data.height) throw new Error('Ceiling height cannot exceed room height');
    if (data.polygon.length < 3) throw new Error('Room boundary needs at least three points');
    for (const point of data.polygon) { finite(point.x, 'Room X'); finite(point.y, 'Room Y'); }
    this.state = immutable(data); Object.freeze(this);
  }
  get displayName() { return this.state.name; }
  get name() { return this.state.name; }
  get area() { return this.state.area; }
  get polygon(): readonly Readonly<RoomData['polygon'][number]>[] { return this.state.polygon; }
  get height() { return this.state.height; }
  get floorType() { return this.state.floorType; }
  get floorFinish() { return this.state.floorFinish; }
  get ceilingType() { return this.state.ceilingType; }
  get ceilingHeight() { return this.state.ceilingHeight; }
  get wallFinish() { return this.state.wallFinish; }
  get rawRoom() { return this.state.rawRoom; }
  renamed(name: string): Room {
    if (!name.trim()) throw new Error('Room name cannot be empty');
    return name === this.name ? this : new Room({ ...this.state, name });
  }
  withFloorFinish(floorFinish?: SurfaceFinishConfig): Room {
    return new Room({ ...this.state, floorFinish: SurfaceFinish.optional(floorFinish) });
  }
  withWallFinish(wallFinish: SurfaceFinishConfig): Room { return new Room({ ...this.state, wallFinish: SurfaceFinish.optional(wallFinish) }); }
  withCeiling(ceilingType: RoomData['ceilingType']): Room { return new Room({ ...this.state, ceilingType }); }
  withCeilingHeight(ceilingHeight?: number): Room { return new Room({ ...this.state, ceilingHeight }); }
  toData(): RoomData { return structuredClone(this.state); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitRoom(this); }
}
