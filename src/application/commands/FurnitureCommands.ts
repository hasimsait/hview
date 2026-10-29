import { Luminaire,Shelving } from '../../domain/elements/Furniture';
import type { FurnitureData,LightFixtureConfig,SurfaceFinishConfig,Vector3D } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { CommandContext,EditorCommand } from './EditorCommand';
import { billyAssetFinish } from '../../domain/catalog/BillyFinishes';

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
export class SetWindowCoveringOpen implements EditorCommand {
  readonly label = 'Open window covering';
  constructor(private readonly id: string, private readonly openness: number) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const item = document.requireFurniture(this.id);
    const kind = factory.catalog.get(item.assetKey)?.softFurnishing?.kind;
    if (kind !== 'curtain' && kind !== 'blind') throw new Error('Expected a curtain or blind');
    return document.replace(item.withWindowCoveringOpen(this.openness));
  }
}
export class TransformFurniture implements EditorCommand {
  readonly label = 'Transform furniture';
  constructor(private readonly id: string, private readonly position?: Vector3D, private readonly rotationY?: number, private readonly dimensions?: Vector3D) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const item = document.requireFurniture(this.id);
    const dimensions = factory.catalog.get(item.assetKey)?.capabilities?.resizable === false ? undefined : this.dimensions;
    return document.transformFurniture(this.id, this.position, this.rotationY, dimensions);
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
      sectionFinishes: undefined, cabinet: undefined,
    });
    // Fixed-size wall fittings use the factory's corrected dimensions and wall
    // offset instead of retaining the previous housing's size and position.
    return definition?.capabilities?.resizable === false
      ? document.replace(replacement) : document.replaceFurniture(this.id, replacement);
  }
}
export class AddFurniture implements EditorCommand {
  readonly label = 'Add furniture';
  constructor(private readonly data: FurnitureData) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument { return document.addFurniture(factory.furniture(this.data)); }
}
export class DuplicateFurniture implements EditorCommand {
  readonly label = 'Duplicate asset';
  readonly selectionRemap: ReadonlyMap<string, string>;
  constructor(private readonly id: string, private readonly copyId: string) { this.selectionRemap = new Map([[id, copyId]]); }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const original = document.requireFurniture(this.id), data = original.toData();
    const position = { ...data.position, x: data.position.x + Math.cos(data.rotationY) * .15, z: data.position.z - Math.sin(data.rotationY) * .15 };
    return document.addFurniture(factory.furniture({ ...data, id: this.copyId, position }));
  }
}
export class AddBillyExtension implements EditorCommand {
  readonly label = 'Add BILLY height extension';
  readonly selectionRemap: ReadonlyMap<string, string>;
  constructor(private readonly id: string, private readonly extensionId: string, private readonly glass: boolean) { this.selectionRemap = new Map([[id, extensionId]]); }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const base = document.requireFurniture(this.id);
    if (factory.catalog.get(base.assetKey)?.recipe !== 'billy_bookcase' || base.assetKey.includes('_extension_')) throw new Error('Select a BILLY bookcase');
    const variant = billyAssetFinish(base.assetKey).id.replace('billy_', '');
    const assetKey = `ikea_billy_${this.glass ? 'oxberg_' : ''}extension_80_${variant}`, asset = factory.catalog.get(assetKey)!;
    const depth = asset.defaultDimensions.z, offset = (depth - base.dimensions.z) / 2;
    // Align the backs in the bookcase's local coordinates, including rotated cases.
    const position = { x: base.position.x + Math.sin(base.rotationY) * offset, y: base.position.y + base.dimensions.y, z: base.position.z + Math.cos(base.rotationY) * offset };
    return document.addFurniture(factory.furniture({ id: this.extensionId, assetKey, name: assetKey, displayName: asset.name, category: 'storage',
      dimensions: { ...asset.defaultDimensions, x: base.dimensions.x }, position, rotationY: base.rotationY, roomId: base.roomId,
      finish: base.finish, sectionFinishes: base.toData().sectionFinishes }));
  }
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
