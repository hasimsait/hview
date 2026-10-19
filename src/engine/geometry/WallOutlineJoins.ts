import * as THREE from 'three';
import type { WallEntity as Wall } from '../../core/types/plan';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';

type Span = [number, number];
interface OutlineJoin {
  x: number;
  A: boolean;
  B: boolean;
  top: boolean;
  bottom: boolean;
  solid: Span[];
}
const tolerance = .002;
function subtract(ranges: Span[], start: number, end: number): Span[] {
  return ranges.flatMap(([a, b]): Span[] => {
    if (end <= a || start >= b) return [[a, b]];
    const result: Span[] = [];
    if (start > a) result.push([a, start]);
    if (end < b) result.push([end, b]);
    return result;
  });
}
function finishKey(finish: SurfaceFinishConfig | undefined, wall: Wall): string {
  const value = finish ?? (wall.color ? { type: 'paint', color: wall.color } : { material: wall.material });
  return JSON.stringify(Object.entries(value).filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, key.toLowerCase().includes('color') && typeof value === 'string' ? value.toLowerCase() : value])
    .sort(([a], [b]) => String(a).localeCompare(String(b))));
}
function face(wall: Wall, side: 'A' | 'B'): string { return finishKey((side === 'A' ? wall.finishSideA : wall.finishSideB) ?? wall.finish, wall); }
function edge(wall: Wall, top: boolean): string {
  return finishKey((top ? wall.finishEdgeTop : undefined) ?? wall.finishEdges ?? wall.finish ?? wall.finishSideA ?? wall.finishSideB, wall);
}

/** Coplanar continuations are rendering context; the saved walls remain separate. */
export function wallOutlineJoins(wall: Wall, neighbors: readonly Wall[], cutawayHeight?: number): OutlineJoin[] {
  const length = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
  if (length < .02) return [];
  const ux = (wall.p2.x - wall.p1.x) / length, uy = (wall.p2.y - wall.p1.y) / length;
  const height = Math.min(wall.height, cutawayHeight ?? Infinity), result: OutlineJoin[] = [];
  for (const end of [false, true]) {
    const x = end ? length + (wall.endOffset ?? 0) : -(wall.startOffset ?? 0);
    const px = wall.p1.x + ux * x, py = wall.p1.y + uy * x;
    for (const other of neighbors) {
      if (other.id === wall.id || Math.abs(other.thickness - wall.thickness) > tolerance || Math.abs(Math.min(other.height, cutawayHeight ?? Infinity) - height) > tolerance) continue;
      const otherLength = Math.hypot(other.p2.x - other.p1.x, other.p2.y - other.p1.y);
      if (otherLength < .02) continue;
      const vx = (other.p2.x - other.p1.x) / otherLength, vy = (other.p2.y - other.p1.y) / otherLength;
      const dot = ux * vx + uy * vy;
      if (Math.abs(ux * vy - uy * vx) > .001) continue;
      for (const otherEnd of [false, true]) {
        if (dot * (end ? -1 : 1) * (otherEnd ? -1 : 1) > -.999) continue;
        const ox = otherEnd ? otherLength + (other.endOffset ?? 0) : -(other.startOffset ?? 0);
        if (Math.hypot(other.p1.x + vx * ox - px, other.p1.y + vy * ox - py) > tolerance) continue;
        let solid: Span[] = [[0, height]];
        for (const opening of other.openings) {
          if (opening.distanceAlongWall - opening.width / 2 > ox + tolerance || opening.distanceAlongWall + opening.width / 2 < ox - tolerance) continue;
          const bottom = Math.max(0, opening.floorHeight), top = Math.min(height, opening.floorHeight + opening.height);
          solid = subtract(solid, bottom, top);
        }
        result.push({ x, A: face(wall, 'A') === face(other, dot > 0 ? 'A' : 'B'), B: face(wall, 'B') === face(other, dot > 0 ? 'B' : 'A'), top: edge(wall, true) === edge(other, true), bottom: edge(wall, false) === edge(other, false), solid });
      }
    }
  }
  return result;
}

export function trimWallOutlineJoins(root: THREE.Group, wall: Wall, neighbors: readonly Wall[], cutawayHeight?: number): void {
  const joins = wallOutlineJoins(wall, neighbors, cutawayHeight);
  if (!joins.length) return;
  const length = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
  const ux = (wall.p2.x - wall.p1.x) / length, uy = (wall.p2.y - wall.p1.y) / length;
  const height = Math.min(wall.height, cutawayHeight ?? Infinity);
  root.updateMatrixWorld(true);
  root.traverse(line => {
    if (!(line instanceof THREE.LineSegments) || line.name !== 'wallOutline') return;
    const positions = line.geometry.attributes.position, result: number[] = [];
    for (let i = 0; i < positions.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i), b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const aw = a.clone().applyMatrix4(line.matrixWorld), bw = b.clone().applyMatrix4(line.matrixWorld);
      const ax = (aw.x - wall.p1.x) * ux + (aw.z - wall.p1.y) * uy, bx = (bw.x - wall.p1.x) * ux + (bw.z - wall.p1.y) * uy;
      const matches = joins.filter(join => Math.abs(ax - join.x) < tolerance && Math.abs(bx - join.x) < tolerance);
      let remaining: Span[] = [[0, 1]];
      for (const join of matches) {
        if (Math.abs(aw.y - bw.y) < tolerance) {
          const atTop = Math.abs(aw.y - height) < tolerance, atBottom = Math.abs(aw.y) < tolerance;
          if ((atTop && join.top || atBottom && join.bottom) && join.solid.some(([lo, hi]) => aw.y >= lo - tolerance && aw.y <= hi + tolerance)) remaining = [];
        } else {
          const z = -(aw.x - wall.p1.x) * uy + (aw.z - wall.p1.y) * ux;
          if (!(z > 0 ? join.A : join.B)) continue;
          for (const [lo, hi] of join.solid) {
            const t1 = (lo - aw.y) / (bw.y - aw.y), t2 = (hi - aw.y) / (bw.y - aw.y);
            const start = Math.min(t1, t2), end = Math.max(t1, t2);
            remaining = subtract(remaining, start, end);
          }
        }
      }
      for (const [start, end] of remaining) {
        const first = a.clone().lerp(b, start), last = a.clone().lerp(b, end);
        result.push(first.x, first.y, first.z, last.x, last.y, last.z);
      }
    }
    if (result.length === positions.count * 3 && result.every((value, index) => value === positions.array[index])) return;
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(result, 3));
  });
}
