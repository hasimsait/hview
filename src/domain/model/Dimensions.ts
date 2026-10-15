import { positive } from './Immutable';
import type { Vector3D } from './PlanData';

export class Dimensions {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(size: Vector3D) {
    this.x = positive(size.x, 'Width');
    this.y = positive(size.y, 'Height');
    this.z = positive(size.z, 'Depth');
    Object.freeze(this);
  }

  equals(other: Vector3D): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }
}
