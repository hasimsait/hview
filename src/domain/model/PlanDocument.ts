import { Column } from '../elements/Column';
import { Furniture,Luminaire,StandardFurniture,type BasinCabinet,type Shelving } from '../elements/Furniture';
import { Door,Opening,type SlidingDoor,type WindowOpening } from '../elements/Opening';
import { PlanElement,type PlanElementVisitor } from '../elements/PlanElement';
import { Room } from '../elements/Room';
import { Wall } from '../elements/Wall';
import { immutable,positive } from './Immutable';
import type { SurfaceFinishConfig } from './PlanData';
import { WallJunctions } from './WallJunctions';
import { WallTopology } from './WallTopology';

class DocumentIndex implements PlanElementVisitor<void> {
  readonly byId = new Map<string, PlanElement>();
  readonly walls: Wall[] = [];
  readonly rooms: Room[] = [];
  readonly columns: Column[] = [];
  readonly furniture: Furniture[] = [];
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
  readonly allElements: readonly PlanElement[];
  readonly rawPlan: unknown;

  constructor(
    elements: readonly PlanElement[],
    readonly totalHeight = 2.7,
    readonly version = 1,
    extensions: unknown = {},
  ) {
    positive(totalHeight, 'Plan height');
    this.elements = Object.freeze([...elements]);
    this.index = new DocumentIndex();
    for (const element of elements) element.accept(this.index);
    this.walls = Object.freeze(this.index.walls);
    this.rooms = Object.freeze(this.index.rooms);
    this.columns = Object.freeze(this.index.columns);
    this.furniture = Object.freeze(this.index.furniture);
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
    return host ? this.replace(host.withOpenings(host.openings.filter(opening => opening.id !== id)))
      : this.next(this.elements.filter(element => element.id !== id));
  }

  replaceFurniture(id: string, replacement: Furniture): PlanDocument {
    const previous = this.requireFurniture(id);
    if (replacement.id !== previous.id) throw new Error('Replacement must preserve element identity');
    return this.replace(replacement.withTransform(previous.position, previous.rotationY).withDimensions(previous.dimensions));
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
      document = document.replace(next.withFinish('edges', finish));
    }
    for (const column of this.columns) {
      if (column.roomId === roomId) document = document.replace(column.withFinish('all', finish));
    }
    return document.replace(room.withWallFinish(finish));
  }

  splitColumn(id: string, distance: number): PlanDocument {
    const column = this.require(id);
    if (!(column instanceof Column)) throw new Error('Expected a column');
    const [first, second] = column.splitAt(distance);
    if (this.get(first.id) || this.get(second.id)) throw new Error('Split segment IDs already exist');
    const start = column.wallShape(this.totalHeight).p1;
    const along = (item: Furniture) => (item.position.x - start.x) * Math.cos(column.rotationY) - (item.position.z - start.y) * Math.sin(column.rotationY);
    for (const item of this.furniture) if (item.assetKey === 'wall_recess' && item.rawItem?.wallId === id && Math.abs(along(item) - distance) < item.dimensions.x / 2) throw new Error('Split intersects a recess');
    return this.next(this.elements.flatMap(element => {
      if (element.id === id) return [first, second];
      if (element instanceof StandardFurniture && element.assetKey === 'wall_recess' && element.rawItem?.wallId === id) {
        const data = element.toData();
        return [new StandardFurniture({ ...data, rawItem: { ...data.rawItem, wallId: along(element) <= distance ? first.id : second.id } })];
      }
      return [element];
    }));
  }

  splitWall(id: string, distance: number): { document: PlanDocument; wall1: Wall; wall2: Wall } {
    const wall = this.requireWall(id);
    wall.assertSplittable(distance);
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
      cavities: data.cavities?.filter(cavity => cavity.distanceAlongWall <= distance)
    }, firstOpenings);
    const first = wall1.withRoomRelationship(topology.roomsFor(wall1, this.rooms));
    const wall2 = new Wall({
      ...data, id: secondId, p1: point, startOffset: 0,
      cavities: data.cavities?.filter(cavity => cavity.distanceAlongWall > distance)
        .map(cavity => ({ ...cavity, distanceAlongWall: cavity.distanceAlongWall - distance }))
    }, secondOpenings);
    const second = wall2.withRoomRelationship(topology.roomsFor(wall2, this.rooms));
    const elements = this.elements.flatMap(element => element.id === id ? [first, second] : [element]);
    const next = elements.map(element => element instanceof Column && element.stubIds?.includes(id)
      ? element.withSources(element.stubIds.flatMap(source => source === id ? [firstId, secondId] : [source])) : element);
    const hosted = next.map(element => {
      if (!(element instanceof StandardFurniture) || element.assetKey !== 'wall_recess' || element.rawItem?.wallId !== id) return element;
      const along = ((element.position.x - wall.p1.x) * (wall.p2.x - wall.p1.x) + (element.position.z - wall.p1.y) * (wall.p2.y - wall.p1.y)) / wall.length;
      const data = element.toData();
      return new StandardFurniture({ ...data, rawItem: { ...data.rawItem, wallId: along <= distance ? firstId : secondId } });
    });
    const offsets = WallJunctions.resolve(hosted.filter((element): element is Wall => element instanceof Wall));
    const resolved = hosted.map(element => {
      const offset = offsets.get(element.id);
      return element instanceof Wall && offset ? element.withJunctionOffsets(offset.startOffset, offset.endOffset) : element;
    });
    const document = this.next(resolved);
    return { document, wall1: document.requireWall(firstId), wall2: document.requireWall(secondId) };
  }
}
