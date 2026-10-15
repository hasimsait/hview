import * as THREE from 'three';
import type { Column } from '../../domain/elements/Column';
import type { Opening } from '../../domain/elements/Opening';
import type { Room } from '../../domain/elements/Room';
import type { Wall } from '../../domain/elements/Wall';
import type { PickRegistry } from '../picking/PickRegistry';
import type { ResourcePool } from '../resources/ResourcePool';
import { SceneNode } from './SceneNode';

export interface WallNodeBuilder {
  build(element: Wall): THREE.Object3D;
  applyMaterials(root: THREE.Object3D, element: Wall): void;
}

export class WallSceneNode extends SceneNode<Wall> {
  constructor(element: Wall, private readonly builder: WallNodeBuilder, resources: ResourcePool, picking: PickRegistry) {
    super(element, resources, picking, { kind: 'wall', id: element.id });
    this.replaceGeometry(builder.build(element));
  }
  reconcile(element: Wall): void {
    const previous = this.element;
    const geometryChanged = previous.p1 !== element.p1 || previous.p2 !== element.p2 || previous.thickness !== element.thickness
      || previous.height !== element.height || openingCutSignature(previous) !== openingCutSignature(element) || previous.cavities !== element.cavities
      || previous.startOffset !== element.startOffset || previous.endOffset !== element.endOffset || previous.frameStyle !== element.frameStyle;
    if (geometryChanged) this.replaceGeometry(this.builder.build(element));
    else { this.builder.applyMaterials(this.group, element); this.refreshMaterials(); }
    this.element = element;
  }
  rebuild(): void { this.replaceGeometry(this.builder.build(this.element)); }
}

export interface OpeningNodeBuilder { build(element: Opening): THREE.Object3D; update(root: THREE.Object3D, element: Opening): void; }
export interface RoomNodeBuilder { build(element: Room): THREE.Object3D; applyMaterials(root: THREE.Object3D, element: Room): void; }

export class OpeningSceneNode extends SceneNode<Opening> {
  constructor(element: Opening, private readonly builder: OpeningNodeBuilder, resources: ResourcePool, picking: PickRegistry) {
    super(element, resources, picking, { kind: 'opening', id: element.id }); this.replaceGeometry(builder.build(element));
  }
  reconcile(element: Opening): void {
    const previous = this.element;
    if (previous.width !== element.width || previous.height !== element.height || previous.floorHeight !== element.floorHeight || previous.position !== element.position || previous.wallId !== element.wallId || previous.swingSide !== element.swingSide || previous.hingeSide !== element.hingeSide) this.replaceGeometry(this.builder.build(element));
    else { this.builder.update(this.group.children[0], element); this.refreshMaterials(); }
    this.element = element;
  }
  rebuild(): void { this.replaceGeometry(this.builder.build(this.element)); }
}

export class ColumnSceneNode extends SceneNode<Column> {
  constructor(element: Column, private readonly builder: { build(element: Column): THREE.Object3D; applyMaterials(root: THREE.Object3D, element: Column): void }, resources: ResourcePool, picking: PickRegistry) {
    super(element, resources, picking, { kind: 'column', id: element.id }); this.replaceGeometry(builder.build(element));
  }
  reconcile(element: Column): void {
    const old = this.element;
    if (old.width !== element.width || old.depth !== element.depth || old.height !== element.height || old.worldPos !== element.worldPos || old.rotationY !== element.rotationY) this.replaceGeometry(this.builder.build(element));
    else { this.builder.applyMaterials(this.group, element); this.refreshMaterials(); }
    this.element = element;
  }
  rebuild(): void { this.replaceGeometry(this.builder.build(this.element)); }
}

export class RoomSceneNode extends SceneNode<Room> {
  constructor(element: Room, private readonly builder: RoomNodeBuilder, resources: ResourcePool, picking: PickRegistry) {
    super(element, resources, picking, { kind: 'room', id: element.id }); this.replaceGeometry(builder.build(element));
  }
  reconcile(element: Room): void {
    if (element.polygon !== this.element.polygon || element.name !== this.element.name || element.area !== this.element.area) this.replaceGeometry(this.builder.build(element));
    else { this.builder.applyMaterials(this.group, element); this.refreshMaterials(); }
    this.element = element;
  }
}

function openingCutSignature(wall: Wall): string { return JSON.stringify(wall.openings.map(opening => [opening.id, opening.width, opening.height, opening.floorHeight, opening.distanceAlongWall])); }
