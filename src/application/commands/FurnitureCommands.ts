import { Luminaire,Shelving } from '../../domain/elements/Furniture';
import type { FurnitureData,LightFixtureConfig,SurfaceFinishConfig,Vector3D } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import { RecessPlacement } from '../../domain/model/RecessPlacement';
import type { CommandContext,EditorCommand } from './EditorCommand';

export class SetLightIntensity implements EditorCommand {
  readonly label = 'Change light intensity';
  constructor(private readonly id: string, private readonly intensity: number) { }
  execute(document: PlanDocument): PlanDocument {
    return document.replace(document.requireLuminaire(this.id).withIntensity(this.intensity));
  }
}
export class ConfigureLuminaire implements EditorCommand {
  readonly label = 'Configure light';
  constructor(private readonly id: string, private readonly config: Partial<LightFixtureConfig>) { }
  execute(document: PlanDocument): PlanDocument {
    return document.replace(document.requireLuminaire(this.id).withEmission(this.config));
  }
}
export class TransformFurniture implements EditorCommand {
  readonly label = 'Transform furniture';
  constructor(private readonly id: string, private readonly position?: Vector3D, private readonly rotationY?: number, private readonly dimensions?: Vector3D) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    let item = document.requireFurniture(this.id);
    if (this.position !== undefined || this.rotationY !== undefined) item = item.withTransform(this.position ?? item.position, this.rotationY ?? item.rotationY);
    if (this.dimensions) item = item.withDimensions(this.dimensions);
    if (item.assetKey === 'wall_recess' && item !== document.requireFurniture(this.id)) item = factory.furniture(new RecessPlacement().align(item.toData(), [...document.walls, ...document.columns.map(column => column.wallShape(document.totalHeight))]));
    return document.replace(item);
  }
}
export class ReplaceFurniture implements EditorCommand {
  readonly label = 'Replace furniture asset';
  constructor(private readonly id: string, private readonly assetKey: string, private readonly customModelUrl?: string) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const previous = document.requireFurniture(this.id);
    const key = factory.catalog.canonicalKey(this.assetKey);
    if (key === previous.assetKey && this.customModelUrl === previous.customModelUrl) return document;
    const definition = factory.catalog.get(key);
    const data = previous.toData();
    const replacement = factory.furniture({
      ...data, assetKey: key, customModelUrl: this.customModelUrl,
      displayName: key.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
      category: (definition?.category as FurnitureData['category']) ?? data.category,
      lightConfig: factory.catalog.behavior(key) === 'luminaire' ? data.lightConfig : undefined,
      hasLids: factory.catalog.behavior(key) === 'shelving' ? data.hasLids : undefined, sectionFinishes: undefined
    });
    return document.replaceFurniture(this.id, replacement);
  }
}
export class AddFurniture implements EditorCommand {
  readonly label = 'Add furniture';
  constructor(private readonly data: FurnitureData) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument { return document.add(factory.furniture(new RecessPlacement().align(this.data, [...document.walls, ...document.columns.map(column => column.wallShape(document.totalHeight))]))); }
}
export class RemoveElement implements EditorCommand {
  readonly label = 'Delete element';
  constructor(private readonly id: string) { }
  execute(document: PlanDocument): PlanDocument { return document.remove(this.id); }
}
export class FinishFurniture implements EditorCommand {
  readonly label = 'Finish furniture';
  constructor(private readonly id: string, private readonly finish?: SurfaceFinishConfig, private readonly section?: string) { }
  execute(document: PlanDocument): PlanDocument {
    const item = document.requireFurniture(this.id);
    return document.replace(this.section ? item.withSectionFinish(this.section, this.finish) : item.withFinish(this.finish));
  }
}
export class ConfigureShelving implements EditorCommand {
  readonly label = 'Configure shelving';
  constructor(private readonly id: string, private readonly hasLids: boolean, private readonly shelfCount?: number) { }
  execute(document: PlanDocument): PlanDocument {
    const item = document.requireFurniture(this.id);
    if (!(item instanceof Shelving)) throw new Error('Only shelving has a shelf configuration');
    return document.replace(item.withShelfConfiguration(this.shelfCount ?? item.shelfCount, this.hasLids));
  }
}

// This type guard also prevents fixture categories from acquiring lighting behavior.
export function isLuminaire(item: unknown): item is Luminaire { return item instanceof Luminaire; }
