import { Angle } from '../model/Angle';
import { finite,immutable,positive } from '../model/Immutable';
import type { CurtainState,OpeningData,SurfaceFinishConfig } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { PlanElement,type PlanElementVisitor } from './PlanElement';
import { validateWindowDressing, type WindowDressingConfig } from '../model/WindowDressing';

function requestedDoorAngle(degrees: number): number {
  return Math.max(0, Math.min(180, Math.round(finite(degrees, 'Door angle'))));
}

export abstract class Opening extends PlanElement {
  protected readonly state: Readonly<OpeningData>;
  protected constructor(data: OpeningData) {
    super(data.id);
    positive(data.width, 'Opening width'); positive(data.height, 'Opening height');
    finite(data.distanceAlongWall, 'Opening position');
    if (finite(data.floorHeight, 'Sill elevation') < 0) throw new Error('Sill elevation cannot be negative');
    if (!data.wallId) throw new Error('Opening must belong to a wall');
    if (data.frameColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(data.frameColor)) throw new Error('Frame color must be a six-digit hex color');
    if (data.curtainState !== undefined && !['visible', 'hidden', 'removed'].includes(data.curtainState)) throw new Error('Invalid curtain state');
    if (data.pelmetState !== undefined && !['visible', 'hidden', 'removed'].includes(data.pelmetState)) throw new Error('Invalid cornice state');
    if (data.windowDressing) validateWindowDressing(data.windowDressing);
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
  get frameColor() { return this.state.frameColor; }
  get rawOpening() { return this.state.rawOpening; }
  protected abstract recreate(data: OpeningData): Opening;
  withHost(wallId: string, distanceAlongWall: number): Opening {
    return this.recreate({ ...this.state, wallId, distanceAlongWall });
  }
  withFinish(finish?: SurfaceFinishConfig): Opening { return this.recreate({ ...this.state, finish }); }
  withFrameColor(frameColor?: string): Opening { return this.recreate({ ...this.state, frameColor }); }
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
  withOpenAngle(degrees: number): Door {
    const openAngle = requestedDoorAngle(degrees);
    return openAngle === this.openAngle ? this : new Door({ ...this.state, openAngle });
  }
  rotatedBy(delta: number): Door {
    finite(delta, 'Door rotation');
    return delta === 180 ? this.flipped('swing') : this.withOpenAngle(this.angle.degrees + delta);
  }
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
    const openAngle = requestedDoorAngle(degrees);
    return openAngle === this.openAngle ? this : new SlidingDoor({ ...this.state, openAngle });
  }
  protected recreate(data: OpeningData) { return new SlidingDoor(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitSlidingDoor(this); }
}

export class WindowOpening extends Opening {
  readonly kind = 'opening.window';
  constructor(data: OpeningData) { super(data); Object.freeze(this); }
  get isFrenchWindow() { return this.type === 'french_window'; }
  get topElevation() { return this.floorHeight + this.height; }
  get curtainState(): CurtainState { return this.state.curtainState ?? 'visible'; }
  get pelmetState(): CurtainState { return this.state.pelmetState ?? 'visible'; }
  get windowDressing() { return this.state.windowDressing; }
  withWindowDressing(windowDressing?: WindowDressingConfig): WindowOpening { return new WindowOpening({ ...this.state, windowDressing }); }
  withPelmetState(pelmetState: CurtainState): WindowOpening { return new WindowOpening({ ...this.state, pelmetState }); }
  withCurtainState(curtainState: CurtainState): WindowOpening { return new WindowOpening({ ...this.state, curtainState }); }
  protected recreate(data: OpeningData) { return new WindowOpening(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitWindow(this); }
}
