import type { Point2D } from './PlanData';

/** Plan-space vector arithmetic, independent of the rendering library. */
export class PlanVector2 {
  constructor(readonly x = 0, readonly y = 0) { }
  static from(point: Point2D) { return new PlanVector2(point.x, point.y); }
  static sub(a: Point2D, b: Point2D) { return new PlanVector2(a.x - b.x, a.y - b.y); }
  clone() { return new PlanVector2(this.x, this.y); }
  copy(point: Point2D) { return PlanVector2.from(point); }
  subVectors(a: Point2D, b: Point2D) { return PlanVector2.sub(a, b); }
  distanceTo(point: Point2D) { return Math.hypot(this.x - point.x, this.y - point.y); }
  normalize() { const length = Math.hypot(this.x, this.y) || 1; return new PlanVector2(this.x / length, this.y / length); }
  addScaledVector(vector: Point2D, scale: number) { return new PlanVector2(this.x + vector.x * scale, this.y + vector.y * scale); }
  dot(vector: Point2D) { return this.x * vector.x + this.y * vector.y; }
}
