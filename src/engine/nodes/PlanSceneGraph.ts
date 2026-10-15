import * as THREE from 'three';
import { Column } from '../../domain/elements/Column';
import { Furniture } from '../../domain/elements/Furniture';
import { Opening } from '../../domain/elements/Opening';
import { Room } from '../../domain/elements/Room';
import { Wall } from '../../domain/elements/Wall';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { SceneNode } from './SceneNode';
import type { SceneNodeFactory } from './SceneNodeFactory';
import { ColumnSceneNode,OpeningSceneNode,WallSceneNode } from './StructuralSceneNodes';

export interface SceneBuckets { walls: THREE.Group; openings: THREE.Group; floors: THREE.Group; furniture: THREE.Group; fixtures: THREE.Group; }

/** Reconciles immutable elements into retained roots. Owns every node lifetime. */
export class PlanSceneGraph {
  private readonly nodes = new Map<string, SceneNode>();
  constructor(private readonly factory: SceneNodeFactory, private readonly buckets: SceneBuckets) { }
  get(id: string): SceneNode | undefined { return this.nodes.get(id); }
  values(): IterableIterator<SceneNode> { return this.nodes.values(); }
  reconcile(document: PlanDocument): void {
    const rebuildWalls = new Set<string>();
    const geometryChanged = (a: Furniture | undefined, b: Furniture | undefined) => !a || !b || a.assetKey !== b.assetKey || a.position !== b.position || a.dimensions !== b.dimensions;
    for (const item of document.furniture) {
      const previous = this.nodes.get(item.id)?.model;
      if (geometryChanged(previous instanceof Furniture ? previous : undefined, item)) {
        if (item.assetKey === 'wall_recess' && item.rawItem?.wallId) rebuildWalls.add(item.rawItem.wallId);
        if (previous instanceof Furniture && previous.assetKey === 'wall_recess' && previous.rawItem?.wallId) rebuildWalls.add(previous.rawItem.wallId);
      }
    }
    for (const node of this.nodes.values()) if (node.model instanceof Furniture && !document.get(node.id) && node.model.assetKey === 'wall_recess' && node.model.rawItem?.wallId) rebuildWalls.add(node.model.rawItem.wallId);
    const ids = new Set(document.allElements.map(element => element.id));
    for (const [id, node] of this.nodes) if (!ids.has(id)) { node.dispose(); this.nodes.delete(id); }
    for (const element of document.allElements) {
      let node = this.nodes.get(element.id);
      if (node && node.model.kind !== element.kind) { node.dispose(); this.nodes.delete(element.id); node = undefined; }
      if (!node) { node = element.accept(this.factory); this.nodes.set(element.id, node); }
      else if (node.model !== element) node.reconcile(element);
      const bucket = element instanceof Furniture ? (element.category === 'fixture' ? this.buckets.fixtures : this.buckets.furniture)
        : element instanceof Opening ? this.buckets.openings : element instanceof Room ? this.buckets.floors : this.buckets.walls;
      if (node.group.parent !== bucket) bucket.add(node.group);
      // Diagnostic metadata for tools and geometry inspection; picking uses PickRegistry.
      node.group.userData = {
        id: element.id, type: element instanceof Room ? 'room' : element instanceof Opening ? 'opening' : element instanceof Furniture ? 'furniture' : 'wall',
        ...(element instanceof Furniture ? { entity: element } : element instanceof Wall || element instanceof Column ? { wall: element instanceof Column ? element.wallShape(document.totalHeight) : element } : {})
      };
    }
    for (const id of rebuildWalls) {
      const node = this.nodes.get(id);
      if (node instanceof WallSceneNode || node instanceof ColumnSceneNode) node.rebuild();
    }
  }
  rebuildStructures(): void { for (const node of this.nodes.values()) if (node instanceof WallSceneNode || node instanceof ColumnSceneNode || node instanceof OpeningSceneNode) node.rebuild(); }
  refreshResources(): void { for (const node of this.nodes.values()) node.refreshResources(); }
  dispose(): void { for (const node of this.nodes.values()) node.dispose(); this.nodes.clear(); }
}
