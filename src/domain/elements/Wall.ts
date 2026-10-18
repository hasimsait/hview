import { finite,immutable,positive } from '../model/Immutable';
import type { SurfaceFinishConfig,WallData,WallFrameStyle,WallSide } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { WindowOpening, type Opening } from './Opening';
import { defaultWallCornice, validateWallCornice, type WallCorniceConfig } from '../model/WallCornice';
import { PlanElement,type PlanElementVisitor } from './PlanElement';

export class Wall extends PlanElement {
  readonly kind = 'wall';
  private readonly state: Readonly<Omit<WallData, 'openings'>>;
  readonly openings: readonly Opening[];

  constructor(data: WallData, openings: readonly Opening[]) {
    super(data.id);
    positive(data.thickness, 'Wall thickness'); positive(data.height, 'Wall height');
    for (const point of [data.p1, data.p2]) { finite(point.x, 'Wall X'); finite(point.y, 'Wall Y'); }
    const { openings: _transportOpenings, ...shape } = data;
    // Old plans attached a short cornice to each window. Consolidate them once on the host wall.
    const windows = openings.filter((o): o is WindowOpening => o instanceof WindowOpening);
    if (shape.cornice === undefined && windows.length) {
      const visible = windows.some(w => w.pelmetState === 'visible'), hidden = windows.some(w => w.pelmetState === 'hidden');
      shape.cornice = { ...defaultWallCornice(true), profile: visible || hidden ? 'cove' : 'none', ...(hidden && !visible ? { hidden: true } : {}) };
    }
    if (shape.cornice) validateWallCornice(shape.cornice);
    this.state = immutable(shape);
    const migrated = openings.some(o => o instanceof WindowOpening && o.toData().pelmetState !== undefined) ? openings.map(o => {
      if (!(o instanceof WindowOpening)) return o;
      const { pelmetState: _legacyCornice, ...clean } = o.toData(); return new WindowOpening(clean);
    }) : openings;
    this.openings = Object.isFrozen(migrated) ? migrated : Object.freeze([...migrated]);
    if (openings.some(opening => opening.wallId !== this.id)) throw new Error('Opening belongs to another wall');
    Object.freeze(this);
  }
  get displayName() { return `Wall ${this.id}`; }
  get p1(): Readonly<WallData['p1']> { return this.state.p1; }
  get p2(): Readonly<WallData['p2']> { return this.state.p2; }
  get thickness() { return this.state.thickness; }
  get height() { return this.state.height; }
  get material() { return this.state.material; }
  get color() { return this.state.color; }
  get finish() { return this.state.finish; }
  get finishSideA() { return this.state.finishSideA; }
  get finishSideB() { return this.state.finishSideB; }
  get finishEdges() { return this.state.finishEdges; }
  get finishEdgeStart() { return this.state.finishEdgeStart; }
  get finishEdgeEnd() { return this.state.finishEdgeEnd; }
  get finishEdgeTop() { return this.state.finishEdgeTop; }
  get finishBaseboard() { return this.state.finishBaseboard; }
  get finishSill() { return this.state.finishSill; }
  get cornice() { return this.state.cornice; }
  get roomIds(): readonly string[] | undefined { return this.state.roomIds; }
  get roomSideA() { return this.state.roomSideA; }
  get roomSideB() { return this.state.roomSideB; }
  get frameStyle() { return this.state.frameStyle; }
  get frameColor() { return this.state.frameColor; }
  get startOffset() { return this.state.startOffset; }
  get endOffset() { return this.state.endOffset; }
  get rawWall() { return this.state.rawWall; }
  get isColumn() { return false; }
  get length() { return Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y); }

  withFinish(side: WallSide, config: SurfaceFinishConfig): Wall {
    const finish = new SurfaceFinish(config).config;
    const next = { ...this.state };
    if (side === 'A' || side === 'B') {
      const own = side === 'A' ? 'finishSideA' : 'finishSideB';
      const opposite = side === 'A' ? 'finishSideB' : 'finishSideA';
      next[own] = finish;
      next[opposite] ??= next.finish;
      delete next.finish;
    } else if (side === 'both') {
      Object.assign(next, {
        finish, finishSideA: finish, finishSideB: finish, finishEdges: finish,
        finishEdgeStart: finish, finishEdgeEnd: finish, finishEdgeTop: finish, finishSill: finish
      });
    } else if (side === 'edges') {
      Object.assign(next, { finishEdges: finish, finishEdgeStart: finish, finishEdgeEnd: finish, finishEdgeTop: finish, finishSill: finish });
    } else if (side === 'cornice') {
      next.cornice = { ...(this.cornice ?? defaultWallCornice(this.openings.some(o => o instanceof WindowOpening))), profile: this.cornice?.profile === 'none' ? 'cove' : this.cornice?.profile ?? 'cove', finish };
    } else {
      const field = {
        edge_start: 'finishEdgeStart', edge_end: 'finishEdgeEnd', edge_top: 'finishEdgeTop', sill: 'finishSill',
        baseboard: 'finishBaseboard', edge_bottom: 'finishBaseboard'
      } as const;
      next[field[side]] = finish;
    }
    return new Wall({ ...next, openings: [] }, this.openings);
  }
  withCornice(cornice: WallCorniceConfig): Wall { return new Wall({ ...this.state, cornice, openings: [] }, this.openings); }
  withBaseboard(finish?: SurfaceFinishConfig): Wall { return new Wall({ ...this.state, finishBaseboard: SurfaceFinish.optional(finish), openings: [] }, this.openings); }

  withFrame(frameStyle: WallFrameStyle, frameColor: string): Wall {
    return new Wall({ ...this.state, frameStyle, frameColor, openings: [] }, this.openings);
  }
  withMaterial(material: string): Wall {
    if (!material.trim()) throw new Error('Wall material is required');
    return new Wall({ ...this.state, material, openings: [] }, this.openings);
  }
  withOpenings(openings: readonly Opening[]): Wall { return new Wall({ ...this.state, openings: [] }, openings); }
  withRoomRelationship(relationship: Pick<WallData, 'roomIds' | 'roomSideA' | 'roomSideB'>): Wall {
    return new Wall({ ...this.state, ...relationship, openings: [] }, this.openings);
  }
  withJunctionOffsets(startOffset: number, endOffset: number): Wall {
    return startOffset === (this.startOffset ?? 0) && endOffset === (this.endOffset ?? 0) ? this
      : new Wall({ ...this.state, startOffset, endOffset, openings: [] }, this.openings);
  }
  assertSplittable(distance: number): void {
    if (distance <= 0.05 || distance >= this.length - 0.05) throw new Error('Split must leave two usable wall segments');
    if (this.openings.some(opening => Math.abs(opening.distanceAlongWall - distance) < opening.width / 2 - 0.001)) {
      throw new Error('Cannot split through a hosted opening or recess');
    }
  }
  toData(): WallData { return { ...structuredClone(this.state), openings: this.openings.map(opening => opening.toData()) }; }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitWall(this); }
}
