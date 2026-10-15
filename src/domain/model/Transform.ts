import { finite,immutable } from './Immutable';
import type { Vector3D } from './PlanData';

export class Transform {
  readonly position: Readonly<Vector3D>;
  readonly rotationY: number;

  constructor(position: Vector3D, rotationY: number) {
    this.position = immutable({
      x: finite(position.x, 'Position X'),
      y: finite(position.y, 'Elevation'),
      z: finite(position.z, 'Position Z'),
    });
    this.rotationY = finite(rotationY, 'Rotation');
    Object.freeze(this);
  }

  equals(other: Transform): boolean {
    return this.rotationY === other.rotationY && this.position.x === other.position.x
      && this.position.y === other.position.y && this.position.z === other.position.z;
  }
}
