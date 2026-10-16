import * as THREE from 'three';
import { WallRecess } from '../../domain/elements/WallRecess';
import type { Furniture } from '../../domain/elements/Furniture';
import type { PickRegistry } from '../picking/PickRegistry';
import type { ResourcePool } from '../resources/ResourcePool';
import { SceneNode } from './SceneNode';

export interface FurnitureGeometryBuilder<T extends Furniture> { build(element: T): THREE.Object3D; }
export interface FurnitureAppearance<T extends Furniture> { apply(root: THREE.Object3D, element: T): void; }

export class FurnitureSceneNode<T extends Furniture = Furniture> extends SceneNode<T> {
  constructor(element: T, private readonly builder: FurnitureGeometryBuilder<T>, private readonly appearance: FurnitureAppearance<T>, resources: ResourcePool, picking: PickRegistry) {
    super(element, resources, picking, { kind: 'furniture', id: element.id });
    this.rebuild(element); this.transform(element);
  }
  private transform(element: T): void {
    this.group.position.set(element.position.x, element.position.y, element.position.z);
    this.group.rotation.y = element.rotationY;
    this.group.visible = element.visible !== false;
  }
  rebuild(element: T = this.element): void {
    const content = this.builder.build(element);
    content.position.set(0, 0, 0); content.rotation.set(0, 0, 0);
    this.appearance.apply(content, element);
    this.replaceGeometry(content);
  }
  refreshAppearance(): void { this.appearance.apply(this.group, this.element); this.refreshMaterials(); }
  reconcile(element: T): void {
    const previous = this.element;
    const geometryChanged = previous.assetKey !== element.assetKey || previous.customModelUrl !== element.customModelUrl
      || !previous.size.equals(element.dimensions) || previous.hasLids !== element.hasLids
      || previous.windowCoveringOpen !== element.windowCoveringOpen
      || (previous instanceof WallRecess && element instanceof WallRecess && previous.hostId !== element.hostId)
      || ('shelfCount' in previous && previous.shelfCount !== (element as T & { shelfCount?: number }).shelfCount);
    if (geometryChanged) this.rebuild(element);
    else if (previous.finish !== element.finish || previous.sectionFinishes !== element.sectionFinishes || previous.lightConfig !== element.lightConfig) {
      this.appearance.apply(this.group, element); this.refreshMaterials();
    }
    this.transform(element); this.element = element;
  }
}
