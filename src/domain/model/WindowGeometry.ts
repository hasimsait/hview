import type { Wall } from '../elements/Wall';
import { finite, positive } from './Immutable';

/** Metres; distanceAlongWall locates the opening's centre from wall p1. */
export interface WindowGeometry {
  width: number;
  height: number;
  floorHeight: number;
  distanceAlongWall: number;
}
export function validateWindowGeometry(wall: Wall, geometry: WindowGeometry): void {
  const length = wall.length;
  positive(geometry.width, 'Window width'); positive(geometry.height, 'Window height');
  finite(geometry.distanceAlongWall, 'Window position');
  if (finite(geometry.floorHeight, 'Sill height') < 0) throw new Error('Sill height cannot be negative.');
  if (geometry.distanceAlongWall - geometry.width / 2 < -.000001 || geometry.distanceAlongWall + geometry.width / 2 > length + .000001) throw new Error('The window must fit between the wall ends.');
  if (geometry.floorHeight + geometry.height > wall.height + .000001) throw new Error('The window top must be at or below the wall height.');
}
export function windowPosition(wall: Wall, distance: number) {
  const length = wall.length;
  if (length < .000001) throw new Error('A window needs a wall with a usable length.');
  return { x: wall.p1.x + (wall.p2.x - wall.p1.x) * distance / length, y: wall.p1.y + (wall.p2.y - wall.p1.y) * distance / length };
}

/** Start in the largest gap at the proposed elevation; later edits never move other openings. */
export function defaultWindowGeometry(wall: Wall): WindowGeometry {
  const length = wall.length;
  const height = Math.min(1.2, wall.height / 2), floorHeight = Math.min(.9, wall.height - height);
  const occupied = wall.openings.filter(o => o.floorHeight < floorHeight + height && o.floorHeight + o.height > floorHeight)
    .map(o => ({ start: Math.max(0, o.distanceAlongWall - o.width / 2), end: Math.min(length, o.distanceAlongWall + o.width / 2) }))
    .sort((a, b) => a.start - b.start);
  let cursor = 0, start = 0, end = 0;
  for (const interval of [...occupied, { start: length, end: length }]) {
    if (interval.start - cursor > end - start) { start = cursor; end = interval.start; }
    cursor = Math.max(cursor, interval.end);
  }
  const width = Math.min(1.2, end - start - .1);
  if (width < .1 || height < .1) throw new Error('No free space for a window at the default sill height. Move or resize an existing opening first.');
  return { width, height, floorHeight, distanceAlongWall: (start + end) / 2 };
}
