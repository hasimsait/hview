import type { Point2D } from '../../domain/model/PlanData';
import { isPointInPolygon } from '../../domain/model/WallTopology';

interface FloorWall {
  p1: Point2D;
  p2: Point2D;
  thickness: number;
  openings: readonly { floorHeight: number; distanceAlongWall: number; width: number }[];
}

/** Extend each adjacent room's finish to the middle of a ground-level opening. */
export function floorDoorwayPolygons(room: { polygon: readonly Point2D[] }, walls: readonly FloorWall[]): Point2D[][] {
  const polygons: Point2D[][] = [];
  for (const wall of walls) {
    const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y;
    const length = Math.hypot(dx, dy);
    if (length < .02) continue;
    const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const local = (point: Point2D) => ({
      x: (point.x - wall.p1.x) * ux + (point.y - wall.p1.y) * uy,
      z: (point.x - wall.p1.x) * nx + (point.y - wall.p1.y) * ny,
    });
    const world = (x: number, z: number): Point2D => ({ x: wall.p1.x + ux * x + nx * z, y: wall.p1.y + uy * x + ny * z });
    for (const opening of wall.openings) {
      if (opening.floorHeight > .01) continue;
      const start = Math.max(0, opening.distanceAlongWall - opening.width / 2);
      const end = Math.min(length, opening.distanceAlongWall + opening.width / 2);
      for (let i = 0; i < room.polygon.length; i++) {
        const a = local(room.polygon[i]), b = local(room.polygon[(i + 1) % room.polygon.length]);
        if (Math.abs(b.x - a.x) < .001) continue;
        const side = Math.sign((a.z + b.z) / 2);
        if (!side || Math.max(Math.abs(a.z - side * wall.thickness / 2), Math.abs(b.z - side * wall.thickness / 2)) > .01) continue;
        const left = Math.max(start, Math.min(a.x, b.x)), right = Math.min(end, Math.max(a.x, b.x));
        if (right - left < .001) continue;
        const edgeZ = (x: number) => a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x);
        const middle = (left + right) / 2;
        if (!isPointInPolygon(world(middle, edgeZ(middle) + side * .005), room.polygon)) continue;
        polygons.push([world(left, 0), world(right, 0), world(right, edgeZ(right) + side * .001), world(left, edgeZ(left) + side * .001)]);
      }
    }
  }
  return polygons;
}
