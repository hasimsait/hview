import { finite } from './Immutable';

export class Angle {
  private constructor(readonly radians: number) { finite(radians, 'Angle'); Object.freeze(this); }
  static degrees(value: number): Angle { return new Angle(value * Math.PI / 180); }
  static radians(value: number): Angle { return new Angle(value); }
  get degrees(): number { return this.radians * 180 / Math.PI; }
}
