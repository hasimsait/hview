import type { RoomData } from './PlanData';

type CeilingRoom = Pick<RoomData, 'name' | 'height' | 'ceilingType' | 'ceilingHeight'>;

export function roomCeilingType(room: CeilingRoom): NonNullable<RoomData['ceilingType']> {
  return room.ceilingType ?? (/bath|toilet|wc|san|shower/i.test(room.name) ? 'clip_in' : 'gypsum');
}

export function roomCeilingMaximum(room: CeilingRoom, sharedMaximum: number): number {
  return Math.min(room.height, sharedMaximum);
}

export function roomCeilingHeight(room: CeilingRoom, sharedMaximum: number): number {
  const maximum = roomCeilingMaximum(room, sharedMaximum);
  return Math.min(maximum, room.ceilingHeight ?? Math.max(.001, maximum - (roomCeilingType(room) === 'clip_in' ? .15 : 0)));
}
