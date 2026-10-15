import { WallRecess, type RecessHost } from '../elements/WallRecess';
import type { FurnitureData } from '../model/PlanData';

/** Read old host aliases once; they must never compete with the live relationship. */
export function readLegacyRecess(data: FurnitureData, hosts: readonly RecessHost[]): WallRecess {
  const rawItem = { ...data.rawItem };
  const hostId = data.recessHostId ?? rawItem.wallId ?? rawItem.id_wall;
  delete rawItem.wallId;
  delete rawItem.id_wall;
  delete rawItem.wallThickness;
  delete rawItem.recessHostId;
  const recess = new WallRecess({ ...data, rawItem, recessHostId: hosts.some(host => host.id === hostId) ? hostId : undefined });
  return recess.alignedWith(hosts, true);
}
