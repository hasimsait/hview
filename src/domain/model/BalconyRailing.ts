import type { Point2D, WallData } from './PlanData';
import { finite, positive } from './Immutable';

export interface BalconyRailingConfig {
  height: number;
  color: string;
  /** Omitted means every open edge; indices refer to the room polygon. */
  edges?: readonly number[];
}
export const DEFAULT_BALCONY_RAILING: BalconyRailingConfig = { height: 1.05, color: '#30363b' };
export function validateBalconyRailing(config: BalconyRailingConfig, edgeCount: number): void {
  if (positive(config.height, 'Railing height') < .3 || config.height > 3) throw new Error('Railing height must be between 30 and 300 cm');
  if (!/^#[\da-f]{6}$/i.test(config.color)) throw new Error('Railing colour must be a hex colour');
  if (config.edges && config.edges.some(edge => !Number.isInteger(finite(edge, 'Railing edge')) || edge < 0 || edge >= edgeCount)) throw new Error('Invalid railing edge');
}
type BoundaryWall = Pick<WallData, 'p1' | 'p2' | 'thickness' | 'startOffset' | 'endOffset'>;
export interface RailingRun { edge: number; start: Point2D; end: Point2D; startAtWall: boolean; endAtWall: boolean }
const inset = .025;
const dot = (a: Point2D, b: Point2D) => a.x * b.x + a.y * b.y;
const cross = (a: Point2D, b: Point2D) => a.x * b.y - a.y * b.x;
const sub = (a: Point2D, b: Point2D): Point2D => ({ x: a.x - b.x, y: a.y - b.y });
const along = (a: Point2D, direction: Point2D, distance: number): Point2D => ({ x: a.x + direction.x * distance, y: a.y + direction.y * distance });
const distance = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
function wallRectangle(wall: BoundaryWall) {
  const length = distance(wall.p1, wall.p2);
  if (length < .001) return undefined;
  const direction = { x: (wall.p2.x - wall.p1.x) / length, y: (wall.p2.y - wall.p1.y) / length };
  return { wall, direction, normal: { x: -direction.y, y: direction.x }, min: -(wall.startOffset ?? 0), max: length + (wall.endOffset ?? 0) };
}

/** Cut the floor's perimeter by actual wall footprints. Open corners share a single inset intersection. */
export function openRailingRuns(polygon: readonly Point2D[], walls: readonly BoundaryWall[], edges?: readonly number[]): RailingRun[] {
  const area = polygon.reduce((sum, point, i) => sum + cross(point, polygon[(i + 1) % polygon.length]), 0);
  const rectangles = walls.map(wallRectangle).filter((value): value is NonNullable<typeof value> => !!value);
  const runs: RailingRun[] = [];
  const touchesWall = (point: Point2D) => rectangles.some(rect => {
    const local = sub(point, rect.wall.p1), x = dot(local, rect.direction), y = dot(local, rect.normal);
    return x >= rect.min - .001 && x <= rect.max + .001 && Math.abs(y) <= rect.wall.thickness / 2 + .001;
  });
  for (let edge = 0; edge < polygon.length; edge++) {
    if (edges && !edges.includes(edge)) continue;
    const a = polygon[edge], b = polygon[(edge + 1) % polygon.length], length = distance(a, b);
    if (length < .001) continue;
    const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length }, sign = area >= 0 ? 1 : -1;
    const start = along(a, { x: -direction.y * sign, y: direction.x * sign }, inset);
    const blocked: [number, number][] = [];
    for (const rect of rectangles) {
      const local = sub(start, rect.wall.p1), perpendicular = dot(direction, rect.normal);
      // A boundary lying on the room-side wall face still counts as walled, even though the rail is inset.
      const half = rect.wall.thickness / 2 + (Math.abs(perpendicular) < .025 ? inset + .025 : 0);
      let low = 0, high = length;
      for (const [origin, delta, min, max] of [[dot(local, rect.direction), dot(direction, rect.direction), rect.min, rect.max], [dot(local, rect.normal), perpendicular, -half, half]]) {
        if (Math.abs(delta) < .000001) { if (origin < min || origin > max) high = -1; }
        else { const first = (min - origin) / delta, second = (max - origin) / delta; low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second)); }
      }
      if (high >= low) blocked.push([low, high]);
    }
    blocked.sort((a, b) => a[0] - b[0]); let cursor = 0;
    const append = (from: number, to: number) => {
      if (to - from < .08) return;
      const endA = along(start, direction, from), endB = along(start, direction, to);
      runs.push({ edge, start: endA, end: endB, startAtWall: touchesWall(endA), endAtWall: touchesWall(endB) });
    };
    for (const [low, high] of blocked) { append(cursor, low); cursor = Math.max(cursor, high); }
    append(cursor, length);
  }
  // Meet adjacent open edges at their offset-line intersection, with no duplicate corner posts.
  for (const first of runs) {
    const nextEdge = (first.edge + 1) % polygon.length, corner = polygon[nextEdge];
    if (first.endAtWall || distance(first.end, corner) > .06) continue;
    const second = runs.find(run => run.edge === nextEdge && !run.startAtWall && distance(run.start, corner) <= .06);
    if (!second) continue;
    const a = sub(first.end, first.start), b = sub(second.end, second.start), denominator = cross(a, b);
    const point = Math.abs(denominator) < .000001 ? first.end : along(first.start, a, cross(sub(second.start, first.start), b) / denominator);
    if (distance(point, corner) > .2 || touchesWall(point)) continue;
    first.end = point; second.start = point;
  }
  return runs;
}
