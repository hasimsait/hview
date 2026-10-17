import type { WallEntity } from '../../core/types/plan';
import { roomCeilingHeight } from '../../domain/model/Ceiling';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { CorniceCut, CorniceCuts } from './CorniceGeometry';
import { wallCorniceSides as corniceSides } from '../../domain/model/WallCornice';
export { wallCorniceSides as corniceSides } from '../../domain/model/WallCornice';

type Side = 'A' | 'B';
type Point = { x: number; y: number };
export interface WallCorniceLayout {
  heights: Partial<Record<Side, number>>;
  cuts: Partial<Record<Side, CorniceCuts>>;
}
interface Run {
  wall: WallEntity; side: Side; roomId?: string; top: number;
  direction: Point; normal: Point; length: number; back: number; front: number;
  cuts: CorniceCuts;
}
interface End { run: Run; atStart: boolean; point: Point; away: Point }
interface Join { a: End; b: End; cutA: CorniceCut; cutB: CorniceCut; angle: number }
const cache = new WeakMap<PlanDocument, ReadonlyMap<string, WallCorniceLayout>>();
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const add = (p: Point, d: Point, distance: number): Point => ({ x: p.x + d.x * distance, y: p.y + d.y * distance });

/** Plan-derived cuts only: saved dimensions and the wall body's butt joints stay untouched. */
export function wallCorniceLayouts(plan: PlanDocument): ReadonlyMap<string, WallCorniceLayout> {
  const cached = cache.get(plan); if (cached) return cached;
  const layouts = new Map<string, WallCorniceLayout>(), ends: End[] = [];
  for (const wall of plan.walls) {
    const config = wall.cornice;
    if (!config || config.profile === 'none') continue;
    const layout: WallCorniceLayout = { heights: {}, cuts: {} }; layouts.set(wall.id, layout);
    const length = wall.length; if (length < .001) continue;
    const direction = { x: (wall.p2.x - wall.p1.x) / length, y: (wall.p2.y - wall.p1.y) / length };
    for (const side of corniceSides(wall)) {
      const roomId = side === 'A' ? wall.roomSideA : wall.roomSideB, room = plan.rooms.find(r => r.id === roomId);
      const top = Math.min(wall.height, room ? roomCeilingHeight(room, plan.totalHeight) : wall.height);
      layout.heights[side] = top;
      const cuts: CorniceCuts = {}; layout.cuts[side] = cuts;
      if (config.hidden) continue;
      const sign = side === 'A' ? 1 : -1;
      const back = wall.thickness / 2 + config.offset;
      const run: Run = { wall, side, roomId, top, direction, normal: { x: -direction.y * sign, y: direction.x * sign }, length, back, front: back + config.depth, cuts };
      ends.push({ run, atStart: true, point: wall.p1, away: direction }, { run, atStart: false, point: wall.p2, away: { x: -direction.x, y: -direction.y } });
    }
  }
  const candidates: Join[] = [];
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const a = ends[i], b = ends[j], first = a.run, second = b.run;
    if (first.wall.id === second.wall.id || first.roomId && second.roomId && first.roomId !== second.roomId) continue;
    if (first.wall.cornice!.profile !== second.wall.cornice!.profile || Math.abs(first.top - second.top) > .0001 || Math.abs(first.wall.cornice!.height - second.wall.cornice!.height) > .0001) continue;
    // Accept shared nodes, small import gaps and endpoints already at a wall face.
    if (Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) > .08 + (first.wall.thickness + second.wall.thickness) / 2) continue;
    const denominator = cross(first.direction, second.direction);
    let back: Point, front: Point, angle: number;
    if (Math.abs(denominator) < .00001) {
      // Straight continuations must point away from each other and share their cross-section.
      if (dot(a.away, b.away) > -.9999 || dot(first.normal, second.normal) < .9999) continue;
      const displacement = { x: b.point.x - a.point.x, y: b.point.y - a.point.y };
      if (Math.abs(dot(displacement, first.normal) + second.back - first.back) > .0001 || Math.abs(first.front - first.back - second.front + second.back) > .0001) continue;
      const midpoint = add(a.point, first.direction, dot(displacement, first.direction) / 2);
      back = add(midpoint, first.normal, first.back); front = add(midpoint, first.normal, first.front); angle = Math.PI;
    } else {
      // Pair the two faces bounding the same sector, including reflex/outside corners.
      const turnA = Math.sign(cross(a.away, first.normal)), turnB = Math.sign(cross(b.away, second.normal));
      if (turnA === turnB) continue;
      angle = Math.atan2(cross(a.away, b.away) * turnA, dot(a.away, b.away)); if (angle <= 0) angle += Math.PI * 2;
      const intersection = (distanceA: number, distanceB: number) => {
        const p = add(first.wall.p1, first.normal, distanceA), q = add(second.wall.p1, second.normal, distanceB);
        return add(p, first.direction, cross({ x: q.x - p.x, y: q.y - p.y }, second.direction) / denominator);
      };
      back = intersection(first.back, second.back); front = intersection(first.front, second.front);
    }
    const cut = (end: End): CorniceCut => {
      const base = end.atStart ? -(end.run.wall.startOffset ?? 0) : end.run.length + (end.run.wall.endOffset ?? 0);
      const along = (p: Point) => dot({ x: p.x - end.run.wall.p1.x, y: p.y - end.run.wall.p1.y }, end.run.direction) - base;
      return { back: along(back), front: along(front) };
    };
    candidates.push({ a, b, cutA: cut(a), cutB: cut(b), angle });
  }
  // At multi-wall nodes join only adjacent faces, never a cornice across another run.
  candidates.sort((a, b) => a.angle - b.angle);
  const joined = new Set<End>();
  for (const { a, b, cutA, cutB } of candidates) {
    if (joined.has(a) || joined.has(b)) continue;
    const fits = (end: End, cut: CorniceCut) => {
      const run = end.run, width = run.length + (run.wall.startOffset ?? 0) + (run.wall.endOffset ?? 0);
      const start = end.atStart ? cut : run.cuts.start, finish = end.atStart ? run.cuts.end : cut;
      return (['back', 'front'] as const).every(edge => width + (finish?.[edge] ?? 0) - (start?.[edge] ?? 0) > .001);
    };
    if (!fits(a, cutA) || !fits(b, cutB)) continue;
    a.run.cuts[a.atStart ? 'start' : 'end'] = cutA; b.run.cuts[b.atStart ? 'start' : 'end'] = cutB;
    joined.add(a); joined.add(b);
  }
  cache.set(plan, layouts); return layouts;
}
