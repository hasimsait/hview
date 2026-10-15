import * as THREE from 'three';
import type { PlanElement } from '../../domain/elements/PlanElement';
import type { PickTarget } from '../picking/PickRegistry';
import { PickRegistry } from '../picking/PickRegistry';
import { ResourcePool,type ResourceLease } from '../resources/ResourcePool';

export abstract class SceneNode<T extends PlanElement = PlanElement> {
  readonly group = new THREE.Group();
  private lease: ResourceLease | null = null;
  private unregister: (() => void) | null = null;

  protected constructor(
    protected element: T,
    private readonly resources: ResourcePool,
    private readonly picking: PickRegistry,
    private readonly target: PickTarget
  ) {
    this.group.name = `${target.kind}_${element.id}`;
  }

  get id(): string {
    return this.element.id;
  }

  get model(): T {
    return this.element;
  }

  protected replaceGeometry(content: THREE.Object3D): void {
    this.unregister?.();
    this.group.clear();
    this.group.add(content);
    // Keep the previous lease until replacement resources have been retained.
    const next = this.resources.ownTree(this.group);
    this.lease?.dispose();
    this.lease = next;
    this.unregister = this.picking.register(this.group, this.target);
  }

  protected refreshMaterials(): void {
    this.lease?.refresh();
  }

  refreshResources(): void {
    this.refreshMaterials();
  }

  abstract reconcile(element: T): void;

  dispose(): void {
    this.unregister?.();
    this.unregister = null;
    this.lease?.dispose();
    this.lease = null;
    this.group.removeFromParent();
    this.group.clear();
  }
}
