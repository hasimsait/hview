import { immutable,positive } from '../model/Immutable';
import type { ColumnData,ColumnSide,SurfaceFinishConfig,WallData } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { Transform } from '../model/Transform';
import { PlanElement,type PlanElementVisitor } from './PlanElement';

export class Column extends PlanElement {
  readonly kind = 'column';
  private readonly state: Readonly<ColumnData>;
  constructor(data: ColumnData) {
    super(data.id);
    positive(data.width, 'Column width'); positive(data.depth, 'Column depth');
    new Transform(data.worldPos, data.rotationY);
    if (data.height !== undefined) positive(data.height, 'Column height');
    this.state = immutable(data);
    Object.freeze(this);
  }
  get displayName() { return this.state.name; }
  get name() { return this.state.name; }
  get type() { return this.state.type; }
  get width() { return this.state.width; }
  get depth() { return this.state.depth; }
  get height() { return this.state.height; }
  get area() { return this.state.area; }
  get worldPos() { return this.state.worldPos; }
  get rotationY() { return this.state.rotationY; }
  get stubIds() { return this.state.stubIds; }
  get roomId() { return this.state.roomId; }
  get roomIds() { return this.state.roomIds; }
  get roomName() { return this.state.roomName; }
  get finish() { return this.state.finish; }
  get finishFront() { return this.state.finishFront; }
  get finishBack() { return this.state.finishBack; }
  get finishLeft() { return this.state.finishLeft; }
  get finishRight() { return this.state.finishRight; }
  withFinish(side: ColumnSide, config: SurfaceFinishConfig): Column {
    const finish = new SurfaceFinish(config).config;
    return new Column(side === 'all' ? { ...this.state, finish, finishFront: finish, finishBack: finish, finishLeft: finish, finishRight: finish }
      : { ...this.state, [({ front: 'finishFront', back: 'finishBack', left: 'finishLeft', right: 'finishRight' } as const)[side]]: finish });
  }
  withSources(stubIds: string[]): Column { return new Column({ ...this.state, stubIds }); }
  splitAt(distance: number): readonly [Column, Column] {
    if (!Number.isFinite(distance) || distance <= 0.05 || distance >= this.width - 0.05) throw new Error('Split must leave two usable column segments');
    const direction = { x: Math.cos(this.rotationY), z: -Math.sin(this.rotationY) };
    const part = (suffix: string, width: number, offset: number) => new Column({
      ...this.state, id: `${this.id}_${suffix}`, width,
      worldPos: { ...this.worldPos, x: this.worldPos.x + direction.x * offset, z: this.worldPos.z + direction.z * offset }
    });
    return [part('a', distance, (distance - this.width) / 2), part('b', this.width - distance, distance / 2)];
  }
  /** Geometry input for the rectangular extrusion algorithm, never editable wall state. */
  wallShape(totalHeight: number): WallData {
    const dx = Math.cos(this.rotationY) * this.width / 2, dy = -Math.sin(this.rotationY) * this.width / 2;
    return {
      id: this.id, isColumn: true,
      p1: { x: this.worldPos.x - dx, y: this.worldPos.z - dy }, p2: { x: this.worldPos.x + dx, y: this.worldPos.z + dy },
      thickness: this.depth, height: this.height ?? totalHeight, material: 'reinforced_concrete', openings: [],
      roomIds: this.roomIds, finish: this.finish, finishSideA: this.finishFront, finishSideB: this.finishBack,
      finishEdgeStart: this.finishLeft, finishEdgeEnd: this.finishRight
    };
  }
  toData(): ColumnData { return structuredClone(this.state); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitColumn(this); }
}
