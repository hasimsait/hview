import type { WallRecess } from '../elements/WallRecess';
import type { Column } from '../elements/Column';
import type { BasinCabinet,Luminaire,Shelving,StandardFurniture } from '../elements/Furniture';
import type { Door,SlidingDoor,WindowOpening } from '../elements/Opening';
import type { PlanElementVisitor } from '../elements/PlanElement';
import type { Room } from '../elements/Room';
import type { Wall } from '../elements/Wall';
import type { SerializedElement } from './PlanSchema';

export class PlanEncoder implements PlanElementVisitor<SerializedElement> {
  visitRecess(element: WallRecess): SerializedElement { return { kind: 'furniture.recess', data: element.toData() }; }
  visitWall(element: Wall): SerializedElement { return { kind: 'wall', data: element.toData() }; }
  visitRoom(element: Room): SerializedElement { return { kind: 'room', data: element.toData() }; }
  visitColumn(element: Column): SerializedElement { return { kind: 'column', data: element.toData() }; }
  visitFurniture(element: StandardFurniture): SerializedElement { return { kind: 'furniture.standard', data: element.toData() }; }
  visitLuminaire(element: Luminaire): SerializedElement { return { kind: 'furniture.luminaire', data: element.toData() }; }
  visitShelving(element: Shelving): SerializedElement { return { kind: 'furniture.shelving', data: element.toData() }; }
  visitBasinCabinet(element: BasinCabinet): SerializedElement { return { kind: 'furniture.basin', data: element.toData() }; }
  visitDoor(_element: Door): SerializedElement { throw new Error('Encode hosted openings through their owner wall'); }
  visitSlidingDoor(_element: SlidingDoor): SerializedElement { throw new Error('Encode hosted openings through their owner wall'); }
  visitWindow(_element: WindowOpening): SerializedElement { throw new Error('Encode hosted openings through their owner wall'); }
}
