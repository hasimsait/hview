import type * as THREE from 'three';
import type { Column } from '../../domain/elements/Column';
import type { BasinCabinet,Furniture,Luminaire,Shelving,StandardFurniture } from '../../domain/elements/Furniture';
import type { Door,Opening,SlidingDoor,WindowOpening } from '../../domain/elements/Opening';
import type { PlanElementVisitor } from '../../domain/elements/PlanElement';
import type { Room } from '../../domain/elements/Room';
import type { Wall } from '../../domain/elements/Wall';
import type { PickRegistry } from '../picking/PickRegistry';
import type { ResourcePool } from '../resources/ResourcePool';
import { FurnitureSceneNode,type FurnitureAppearance,type FurnitureGeometryBuilder } from './FurnitureSceneNode';
import type { SceneNode } from './SceneNode';
import { ColumnSceneNode,OpeningSceneNode,RoomSceneNode,WallSceneNode,type OpeningNodeBuilder,type RoomNodeBuilder,type WallNodeBuilder } from './StructuralSceneNodes';

export interface SceneBuilders {
  readonly furniture: FurnitureGeometryBuilder<Furniture>;
  readonly appearance: FurnitureAppearance<Furniture>;
  readonly wall: WallNodeBuilder;
  readonly column: { build(element: Column): THREE.Object3D; applyMaterials(root: THREE.Object3D, element: Column): void };
  readonly room: RoomNodeBuilder;
  readonly opening: OpeningNodeBuilder;
}

export class SceneNodeFactory implements PlanElementVisitor<SceneNode> {
  constructor(private readonly builders: SceneBuilders, private readonly resources: ResourcePool, private readonly picking: PickRegistry) { }
  visitWall(element: Wall): SceneNode { return new WallSceneNode(element, this.builders.wall, this.resources, this.picking); }
  visitColumn(element: Column): SceneNode { return new ColumnSceneNode(element, this.builders.column, this.resources, this.picking); }
  visitRoom(element: Room): SceneNode { return new RoomSceneNode(element, this.builders.room, this.resources, this.picking); }
  private opening(element: Opening): SceneNode { return new OpeningSceneNode(element, this.builders.opening, this.resources, this.picking); }
  visitDoor(element: Door): SceneNode { return this.opening(element); }
  visitSlidingDoor(element: SlidingDoor): SceneNode { return this.opening(element); }
  visitWindow(element: WindowOpening): SceneNode { return this.opening(element); }
  private furniture<T extends Furniture>(element: T): SceneNode { return new FurnitureSceneNode(element, this.builders.furniture, this.builders.appearance, this.resources, this.picking); }
  visitFurniture(element: StandardFurniture): SceneNode { return this.furniture(element); }
  visitLuminaire(element: Luminaire): SceneNode { return this.furniture(element); }
  visitBasinCabinet(element: BasinCabinet): SceneNode { return this.furniture(element); }
  visitShelving(element: Shelving): SceneNode { return this.furniture(element); }
}
