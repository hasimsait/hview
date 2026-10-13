import * as THREE from 'three';
import { SceneObject, SurfaceDescriptor, RenderContext } from '../SceneObject';
import { FurnitureCategory, SurfaceFinishConfig, FurnitureEntity } from '../../../core/types/plan';

export abstract class FurnitureObject extends SceneObject {
  readonly objectType = 'furniture' as const;
  assetKey: string;
  category: FurnitureCategory;
  roomId?: string;
  customModelUrl?: string;
  finish?: SurfaceFinishConfig;
  sectionFinishes: Record<string, SurfaceFinishConfig> = {};
  rawItem?: any;

  constructor(id: string, name: string, assetKey: string, category: FurnitureCategory = 'storage') {
    super(id, name);
    this.assetKey = assetKey;
    this.category = category;
  }

  getSurfaceFinish(surfaceKey: string): SurfaceFinishConfig | undefined {
    if (surfaceKey === 'all') return this.finish;
    return this.sectionFinishes[surfaceKey] || this.sectionFinishes[surfaceKey.toLowerCase()] || this.finish;
  }

  setSurfaceFinish(surfaceKey: string, finish: SurfaceFinishConfig | undefined): void {
    if (surfaceKey === 'all') {
      this.finish = finish;
    } else {
      if (finish) {
        this.sectionFinishes[surfaceKey] = finish;
      } else {
        delete this.sectionFinishes[surfaceKey];
      }
    }
  }

  /**
   * By default, returns common surfaces declared by sectionFinishes or registered sections.
   * Specific subclasses override this with exact architectural components.
   */
  abstract getSurfaces(): SurfaceDescriptor[];

  /**
   * Polymorphic renderObject implemented by subclasses or generic builder.
   */
  abstract renderObject(context: RenderContext): THREE.Object3D;

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      displayName: this.name,
      category: this.category,
      assetKey: this.assetKey,
      position: { ...this.position },
      rotationY: this.rotation.y,
      dimensions: { ...this.dimensions },
      roomId: this.roomId,
      visible: this.visible,
      finish: this.finish ? { ...this.finish } : undefined,
      sectionFinishes: Object.keys(this.sectionFinishes).length > 0 ? { ...this.sectionFinishes } : undefined,
      customModelUrl: this.customModelUrl,
      rawItem: this.rawItem,
    };
  }

  /**
   * Helper to initialize from a legacy FurnitureEntity.
   */
  fromEntity(entity: FurnitureEntity): this {
    this.id = entity.id;
    this.name = entity.displayName || entity.name;
    this.assetKey = entity.assetKey;
    this.category = entity.category;
    this.position = { ...entity.position };
    this.rotation = { x: 0, y: entity.rotationY || 0, z: 0 };
    this.dimensions = { ...entity.dimensions };
    this.roomId = entity.roomId;
    this.visible = entity.visible !== false;
    this.finish = entity.finish;
    this.sectionFinishes = entity.sectionFinishes ? { ...entity.sectionFinishes } : {};
    this.customModelUrl = entity.customModelUrl;
    this.rawItem = entity.rawItem;
    return this;
  }
}
