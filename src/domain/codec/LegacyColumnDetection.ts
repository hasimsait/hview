import { PlanData,WallData } from '../model/PlanData';
import { PlanVector2 } from '../model/PlanVector2';
export interface DetectedColumn {
  id: string;
  stubIds: string[];
  worldPos: { x: number; y: number; z: number };
  rotationY: number;
  width: number;
  depth: number;

}

// Import compatibility for plans whose column outlines have not been saved as boxes.
export function detectLegacyColumns(plan: PlanData): DetectedColumn[] {
  const columns: DetectedColumn[] = [];

  const getWallCorners = (w: WallData) => {
    const p1 = new PlanVector2(w.p1.x, w.p1.y);
    const p2 = new PlanVector2(w.p2.x, w.p2.y);
    const len = p1.distanceTo(p2);
    const dir = len > 0.001 ? new PlanVector2().subVectors(p2, p1).normalize() : new PlanVector2(1, 0);
    const norm = new PlanVector2(-dir.y, dir.x);
    const halfT = (w.thickness || 0.1) / 2;
    return [
      new PlanVector2().copy(p1).addScaledVector(norm, halfT),
      new PlanVector2().copy(p1).addScaledVector(norm, -halfT),
      new PlanVector2().copy(p2).addScaledVector(norm, halfT),
      new PlanVector2().copy(p2).addScaledVector(norm, -halfT),
    ];
  };

  const knownColStubIds = new Set<string>();
  for (const col of plan.columns || []) {
    if (col.stubIds && col.stubIds.length > 0) {
      for (const sid of col.stubIds) knownColStubIds.add(sid);
    } else if (col.id.startsWith('col__')) {
      const parts = col.id.replace('col__', '').split('__');
      for (const p of parts) {
        knownColStubIds.add(p);
        knownColStubIds.add(`_${p}`);
      }
    }
  }

  const isConnectedToLongWallNode = (w: WallData) => {
    for (const other of plan.walls) {
      if (other.id === w.id) continue;
      const oLen = Math.hypot(other.p2.x - other.p1.x, other.p2.y - other.p1.y);
      if (oLen <= 0.65) continue;
      const d11 = Math.hypot(w.p1.x - other.p1.x, w.p1.y - other.p1.y);
      const d12 = Math.hypot(w.p1.x - other.p2.x, w.p1.y - other.p2.y);
      const d21 = Math.hypot(w.p2.x - other.p1.x, w.p2.y - other.p1.y);
      const d22 = Math.hypot(w.p2.x - other.p2.x, w.p2.y - other.p2.y);
      if (d11 < 0.08 || d12 < 0.08 || d21 < 0.08 || d22 < 0.08) return true;
    }
    return false;
  };

  const isColumnCandidate = (w: WallData) => {
    if (w.isColumn) return false;
    // If the stub is part of an explicitly configured column in plan.columns, it is always a candidate
    if (knownColStubIds.has(w.id)) return true;

    const len = Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y);
    if (len > 0.65 || (w.openings && w.openings.length > 0)) return false;

    // Exclude real partition walls that connect to long walls (>0.65m) at a node corner/continuation
    if (isConnectedToLongWallNode(w)) return false;

    // Exclude walls that border a tiny room (< 0.5 m²) - they are chimney/vent perimeter walls
    if (w.roomIds && w.roomIds.length > 0) {
      const touchesTiny = w.roomIds.some((rid) => {
        const r = plan.rooms.find((rm) => rm.id === rid);
        return r && r.area < 0.5;
      });
      if (touchesTiny) return false;
    }
    return true;
  };

  const candidateStubs = plan.walls.filter(isColumnCandidate);
  const visited = new Set<string>();
  const rawClusters: WallData[][] = [];

  for (const sw of candidateStubs) {
    if (visited.has(sw.id)) continue;
    const cluster = [sw];
    visited.add(sw.id);
    let added = true;
    while (added) {
      added = false;
      for (const other of candidateStubs) {
        if (visited.has(other.id)) continue;
        const connects = cluster.some((cw) => {
          const d1 = Math.hypot(cw.p1.x - other.p1.x, cw.p1.y - other.p1.y);
          const d2 = Math.hypot(cw.p1.x - other.p2.x, cw.p1.y - other.p2.y);
          const d3 = Math.hypot(cw.p2.x - other.p1.x, cw.p2.y - other.p1.y);
          const d4 = Math.hypot(cw.p2.x - other.p2.x, cw.p2.y - other.p2.y);
          return Math.min(d1, d2, d3, d4) < 0.15;
        });
        if (connects) {
          cluster.push(other);
          visited.add(other.id);
          added = true;
        }
      }
    }
    rawClusters.push(cluster);
  }

  // Filter clusters: require at least 2 connected stubs, or a single stub of length <= 0.40m
  const clusters = rawClusters.filter((c) => {
    if (c.length >= 2) return true;
    const len = Math.hypot(c[0].p2.x - c[0].p1.x, c[0].p2.y - c[0].p1.y);
    return len <= 0.40;
  });

  for (const cluster of clusters) {
    // Find primary parent wall
    let parentWall: WallData | null = null;
    for (const sw of cluster) {
      const raw = sw.rawWall;
      if (raw) {
        for (const l of [raw.p1?.link, raw.p2?.link]) {
          if (l?.ct === 'edge' && l?.id) {
            parentWall = plan.walls.find((w) => w.id === l.id) || null;
            if (parentWall) break;
          }
        }
      }
      if (parentWall) break;
    }
    if (!parentWall) {
      let minDist = Infinity;
      for (const w of plan.walls) {
        if (cluster.some((sw) => sw.id === w.id)) continue;
        const d = Math.hypot(
          (w.p1.x + w.p2.x) / 2 - cluster[0].p1.x,
          (w.p1.y + w.p2.y) / 2 - cluster[0].p1.y
        );
        if (d < minDist) {
          minDist = d;
          parentWall = w;
        }
      }
    }
    if (!parentWall) continue;

    const p1 = new PlanVector2(parentWall.p1.x, parentWall.p1.y);
    const p2 = new PlanVector2(parentWall.p2.x, parentWall.p2.y);
    const dir = new PlanVector2().subVectors(p2, p1).normalize();
    const norm = new PlanVector2(-dir.y, dir.x);
    const parentThick = parentWall.thickness || 0.1;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const stubCorners: PlanVector2[] = [];
    for (const sw of cluster) {
      stubCorners.push(...getWallCorners(sw));
    }

    const alongDists = stubCorners.map((c) => new PlanVector2().subVectors(c, p1).dot(dir));
    const normDists = stubCorners.map((c) => new PlanVector2().subVectors(c, p1).dot(norm));

    const minA = Math.min(...alongDists), maxA = Math.max(...alongDists);
    const avgN = normDists.reduce((a, b) => a + b, 0) / normDists.length;

    // Pilaster column sits flush against the parent wall face: zero penetration into parent wall
    let minN: number, maxN: number;
    if (avgN >= 0) {
      minN = parentThick / 2;
      maxN = Math.max(parentThick / 2 + 0.05, ...normDists);
    } else {
      minN = Math.min(-parentThick / 2 - 0.05, ...normDists);
      maxN = -parentThick / 2;
    }

    const colLen = maxA - minA;
    const colDepth = maxN - minN;

    if (colLen < 0.10 || colDepth < 0.05 || colLen > 1.2 || colDepth > 1.2) continue;

    const centerA = (minA + maxA) / 2;
    const centerN = (minN + maxN) / 2;
    const worldX = p1.x + Math.cos(angle) * centerA - Math.sin(angle) * centerN;
    const worldZ = p1.y + Math.sin(angle) * centerA + Math.cos(angle) * centerN;

    const col: DetectedColumn = {
      id: `col_${cluster.map((w) => w.id).join('_')}`,
      stubIds: cluster.map((w) => w.id),
      worldPos: { x: worldX, y: 0, z: worldZ },
      rotationY: -angle,
      width: colLen,
      depth: colDepth,
    };
    columns.push(col);
  }

  return columns;
}
