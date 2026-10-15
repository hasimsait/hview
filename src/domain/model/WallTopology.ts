import { immutable } from './Immutable';
import type { Point2D,WallData } from './PlanData';
type WallShape = Pick<WallData, 'id' | 'p1' | 'p2' | 'thickness' | 'isColumn'>;
type RoomShape = { readonly id: string; readonly polygon: readonly Point2D[] };
export type RoomRelationship = Pick<WallData, 'roomIds' | 'roomSideA' | 'roomSideB'>;
type DerivedWall = WallShape & RoomRelationship;

/** Computes relationships for a snapshot; never edits a wall or room. */
export class WallTopology {
  roomsFor(wall: WallShape, rooms: readonly RoomShape[]): RoomRelationship {
    const midpoint = { x: (wall.p1.x + wall.p2.x) / 2, y: (wall.p1.y + wall.p2.y) / 2 };
    const relation: DerivedWall = { id: wall.id, p1: wall.p1, p2: wall.p2, thickness: wall.thickness, isColumn: wall.isColumn, roomIds: rooms.filter(room => this.isWallOnRoomBoundary(wall, room.polygon) || wall.isColumn && this.isPointInPolygon(midpoint, room.polygon)).map(room => room.id) };
    this.assignWallRoomSides(relation, rooms);
    return immutable({ roomIds: relation.roomIds, roomSideA: relation.roomSideA, roomSideB: relation.roomSideB });
  }
  private isWallOnRoomBoundary(w: WallShape, poly: readonly Point2D[]): boolean {
    const mx = (w.p1.x + w.p2.x) / 2;
    const my = (w.p1.y + w.p2.y) / 2;
    for (let i = 0; i < poly.length; i++) {
      const pA = poly[i];
      const pB = poly[(i + 1) % poly.length];
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) continue;
      let t = ((mx - pA.x) * dx + (my - pA.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(mx - (pA.x + t * dx), my - (pA.y + t * dy));
      if (dist < 0.3) return true; // within 30cm
    }
    return false;
  }

  private isPointInPolygon(pt: Point2D, poly: readonly Point2D[]): boolean {
    return isPointInPolygon(pt, poly);
  }

  private assignWallRoomSides(wall: DerivedWall, rooms: readonly RoomShape[]): void {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;

    // Side A = +Z face in local space (points left along p1->p2: (-dy/len, dx/len))
    // Side B = -Z face in local space (points right along p1->p2: (dy/len, -dx/len))
    const nxA = -dy / len;
    const nyA = dx / len;
    const nxB = dy / len;
    const nyB = -dx / len;

    const probeDist = (wall.thickness || 0.1) / 2 + 0.15; // 15cm into the room

    const findRoomForSide = (nx: number, ny: number): string | undefined => {
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const px = wall.p1.x + dx * t + nx * probeDist;
        const py = wall.p1.y + dy * t + ny * probeDist;
        for (const room of rooms) {
          if (room.polygon && this.isPointInPolygon({ x: px, y: py }, room.polygon)) {
            return room.id;
          }
        }
      }
      return undefined;
    };

    wall.roomSideA = findRoomForSide(nxA, nyA);
    wall.roomSideB = findRoomForSide(nxB, nyB);

    // If a probe didn't resolve directly but wall borders rooms, assign remaining:
    if (wall.roomIds && wall.roomIds.length > 0) {
      if (!wall.roomSideA && wall.roomSideB) {
        wall.roomSideA = wall.roomIds.find((id) => id !== wall.roomSideB);
      } else if (!wall.roomSideB && wall.roomSideA) {
        wall.roomSideB = wall.roomIds.find((id) => id !== wall.roomSideA);
      } else if (!wall.roomSideA && !wall.roomSideB) {
        wall.roomSideA = wall.roomIds[0];
        wall.roomSideB = wall.roomIds[1];
      }
    }
  }
}

export function isPointInPolygon(pt: Point2D, poly: readonly Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y))
      && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function calculatePolygonArea(polygon: readonly Point2D[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
  }
  return Math.abs(area / 2);
}
