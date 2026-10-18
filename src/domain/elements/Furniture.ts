import { validateCabinet, type CabinetLayout } from '../cabinet/CabinetLayout';
import { Dimensions } from '../model/Dimensions';
import { finite,immutable } from '../model/Immutable';
import type { FurnitureData,LightFixtureConfig,SurfaceFinishConfig,Vector3D } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { normalizeSectionFinishes,surfaceSection } from '../model/SurfaceSections';
import { Transform } from '../model/Transform';
import { validateOpenness } from '../model/WindowDressing';
import { PlanElement,type PlanElementVisitor } from './PlanElement';

export abstract class Furniture extends PlanElement {
  protected readonly state: Readonly<FurnitureData>;
  readonly size: Dimensions;
  readonly transform: Transform;

  protected constructor(data: FurnitureData) {
    super(data.id);
    if (data.cabinet) validateCabinet(data.cabinet);
    this.size = new Dimensions(data.dimensions);
    this.transform = new Transform(data.position, data.rotationY);
    if (!data.assetKey) throw new Error('Furniture needs an asset key');
    if (data.windowCoveringOpen !== undefined) validateOpenness(data.windowCoveringOpen);
    this.state = immutable({ ...data, sectionFinishes: normalizeSectionFinishes(data.sectionFinishes, data.assetKey), finish: SurfaceFinish.optional(data.finish) });
  }

  get name() { return this.state.name; }
  get displayName() { return this.state.displayName; }
  get category() { return this.state.category; }
  get assetKey() { return this.state.assetKey; }
  get dimensions(): Readonly<Vector3D> { return this.state.dimensions; }
  get position() { return this.transform.position; }
  get rotationY() { return this.transform.rotationY; }
  get roomId() { return this.state.roomId; }
  get customModelUrl() { return this.state.customModelUrl; }
  get visible() { return this.state.visible; }
  get finish(): Readonly<SurfaceFinishConfig> | undefined { return this.state.finish; }
  get sectionFinishes(): Readonly<Record<string, Readonly<SurfaceFinishConfig>>> | undefined { return this.state.sectionFinishes; }
  get hasLids() { return this.state.hasLids; }
  get lightConfig(): Readonly<LightFixtureConfig> | undefined { return this.state.lightConfig; }
  get windowCoveringOpen() { return this.state.windowCoveringOpen; }
  get cabinet() { return this.state.cabinet; }
  withCabinet(cabinet: CabinetLayout): Furniture { return this.recreate({ ...this.state, cabinet: validateCabinet(cabinet) }); }
  get rawItem() { return this.state.rawItem; }

  protected abstract recreate(data: FurnitureData): Furniture;

  withTransform(position: Vector3D, rotationY = this.rotationY): Furniture {
    const next = new Transform(position, rotationY);
    return next.equals(this.transform) ? this : this.recreate({ ...this.state, position, rotationY });
  }

  withDimensions(dimensions: Vector3D): Furniture {
    return this.size.equals(dimensions) ? this : this.recreate({ ...this.state, dimensions });
  }

  withFinish(finish?: SurfaceFinishConfig): Furniture {
    return this.recreate({ ...this.state, finish: SurfaceFinish.optional(finish), sectionFinishes: finish ? undefined : this.sectionFinishes });
  }

  withSectionFinish(section: string, finish?: SurfaceFinishConfig): Furniture {
    section = surfaceSection(section, this.assetKey);
    if (!section) throw new Error('Surface section is required');
    const sections = { ...this.sectionFinishes };
    if (finish) sections[section] = new SurfaceFinish(finish).config;
    else delete sections[section];
    return this.recreate({ ...this.state, sectionFinishes: sections });
  }

  withVisibility(visible: boolean): Furniture { return this.recreate({ ...this.state, visible }); }
  withWindowCoveringOpen(windowCoveringOpen: number): Furniture { return this.recreate({ ...this.state, windowCoveringOpen: validateOpenness(windowCoveringOpen) }); }

  /** Detached transport value for codecs; callers cannot edit this instance. */
  toData(): FurnitureData { return structuredClone(this.state); }
}

export class StandardFurniture extends Furniture {
  readonly kind = 'furniture.standard';
  constructor(data: FurnitureData) { super(data); Object.freeze(this); }
  protected recreate(data: FurnitureData) { return new StandardFurniture(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitFurniture(this); }
}

export class Luminaire extends Furniture {
  readonly kind = 'furniture.luminaire';
  constructor(data: FurnitureData) {
    super(data);
    const intensity = data.lightConfig?.intensity ?? 1;
    if (finite(intensity, 'Light intensity') < 0 || intensity > 3) throw new Error('Light intensity must be between 0 and 3');
    Object.freeze(this);
  }
  get intensity() { return this.lightConfig?.intensity ?? 1; }
  get emissionEnabled() { return this.lightConfig?.enabled ?? true; }
  get emissionColor() { return this.lightConfig?.color ?? '#fff5ea'; }
  withIntensity(intensity: number): Luminaire { return intensity === this.intensity ? this : this.withEmission({ intensity }); }
  withEmission(config: Partial<LightFixtureConfig>): Luminaire {
    return new Luminaire({ ...this.state, lightConfig: { ...this.lightConfig, ...config } });
  }
  protected recreate(data: FurnitureData) { return new Luminaire(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitLuminaire(this); }
}

export class Shelving extends Furniture {
  static readonly minShelves = 2;
  static readonly maxShelves = 10;
  readonly kind = 'furniture.shelving';
  constructor(data: FurnitureData) {
    const shelfCount = data.shelfCount ?? Math.max(Shelving.minShelves, Math.min(Shelving.maxShelves, Math.round(data.dimensions.y / 0.38) + 1));
    if (!Number.isInteger(shelfCount) || shelfCount < Shelving.minShelves || shelfCount > Shelving.maxShelves) throw new Error('Shelving needs 2–10 shelves');
    super({ ...data, shelfCount });
    Object.freeze(this);
  }
  get shelfCount(): number { return this.state.shelfCount!; }
  withShelfConfiguration(shelfCount: number, hasLids = this.hasLids ?? false): Shelving {
    return new Shelving({ ...this.state, shelfCount, hasLids });
  }
  protected recreate(data: FurnitureData) { return new Shelving(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitShelving(this); }
}

export class BasinCabinet extends Furniture {
  readonly kind = 'furniture.basin';
  constructor(data: FurnitureData) { super(data); Object.freeze(this); }
  get basinHeight() { return Math.min(0.08, this.dimensions.y / 4); }
  get carcassHeight() { return this.dimensions.y - this.basinHeight; }
  protected recreate(data: FurnitureData) { return new BasinCabinet(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitBasinCabinet(this); }
}
