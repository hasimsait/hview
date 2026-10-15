import type { Point2D,WallData } from '../model/PlanData';
type WallGeometry = Readonly<Pick<WallData, 'id' | 'p1' | 'p2' | 'thickness' | 'isColumn'>>;

export interface JunctionOffset {
  startOffset: number; // meters to extend (+) or retract/cut short (-) at p1
  endOffset: number;   // meters to extend (+) or retract/cut short (-) at p2
}

export class WallJunctions {
  /**
   * Analyzes the geometric network of walls and computes exact corner trimming offsets
   * (butt joints) for each wall's p1 and p2 endpoints, eliminating overlapping box
   * penetration and cel-shader contour artifacting.
   */
  static resolve(walls: readonly WallGeometry[]): Map<string, JunctionOffset> {
    const offsets = new Map<string, JunctionOffset>();
    for (const w of walls) {
      offsets.set(w.id, { startOffset: 0, endOffset: 0 });
    }

    if (walls.length === 0) return offsets;

    const EPSILON = 0.08; // 8cm tolerance for shared nodes/junctions
    const handledEndpoints = new Set<string>();
    const endpointKey = (wallId: string, isP1: boolean) => `${wallId}:${isP1 ? 'p1' : 'p2'}`;

    const setOffset = (wallId: string, isP1: boolean, value: number) => {
      const entry = offsets.get(wallId) || { startOffset: 0, endOffset: 0 };
      if (isP1) {
        entry.startOffset = value;
      } else {
        entry.endOffset = value;
      }
      offsets.set(wallId, entry);
      handledEndpoints.add(endpointKey(wallId, isP1));
    };

    // Helper: compute wall unit direction from p1 to p2
    const getWallDir = (w: WallGeometry): { dx: number; dy: number; len: number } => {
      const dx = w.p2.x - w.p1.x;
      const dy = w.p2.y - w.p1.y;
      const len = Math.hypot(dx, dy);
      return len > 0.001 ? { dx: dx / len, dy: dy / len, len } : { dx: 1, dy: 0, len: 0 };
    };

    // Helper: distance between two 2D points
    const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

    // 1. Process Node Corners (L-junctions, collinear continuations, and multi-wall clusters)
    interface EndpointRef {
      wall: WallGeometry;
      point: Point2D;
      isP1: boolean;
      dirAway: { x: number; y: number };
    }

    const allEndpoints: EndpointRef[] = [];
    for (const w of walls) {
      const { dx, dy, len } = getWallDir(w);
      if (len < 0.02) continue;
      allEndpoints.push({
        wall: w,
        point: w.p1,
        isP1: true,
        dirAway: { x: dx, y: dy }, // points from p1 towards p2
      });
      allEndpoints.push({
        wall: w,
        point: w.p2,
        isP1: false,
        dirAway: { x: -dx, y: -dy }, // points from p2 towards p1
      });
    }

    // Cluster endpoints
    const visited = new Set<EndpointRef>();
    for (let i = 0; i < allEndpoints.length; i++) {
      const epA = allEndpoints[i];
      if (visited.has(epA)) continue;

      const cluster: EndpointRef[] = [epA];
      visited.add(epA);

      for (let j = i + 1; j < allEndpoints.length; j++) {
        const epB = allEndpoints[j];
        if (visited.has(epB)) continue;

        if (dist(epA.point, epB.point) <= EPSILON) {
          cluster.push(epB);
          visited.add(epB);
        }
      }

      if (cluster.length === 2) {
        // Two walls meeting at a corner or collinear joint
        const [a, b] = cluster;
        const dot = a.dirAway.x * b.dirAway.x + a.dirAway.y * b.dirAway.y;

        if (dot < -0.90) {
          // Collinear walls (e.g. wall split / continuous run): bridge any small gap flush
          const dx = b.point.x - a.point.x;
          const dy = b.point.y - a.point.y;
          const perpDist = Math.abs(dx * (-a.dirAway.y) + dy * a.dirAway.x);
          if (perpDist <= 0.05) {
            const alongGap = dx * (-a.dirAway.x) + dy * (-a.dirAway.y);
            if (alongGap > 0.005 && alongGap <= EPSILON) {
              setOffset(a.wall.id, a.isP1, alongGap * 0.5);
              setOffset(b.wall.id, b.isP1, alongGap * 0.5);
            } else {
              setOffset(a.wall.id, a.isP1, 0);
              setOffset(b.wall.id, b.isP1, 0);
            }
          } else {
            setOffset(a.wall.id, a.isP1, 0);
            setOffset(b.wall.id, b.isP1, 0);
          }
        } else {
          // L-Corner: architectural dominance hierarchy
          const lenA = Math.hypot(a.wall.p2.x - a.wall.p1.x, a.wall.p2.y - a.wall.p1.y);
          const lenB = Math.hypot(b.wall.p2.x - b.wall.p1.x, b.wall.p2.y - b.wall.p1.y);
          const tA = a.wall.thickness || 0.1;
          const tB = b.wall.thickness || 0.1;

          let aIsDominant = false;
          // Length priority: long through-walls always dominate over short stubs
          if (lenA >= 1.5 * lenB || (lenA > 1.0 && lenB < 0.5)) {
            aIsDominant = true;
          } else if (lenB >= 1.5 * lenA || (lenB > 1.0 && lenA < 0.5)) {
            aIsDominant = false;
          } else if (Math.abs(tA - tB) > 0.03) {
            aIsDominant = tA > tB;
          } else {
            aIsDominant = lenA >= lenB;
          }

          const dominant = aIsDominant ? a : b;
          const abutting = aIsDominant ? b : a;

          const tDom = dominant.wall.thickness || 0.1;
          const tAbut = abutting.wall.thickness || 0.1;
          const halfTDom = tDom / 2;

          // Dominant wall extends to cap the outer corner (+tAbut/2)
          setOffset(dominant.wall.id, dominant.isP1, tAbut * 0.5);

          // Check if abutting wall endpoint is already at dominant wall's face
          const oDir = getWallDir(dominant.wall);
          const normDist = (abutting.point.x - dominant.wall.p1.x) * (-oDir.dy) + (abutting.point.y - dominant.wall.p1.y) * oDir.dx;
          const distFromCenter = Math.abs(normDist);
          if (distFromCenter >= halfTDom - 0.01) {
            setOffset(abutting.wall.id, abutting.isP1, 0);
          } else {
            setOffset(abutting.wall.id, abutting.isP1, -(halfTDom - distFromCenter));
          }
        }
      } else if (cluster.length > 2) {
        // Multi-wall intersection: check if any pair is collinear (through-line)
        let collinearPair: [EndpointRef, EndpointRef] | null = null;
        for (let m = 0; m < cluster.length; m++) {
          for (let n = m + 1; n < cluster.length; n++) {
            const dot =
              cluster[m].dirAway.x * cluster[n].dirAway.x +
              cluster[m].dirAway.y * cluster[n].dirAway.y;
            if (dot < -0.90) {
              const dx = cluster[n].point.x - cluster[m].point.x;
              const dy = cluster[n].point.y - cluster[m].point.y;
              const perpDist = Math.abs(dx * (-cluster[m].dirAway.y) + dy * cluster[m].dirAway.x);
              if (perpDist <= 0.05) {
                collinearPair = [cluster[m], cluster[n]];
                break;
              }
            }
          }
          if (collinearPair) break;
        }

        if (collinearPair) {
          const [c1, c2] = collinearPair;
          const dx = c2.point.x - c1.point.x;
          const dy = c2.point.y - c1.point.y;
          const alongGap = dx * (-c1.dirAway.x) + dy * (-c1.dirAway.y);
          if (alongGap > 0.005 && alongGap <= EPSILON) {
            setOffset(c1.wall.id, c1.isP1, alongGap * 0.5);
            setOffset(c2.wall.id, c2.isP1, alongGap * 0.5);
          } else {
            setOffset(c1.wall.id, c1.isP1, 0);
            setOffset(c2.wall.id, c2.isP1, 0);
          }
          const tThru = Math.max(c1.wall.thickness || 0.1, c2.wall.thickness || 0.1);
          const halfTThru = tThru / 2;
          const oDir = getWallDir(c1.wall);

          for (const ep of cluster) {
            if (ep !== c1 && ep !== c2) {
              const normDist = (ep.point.x - c1.wall.p1.x) * (-oDir.dy) + (ep.point.y - c1.wall.p1.y) * oDir.dx;
              const distFromCenter = Math.abs(normDist);
              if (distFromCenter >= halfTThru - 0.01) {
                setOffset(ep.wall.id, ep.isP1, 0);
              } else {
                setOffset(ep.wall.id, ep.isP1, -(halfTThru - distFromCenter));
              }
            }
          }
        } else {
          // No collinear pair: sort by length, longest dominates
          cluster.sort((m, n) => {
            const lM = Math.hypot(m.wall.p2.x - m.wall.p1.x, m.wall.p2.y - m.wall.p1.y);
            const lN = Math.hypot(n.wall.p2.x - n.wall.p1.x, n.wall.p2.y - n.wall.p1.y);
            return lN - lM;
          });
          const dominant = cluster[0];
          setOffset(dominant.wall.id, dominant.isP1, 0);
          const tDom = dominant.wall.thickness || 0.1;
          const halfTDom = tDom / 2;
          const oDir = getWallDir(dominant.wall);

          for (let k = 1; k < cluster.length; k++) {
            const ep = cluster[k];
            const normDist = (ep.point.x - dominant.wall.p1.x) * (-oDir.dy) + (ep.point.y - dominant.wall.p1.y) * oDir.dx;
            const distFromCenter = Math.abs(normDist);
            if (distFromCenter >= halfTDom - 0.01) {
              setOffset(ep.wall.id, ep.isP1, 0);
            } else {
              setOffset(ep.wall.id, ep.isP1, -(halfTDom - distFromCenter));
            }
          }
        }
      }
    }

    // 2. Process T-Junctions (endpoint of Wall A touches the interior body of Wall B)
    for (const ep of allEndpoints) {
      // Skip if this endpoint was already resolved in Step 1
      if (handledEndpoints.has(endpointKey(ep.wall.id, ep.isP1))) continue;

      for (const other of walls) {
        if (other.id === ep.wall.id) continue;

        const odx = other.p2.x - other.p1.x;
        const ody = other.p2.y - other.p1.y;
        const oLen = Math.hypot(odx, ody);
        const otherThick = other.thickness || 0.1;

        // Skip tiny stubs as through-walls
        if (oLen < otherThick * 1.5) continue;

        const uBx = odx / oLen;
        const uBy = ody / oLen;
        const nBx = -uBy;
        const nBy = uBx;

        // Project ep onto other wall baseline
        const projAlong = (ep.point.x - other.p1.x) * uBx + (ep.point.y - other.p1.y) * uBy;
        const signedDist = (ep.point.x - other.p1.x) * nBx + (ep.point.y - other.p1.y) * nBy;
        const halfT = otherThick / 2;

        // Check if ep is along the interior span of other (with 5cm tolerance)
        if (projAlong >= -0.05 && projAlong <= oLen + 0.05) {
          if (Math.abs(signedDist) <= halfT + EPSILON) {
            // Check direction away from other wall
            const k = ep.dirAway.x * nBx + ep.dirAway.y * nBy;
            if (Math.abs(k) > 0.15) {
              const distFromCenter = Math.abs(signedDist);
              if (distFromCenter >= halfT - 0.008) {
                // Endpoint is already at or beyond the face!
                setOffset(ep.wall.id, ep.isP1, 0);
                break;
              } else {
                const targetDist = Math.sign(k) * halfT;
                const sExit = (targetDist - signedDist) / k;
                if (sExit > 0.005 && sExit < 0.25) {
                  setOffset(ep.wall.id, ep.isP1, -sExit);
                  break;
                }
              }
            }
          }
        }
      }
    }

    return offsets;
  }
}
