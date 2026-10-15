import { ColumnData,PlanData,Point2D,WallData } from '../model/PlanData';
import { detectLegacyColumns } from './LegacyColumnDetection';

// Normalize legacy columns once on import. Afterward the wall model, editor,
// renderer and persistence own their geometry and finishes.
export function migrateColumnWalls(plan: PlanData, inferColumns = true): void {
  const stored = new Map((plan.columns || []).map(c => [c.id, c]));
  for (const detected of inferColumns ? detectLegacyColumns(plan) : []) {
    if ([...stored.values()].some(c => c.id !== detected.id && c.stubIds?.some(id => detected.stubIds.includes(id)))) continue;
    const existing = stored.get(detected.id);
    stored.set(detected.id, {
      ...detected, name: 'Column', type: 'column', ...existing,
      // Detection establishes source wall IDs, even for older saved boxes.
      stubIds: existing?.stubIds || detected.stubIds,
    });
  }
  for (const column of stored.values()) {
    // Legacy chimney boxes used placeholder dimensions; fill their actual
    // perimeter below rather than interpreting a polygon vertex as the center.
    if (column.type === 'chimney') continue;
    const sourceIds = new Set(column.stubIds || []);
    const source = plan.walls.filter(w => sourceIds.has(w.id));
    const inherited = surfaceFinishes(source, column);
    const wall = columnToWall({
      ...column,
      finishFront: column.finishFront ?? inherited.finishFront,
      finishBack: column.finishBack ?? inherited.finishBack,
      finishLeft: column.finishLeft ?? inherited.finishLeft,
      finishRight: column.finishRight ?? inherited.finishRight,
    }, plan.totalHeight);
    if (!wall) continue;
    if (source.some(w => w.openings.length)) continue;
    plan.walls = plan.walls.filter(w => !sourceIds.has(w.id));
    if (!plan.walls.some(w => w.id === wall.id)) plan.walls.push(wall);
  }
  fillTinySpaces(plan, stored);
  plan.columns = [];
}

function columnToWall(column: ColumnData, totalHeight: number): WallData | undefined {
  const { width, depth, worldPos, rotationY = 0 } = column;
  if (!worldPos || ![width, depth, worldPos.x, worldPos.z, rotationY].every(Number.isFinite)
    || width <= 0 || depth <= 0) return;
  const dx = Math.cos(rotationY) * width / 2;
  const dy = -Math.sin(rotationY) * width / 2;
  return {
    id: column.id, isColumn: true,
    p1: { x: worldPos.x - dx, y: worldPos.z - dy },
    p2: { x: worldPos.x + dx, y: worldPos.z + dy },
    thickness: depth, height: column.height || totalHeight,
    material: 'reinforced_concrete', openings: [], roomIds: [],
    finish: column.finish,
    finishSideA: column.finishFront || column.finish,
    finishSideB: column.finishBack || column.finish,
    finishEdgeStart: column.finishLeft || column.finish,
    finishEdgeEnd: column.finishRight || column.finish,
  };
}

// Tiny enclosed spaces are imported as filled wall volumes. Their legacy room
// polygons remain in rawPlan for format compatibility, never as selectable rooms.
function fillTinySpaces(plan: PlanData, stored: Map<string, ColumnData>): void {
  for (const room of plan.rooms.filter(r => r.area < 0.5)) {
    // A saved wall, or its split children, already owns any subsequent edits.
    if (plan.walls.some(w => w.id === room.id || w.id.startsWith(`${room.id}_`))) continue;
    const explicitIds = new Set<string>((room.rawRoom?.edges || []).map((e: any) => e.pid).filter(Boolean));
    let source = plan.walls.filter(w => explicitIds.has(w.id));
    if (!source.length) {
      const longestEdge = Math.max(...room.polygon.map((p, i) => {
        const q = room.polygon[(i + 1) % room.polygon.length];
        return Math.hypot(q.x - p.x, q.y - p.y);
      }));
      source = plan.walls.filter(w => w.roomIds?.includes(room.id)
        && Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y) <= longestEdge + 2 * w.thickness);
    }
    if (source.some(w => w.openings.length)) continue;
    const points: Point2D[] = source.length ? source.flatMap(w => {
      const dx = w.p2.x - w.p1.x, dy = w.p2.y - w.p1.y, len = Math.hypot(dx, dy);
      const nx = len ? -dy / len * w.thickness / 2 : 0;
      const ny = len ? dx / len * w.thickness / 2 : 0;
      return [w.p1, w.p2].flatMap(p => [{ x: p.x + nx, y: p.y + ny }, { x: p.x - nx, y: p.y - ny }]);
    }) : room.polygon;
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const previous = stored.get(room.id);
    const shape: ColumnData = {
      id: room.id, name: 'Wall', type: 'column', width: maxX - minX, depth: maxY - minY,
      worldPos: { x: (minX + maxX) / 2, y: 0, z: (minY + maxY) / 2 }, rotationY: 0,
      height: room.height || plan.totalHeight,
    };
    const inherited = surfaceFinishes(source, shape);
    const wall = columnToWall({
      ...shape,
      finish: previous?.finish ?? room.wallFinish,
      finishFront: previous?.finishFront ?? inherited.finishFront,
      finishBack: previous?.finishBack ?? inherited.finishBack,
      finishLeft: previous?.finishLeft ?? inherited.finishLeft,
      finishRight: previous?.finishRight ?? inherited.finishRight,
    }, plan.totalHeight);
    if (!wall) continue;
    const sourceIds = new Set(source.map(w => w.id));
    plan.walls = plan.walls.filter(w => !sourceIds.has(w.id));
    if (!plan.walls.some(w => w.id === wall.id)) plan.walls.push(wall);
  }
}

// Carry finishes from the exterior face of each old outline segment. Explicit
// saved column face finishes take precedence over these import defaults.
function surfaceFinishes(source: WallData[], column: ColumnData): Partial<ColumnData> {
  const finishes: Partial<ColumnData> = {};
  if (!column.worldPos) return finishes;
  const angle = column.rotationY || 0;
  for (const wall of source) {
    const dx = wall.p2.x - wall.p1.x, dy = wall.p2.y - wall.p1.y, len = Math.hypot(dx, dy);
    if (!len) continue;
    const mx = (wall.p1.x + wall.p2.x) / 2 - column.worldPos.x;
    const my = (wall.p1.y + wall.p2.y) / 2 - column.worldPos.z;
    const sideAOutward = mx * -dy + my * dx >= 0;
    const nx = (sideAOutward ? -dy : dy) / len;
    const ny = (sideAOutward ? dx : -dx) / len;
    const localX = Math.cos(angle) * nx - Math.sin(angle) * ny;
    const localZ = Math.sin(angle) * nx + Math.cos(angle) * ny;
    const field = Math.abs(localX) > Math.abs(localZ)
      ? (localX > 0 ? 'finishRight' : 'finishLeft')
      : (localZ > 0 ? 'finishFront' : 'finishBack');
    const finish = (sideAOutward ? wall.finishSideA : wall.finishSideB) || wall.finish;
    if (finish) finishes[field] = finish;
  }
  return finishes;
}
