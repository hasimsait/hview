import { Angle } from '../model/Angle';
import { finite,immutable,positive } from '../model/Immutable';
import type { OpeningData,SurfaceFinishConfig } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { PlanElement,type PlanElementVisitor } from './PlanElement';

export abstract class Opening extends PlanElement {
  protected readonly state: Readonly<OpeningData>;
  protected constructor(data: OpeningData) {
    super(data.id);
    positive(data.width, 'Opening width'); positive(data.height, 'Opening height');
    finite(data.distanceAlongWall, 'Opening position');
    if (finite(data.floorHeight, 'Sill elevation') < 0) throw new Error('Sill elevation cannot be negative');
    if (!data.wallId) throw new Error('Opening must belong to a wall');
    this.state = immutable({ ...data, finish: SurfaceFinish.optional(data.finish) });
  }
  get displayName() { return this.type.replace('_', ' '); }
  get type() { return this.state.type; }
  get width() { return this.state.width; }
  get height() { return this.state.height; }
  get floorHeight() { return this.state.floorHeight; }
  get wallId() { return this.state.wallId; }
  get position() { return this.state.position; }
  get distanceAlongWall() { return this.state.distanceAlongWall; }
  get swingSide() { return this.state.swingSide; }
  get hingeSide() { return this.state.hingeSide; }
  get swingFlipped() { return this.state.swingFlipped; }
  get hingeFlipped() { return this.state.hingeFlipped; }
  get openAngle() { return this.state.openAngle; }
  get finish() { return this.state.finish; }
  get rawOpening() { return this.state.rawOpening; }
  protected abstract recreate(data: OpeningData): Opening;
  withHost(wallId: string, distanceAlongWall: number): Opening {
    return this.recreate({ ...this.state, wallId, distanceAlongWall });
  }
  withFinish(finish?: SurfaceFinishConfig): Opening { return this.recreate({ ...this.state, finish }); }
  toData(): OpeningData { return structuredClone(this.state); }
}

export class Door extends Opening {
  readonly kind = 'opening.door';
  readonly angle: Angle;
  constructor(data: OpeningData) {
    super(data);
    const degrees = data.openAngle ?? 40;
    if (finite(degrees, 'Door angle') < 0 || degrees > 180) throw new Error('Door angle must be between 0 and 180 degrees');
    this.angle = Angle.degrees(degrees);
    Object.freeze(this);
  }
  withOpenAngle(degrees: number): Door { return new Door({ ...this.state, openAngle: degrees }); }
  flipped(part: 'swing' | 'hinge'): Door {
    return new Door({
      ...this.state, ...(part === 'swing'
        ? { swingSide: this.swingSide === 'l' ? 'r' : 'l', swingFlipped: !this.swingFlipped }
        : { hingeSide: this.hingeSide === 'l' ? 'r' : 'l', hingeFlipped: !this.hingeFlipped })
    });
  }
  protected recreate(data: OpeningData) { return new Door(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitDoor(this); }
}

export class SlidingDoor extends Opening {
  readonly kind = 'opening.sliding';
  constructor(data: OpeningData) { super(data); Object.freeze(this); }
  get travel() { return this.width; }
  withOpenAngle(degrees: number): SlidingDoor {
    if (finite(degrees, 'Sliding door opening') < 0 || degrees > 180) throw new Error('Sliding door opening must be between 0 and 180');
    return new SlidingDoor({ ...this.state, openAngle: degrees });
  }
  protected recreate(data: OpeningData) { return new SlidingDoor(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitSlidingDoor(this); }
}

export class WindowOpening extends Opening {
  readonly kind = 'opening.window';
  constructor(data: OpeningData) { super(data); Object.freeze(this); }
  get isFrenchWindow() { return this.type === 'french_window'; }
  get topElevation() { return this.floorHeight + this.height; }
  protected recreate(data: OpeningData) { return new WindowOpening(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitWindow(this); }
}
