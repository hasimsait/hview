import { identifier } from '../model/Immutable';
import type { Column } from './Column';
import type { BasinCabinet,Luminaire,Shelving,StandardFurniture } from './Furniture';
import type { Door,SlidingDoor,WindowOpening } from './Opening';
import type { Room } from './Room';
import type { Wall } from './Wall';

export interface PlanElementVisitor<R> {
  visitWall(element: Wall): R;
  visitColumn(element: Column): R;
  visitRoom(element: Room): R;
  visitDoor(element: Door): R;
  visitSlidingDoor(element: SlidingDoor): R;
  visitWindow(element: WindowOpening): R;
  visitBasinCabinet(element: BasinCabinet): R;
  visitLuminaire(element: Luminaire): R;
  visitShelving(element: Shelving): R;
  visitFurniture(element: StandardFurniture): R;
}

export abstract class PlanElement {
  readonly id: string;
  abstract readonly kind: string;
  abstract get displayName(): string;

  protected constructor(id: string) { this.id = identifier(id); }

  abstract accept<R>(visitor: PlanElementVisitor<R>): R;
}
