import { Column } from '../elements/Column';
import { Furniture,Luminaire,type StandardFurniture,type BasinCabinet,type Shelving } from '../elements/Furniture';
import { Door,Opening,type SlidingDoor,type WindowOpening } from '../elements/Opening';
import { PlanElement,type PlanElementVisitor } from '../elements/PlanElement';
import { Room } from '../elements/Room';
import { Wall } from '../elements/Wall';
import { WallRecess, type RecessHost, type RecessOptions } from '../elements/WallRecess';
import { immutable,positive } from './Immutable';
import type { SurfaceFinishConfig, Vector3D } from './PlanData';
import { WallJunctions } from './WallJunctions';
import { WallTopology } from './WallTopology';

class DocumentIndex implements PlanElementVisitor<void> {
  readonly byId = new Map<string, PlanElement>();
  readonly walls: Wall[] = [];
  readonly rooms: Room[] = [];
  readonly columns: Column[] = [];
  readonly furniture: Furniture[] = [];
  readonly recesses: WallRecess[] = [];
  private add(element: PlanElement) {
    if (this.byId.has(element.id)) throw new Error(`Duplicate element ID: ${element.id}`);
    this.byId.set(element.id, element);
  }
  visitWall(element: Wall) { this.add(element); this.walls.push(element); for (const opening of element.openings) opening.accept(this); }
  visitRoom(element: Room) { this.add(element); this.rooms.push(element); }
  visitColumn(element: Column) { this.add(element); this.columns.push(element); }
  visitDoor(element: Door) { this.add(element); }
  visitSlidingDoor(element: SlidingDoor) { this.add(element); }
  visitWindow(element: WindowOpening) { this.add(element); }
  private addFurniture(element: Furniture) { this.add(element); this.furniture.push(element); }
  visitRecess(element: WallRecess) { this.addFurniture(element); this.recesses.push(element); }
  visitFurniture(element: StandardFurniture) { this.addFurniture(element); }
  visitLuminaire(element: Luminaire) { this.addFurniture(element); }
  visitBasinCabinet(element: BasinCabinet) { this.addFurniture(element); }
  visitShelving(element: Shelving) { this.addFurniture(element); }
}

/** Immutable aggregate: the only authoritative document representation. */
export class PlanDocument {
  private readonly index: DocumentIndex;
  readonly elements: readonly PlanElement[];
  readonly walls: readonly Wall[];
  readonly rooms: readonly Room[];
  readonly columns: readonly Column[];
  readonly furniture: readonly Furniture[];
  readonly recesses: readonly WallRecess[];
  readonly allElements: readonly PlanElement[];
  readonly rawPlan: unknown;

  constructor(
    elements: readonly PlanElement[],
    readonly totalHeight = 2.7,
    readonly version = 1,
    extensions: unknown = {},
  ) {
    positive(totalHeight, 'Plan height');
    // Junction trims belong to the current network, never to a saved offset.
    // Resolve them once here for every import and structural edit.
    const walls = elements.filter((element): element is Wall => element instanceof Wall);
    const columns = elements.filter((element): element is Column => element instanceof Column);
    const offsets = WallJunctions.resolve([...walls, ...columns.map(column => column.wallShape(totalHeight))]);
    this.elements = Object.freeze(elements.map(element => {
      const offset = offsets.get(element.id);
      return element instanceof Wall && offset
        ? element.withJunctionOffsets(offset.startOffset, offset.endOffset) : element;
    }));
    this.index = new DocumentIndex();
    for (const element of this.elements) element.accept(this.index);
    this.walls = Object.freeze(this.index.walls);
    this.rooms = Object.freeze(this.index.rooms);
    this.columns = Object.freeze(this.index.columns);
    this.furniture = Object.freeze(this.index.furniture);
    this.recesses = Object.freeze(this.index.recesses);
    for (const element of this.elements) if (element instanceof Opening) throw new Error('Openings must be owned by a wall');
    for (const recess of this.recesses) if (recess.hostId) this.requireRecessHost(recess.hostId);
    this.allElements = Object.freeze([...this.index.byId.values()]);
    this.rawPlan = immutable(extensions);
    Object.freeze(this);
  }

  get(id: string): PlanElement | undefined { return this.index.byId.get(id); }
  require(id: string): PlanElement {
    const element = this.get(id);
    if (!element) throw new Error(`Unknown element: ${id}`);
    return element;
  }
  requireWall(id: string): Wall {
    const element = this.require(id);
    if (!(element instanceof Wall)) throw new Error(`${id} is not a wall`);
    return element;
  }
  requireFurniture(id: string): Furniture {
    const element = this.require(id);
    if (!(element instanceof Furniture)) throw new Error(`${id} is not furniture`);
    return element;
  }
  requireLuminaire(id: string): Luminaire {
    const element = this.requireFurniture(id);
    if (!(element instanceof Luminaire)) throw new Error(`${id} is not a luminaire`);
    return element;
  }
  requireRoom(id: string): Room {
    const element = this.require(id);
    if (!(element instanceof Room)) throw new Error(`${id} is not a room`);
    return element;
  }
  private next(elements: readonly PlanElement[]): PlanDocument {
    return new PlanDocument(elements, this.totalHeight, this.version, this.rawPlan);
  }
  add(element: PlanElement): PlanDocument {
    if (this.get(element.id)) throw new Error(`Duplicate element ID: ${element.id}`);
    return this.next([...this.elements, element]);
  }
  replace(element: PlanElement): PlanDocument {
    const previous = this.require(element.id);
    if (previous === element) return this;
    const host = this.walls.find(wall => wall.openings.some(opening => opening.id === element.id));
    if (host) {
      // Hosted objects remain owned by their wall, and indexed by the aggregate.
      if (!(element instanceof Opening)) throw new Error('Hosted elements must be openings');
      const opening = element;
      if (opening.wallId !== host.id) throw new Error('Move hosted openings through a topology operation');
      return this.replace(host.withOpenings(host.openings.map(item => item.id === element.id ? opening : item)));
    }
    return this.next(this.elements.map(item => item.id === element.id ? element : item));
  }
  remove(id: string): PlanDocument {
    if (!this.get(id)) return this;
    const host = this.walls.find(wall => wall.openings.some(opening => opening.id === id));
    if (host) return this.replace(host.withOpenings(host.openings.filter(opening => opening.id !== id)));
    // A hosted recess cannot outlive its wall or column.
    return this.next(this.elements.filter(element => element.id !== id && !(element instanceof WallRecess && element.hostId === id)));
  }

  requireRecessHost(id: string): RecessHost {
    const host = this.require(id);
    if (host instanceof Wall) return host;
    if (host instanceof Column) return host.wallShape(this.totalHeight);
    throw new Error('A recess needs a wall or column');
  }

  recessesFor(hostId: string): readonly WallRecess[] { return this.recesses.filter(recess => recess.hostId === hostId); }

  get recessHosts(): readonly RecessHost[] { return [...this.walls, ...this.columns.map(column => column.wallShape(this.totalHeight))]; }

  addWallRecess(id: string, hostId: string, options: RecessOptions = {}): PlanDocument {
    return this.add(WallRecess.create(id, this.requireRecessHost(hostId), options));
  }

  addFurniture(item: Furniture): PlanDocument {
    return this.add(item instanceof WallRecess ? item.alignedWith(this.recessHosts, true) : item);
  }

  transformFurniture(id: string, position?: Vector3D, rotationY?: number, dimensions?: Vector3D): PlanDocument {
    const previous = this.requireFurniture(id);
    let item = previous.withTransform(position ?? previous.position, rotationY ?? previous.rotationY);
    if (dimensions) item = item.withDimensions(dimensions);
    if (item === previous) return this;
    if (item instanceof WallRecess) item = item.alignedWith(this.recessHosts, position === undefined);
    return this.replace(item);
  }

  private assertRecessSplitClear(host: RecessHost, distance: number): void {
    for (const recess of this.recessesFor(host.id)) recess.assertSplitClear(host, distance);
  }

  private rehostRecesses(elements: readonly PlanElement[], host: RecessHost, distance: number, firstId: string, secondId: string): readonly PlanElement[] {
    return elements.map(element => element instanceof WallRecess && element.hostId === host.id
      ? element.withHost(element.distanceAlong(host) <= distance ? firstId : secondId) : element);
  }

  replaceFurniture(id: string, replacement: Furniture): PlanDocument {
    const previous = this.requireFurniture(id);
    if (replacement.id !== previous.id) throw new Error('Replacement must preserve element identity');
    const item = replacement.withTransform(previous.position, previous.rotationY).withDimensions(previous.dimensions);
    return this.replace(item instanceof WallRecess ? item.alignedWith(this.recessHosts, true) : item);
  }

  applyRoomFinish(roomId: string, finish: SurfaceFinishConfig): PlanDocument {
    const room = this.requireRoom(roomId);
    let document: PlanDocument = this;
    for (const wall of this.walls) {
      if (wall.length < 0.02 || !wall.roomIds?.includes(roomId)) continue;
      let next = wall;
      if (wall.roomSideA === roomId) next = next.withFinish('A', finish);
      if (wall.roomSideB === roomId) next = next.withFinish('B', finish);
      if (!wall.roomSideA && !wall.roomSideB) next = next.withFinish('both', finish);
      const isSharedWithOtherRoom =
        (wall.roomSideA && wall.roomSideA !== roomId) ||
        (wall.roomSideB && wall.roomSideB !== roomId);
      if (!isSharedWithOtherRoom) next = next.withFinish('edges', finish);
      document = document.replace(next);
    }
    for (const column of this.columns) {
      if (column.roomId === roomId || column.roomIds?.includes(roomId)) {
        document = document.replace(column.withFinish('all', finish));
      }
    }
    return document.replace(room.withWallFinish(finish));
  }

  splitColumn(id: string, distance: number): PlanDocument {
    const column = this.require(id);
    if (!(column instanceof Column)) throw new Error('Expected a column');
    const [first, second] = column.splitAt(distance);
    if (this.get(first.id) || this.get(second.id)) throw new Error('Split segment IDs already exist');
    const host = column.wallShape(this.totalHeight);
    this.assertRecessSplitClear(host, distance);
    const elements = this.elements.flatMap(element => element.id === id ? [first, second] : [element]);
    return this.next(this.rehostRecesses(elements, host, distance, first.id, second.id));
  }

  splitWall(id: string, distance: number): { document: PlanDocument; wall1: Wall; wall2: Wall } {
    const wall = this.requireWall(id);
    wall.assertSplittable(distance);
    this.assertRecessSplitClear(wall, distance);
    const firstId = `${id}_a`, secondId = `${id}_b`;
    if (this.get(firstId) || this.get(secondId)) throw new Error('Split segment IDs already exist');
    const point = {
      x: wall.p1.x + (wall.p2.x - wall.p1.x) * distance / wall.length,
      y: wall.p1.y + (wall.p2.y - wall.p1.y) * distance / wall.length
    };
    const firstOpenings = wall.openings.filter(opening => opening.distanceAlongWall <= distance)
      .map(opening => opening.withHost(firstId, opening.distanceAlongWall));
    const secondOpenings = wall.openings.filter(opening => opening.distanceAlongWall > distance)
      .map(opening => opening.withHost(secondId, opening.distanceAlongWall - distance));
    const data = wall.toData();
    const topology = new WallTopology();
    const wall1 = new Wall({
      ...data, id: firstId, p2: point, endOffset: 0,
    }, firstOpenings);
    const first = wall1.withRoomRelationship(topology.roomsFor(wall1, this.rooms));
    const wall2 = new Wall({
      ...data, id: secondId, p1: point, startOffset: 0,
    }, secondOpenings);
    const second = wall2.withRoomRelationship(topology.roomsFor(wall2, this.rooms));
    const elements = this.elements.flatMap(element => element.id === id ? [first, second] : [element]);
    const next = elements.map(element => element instanceof Column && element.stubIds?.includes(id)
      ? element.withSources(element.stubIds.flatMap(source => source === id ? [firstId, secondId] : [source])) : element);
    const hosted = this.rehostRecesses(next, wall, distance, firstId, secondId);
    const document = this.next(hosted);
    return { document, wall1: document.requireWall(firstId), wall2: document.requireWall(secondId) };
  }
}
