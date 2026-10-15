import * as THREE from 'three';
import { Column } from '../../domain/elements/Column';
import { Furniture } from '../../domain/elements/Furniture';
import { Opening } from '../../domain/elements/Opening';
import { Room } from '../../domain/elements/Room';
import { Wall } from '../../domain/elements/Wall';
import { WallRecess } from '../../domain/elements/WallRecess';
import { FurnitureSceneNode } from './FurnitureSceneNode';
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
    for (const recess of document.recesses) {
      const previous = this.nodes.get(recess.id)?.model;
      if (!(previous instanceof WallRecess) || !previous.transform.equals(recess.transform) || !previous.size.equals(recess.dimensions) || previous.hostId !== recess.hostId || previous.visible !== recess.visible) {
        if (recess.hostId) rebuildWalls.add(recess.hostId);
        if (previous instanceof WallRecess && previous.hostId) rebuildWalls.add(previous.hostId);
      }
    }
    for (const node of this.nodes.values()) {
      if (node.model instanceof WallRecess && node.model.hostId && !(document.get(node.id) instanceof WallRecess)) rebuildWalls.add(node.model.hostId);
    }
    const changedHosts = new Map([...document.walls, ...document.columns]
      .filter(host => this.nodes.has(host.id) && this.nodes.get(host.id)?.model !== host).map(host => [host.id, this.nodes.get(host.id)?.model]));
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
    // A host finish affects inherited recess surfaces; thickness affects its sleeve geometry.
    for (const recess of document.recesses) if (recess.hostId && changedHosts.has(recess.hostId)) {
      const node = this.nodes.get(recess.id);
      if (node instanceof FurnitureSceneNode) {
        const previous = changedHosts.get(recess.hostId);
        const thickness = previous instanceof Wall ? previous.thickness : previous instanceof Column ? previous.depth : undefined;
        if (thickness !== document.requireRecessHost(recess.hostId).thickness) node.rebuild();
        else node.refreshAppearance();
      }
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
