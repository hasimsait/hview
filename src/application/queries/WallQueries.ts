import type { Furniture } from '../../domain/elements/Furniture';
import type { Point2D } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';

export function wallSplitCandidates(document: PlanDocument | null, wallId: string): { distance: number; point: Point2D; description: string }[] {
  if (!document) return [];
  const wall = document.walls.find((w) => w.id === wallId);
  if (!wall) return [];

  const dx = wall.p2.x - wall.p1.x;
  const dy = wall.p2.y - wall.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.2) return [];

  const candidates: { distance: number; point: Point2D; description: string }[] = [];
  const dir = { x: dx / len, y: dy / len };

  // 1. Detect intersecting partition walls / T-junctions
  for (const other of document.walls) {
    if (other.id === wallId) continue;
    for (const pt of [other.p1, other.p2]) {
      const pdx = pt.x - wall.p1.x;
      const pdy = pt.y - wall.p1.y;
      const along = pdx * dir.x + pdy * dir.y;
      const normDist = Math.hypot(pdx - along * dir.x, pdy - along * dir.y);

      if (normDist <= (wall.thickness / 2 + 0.15) && along >= 0.25 && along <= len - 0.25) {
        if (!candidates.some((c) => Math.abs(c.distance - along) < 0.2)) {
          let desc = `Partition junction at ${along.toFixed(2)}m`;
          if (other.roomIds && other.roomIds.length > 0) {
            const r = document.rooms.find((rm) => other.roomIds!.includes(rm.id));
            if (r) desc = `Room transition (${r.name}) at ${along.toFixed(2)}m`;
          }
          candidates.push({
            distance: Math.round(along * 100) / 100,
            point: {
              x: wall.p1.x + along * dir.x,
              y: wall.p1.y + along * dir.y,
            },
            description: desc,
          });
        }
      }
    }
  }

  // 2. Always offer 50% midpoint
  const midDist = Math.round((len / 2) * 100) / 100;
  if (!candidates.some((c) => Math.abs(c.distance - midDist) < 0.25)) {
    candidates.push({
      distance: midDist,
      point: {
        x: wall.p1.x + 0.5 * dx,
        y: wall.p1.y + 0.5 * dy,
      },
      description: `Center Midpoint (50% — ${midDist.toFixed(2)}m)`,
    });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

export function wallRecesses(document: PlanDocument | null, wallId: string): readonly Furniture[] {
  if (!document) return [];
  return document.recessesFor(wallId).filter(recess => recess.visible !== false);
}
