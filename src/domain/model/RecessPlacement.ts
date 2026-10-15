import type { FurnitureData,WallData } from './PlanData';

/** Wall-mounted recess constraints belong to document edits, never mesh creation. */
export class RecessPlacement {
  align(data: FurnitureData, walls: readonly Pick<WallData, 'id' | 'p1' | 'p2' | 'thickness'>[]): FurnitureData {
    if (data.assetKey !== 'wall_recess') return data;
    let closest: { wall: Pick<WallData, 'id' | 'p1' | 'p2' | 'thickness'>; t: number; distance: number } | undefined;
    for (const wall of walls) {
      const dx = wall.p2.x - wall.p1.x, dz = wall.p2.y - wall.p1.y, length2 = dx * dx + dz * dz;
      if (length2 < 0.001) continue;
      const along = ((data.position.x - wall.p1.x) * dx + (data.position.z - wall.p1.y) * dz) / length2;
      if (along < -0.15 || along > 1.15) continue;
      const t = Math.max(0.02, Math.min(0.98, along));
      const distance = Math.hypot(data.position.x - wall.p1.x - t * dx, data.position.z - wall.p1.y - t * dz);
      if (distance > wall.thickness / 2 + 0.35 || closest && distance >= closest.distance) continue;
      closest = { wall, t, distance };
    }
    if (!closest) return data;
    const { wall, t } = closest;
    return {
      ...data, position: {
        ...data.position,
        x: wall.p1.x + t * (wall.p2.x - wall.p1.x), z: wall.p1.y + t * (wall.p2.y - wall.p1.y)
      },
      dimensions: { ...data.dimensions, z: data.dimensions.z < 0.05 ? Math.max(0.08, wall.thickness) : data.dimensions.z },
      rawItem: { ...data.rawItem, wallId: wall.id, wallThickness: wall.thickness }
    };
  }
}
