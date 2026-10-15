import { PlanDocument } from '@core/types/plan';


export class LegacyPlanWriter {
  encode(plan: PlanDocument): string {
    // Clone raw plan to preserve all unmodified RemPlanner structures
    const exported = JSON.parse(JSON.stringify(plan.rawPlan || { plan: {} }));
    const planObj = exported.plan || exported;

    if (!planObj.items || Array.isArray(planObj.items)) {
      const itemsDict: Record<string, any> = {};
      if (Array.isArray(planObj.items)) {
        for (const item of planObj.items) {
          if (item && item.id) itemsDict[item.id] = item;
        }
      }
      planObj.items = itemsDict;
    }

    // 1. Update furniture items (move, resize, rotate, elevations, finishes, lighting)
    for (const item of plan.furniture) {
      const rawItem = structuredClone(item.rawItem || {});
      rawItem.id = item.id;
      rawItem.category = item.category;
      rawItem.visible = item.visible;
      rawItem.roomId = item.roomId;
      rawItem.displayName = item.displayName;

      // Convert from meters back to RemPlanner cm
      rawItem.pc = {
        x: Math.round(item.position.x * 100 * 1000) / 1000,
        y: Math.round(item.position.z * 100 * 1000) / 1000,
      };

      // Elevation / offset from floor
      rawItem.f0offset = Math.round(item.position.y * 100 * 1000) / 1000;

      // Exact 3D position vector for lossless roundtrips
      rawItem.position = {
        x: Math.round(item.position.x * 10000) / 10000,
        y: Math.round(item.position.y * 10000) / 10000,
        z: Math.round(item.position.z * 10000) / 10000,
      };

      // Rotation: angle (degrees in RemPlanner convention) and exact rotationY radians
      const deg = Math.round(((180 - (item.rotationY * 180) / Math.PI) % 360 + 360) % 360);
      rawItem.angle = deg;
      rawItem.rotationY = item.rotationY;

      // Asset key / name and custom model URL
      rawItem.name = item.rawItem?.name || item.name || item.assetKey;
      rawItem.assetKey = item.assetKey;
      if (item.customModelUrl) {
        rawItem.customModelUrl = item.customModelUrl;
      } else {
        delete rawItem.customModelUrl;
      }

      // Dimensions (Resize!): width, 2D height (depth), self_height (height in 3D), and vector
      rawItem.width = Math.round(item.dimensions.x * 100 * 1000) / 1000;
      rawItem.height = Math.round(item.dimensions.z * 100 * 1000) / 1000;
      rawItem.self_height = Math.round(item.dimensions.y * 100 * 1000) / 1000;
      rawItem.dimensions = {
        x: Math.round(item.dimensions.x * 10000) / 10000,
        y: Math.round(item.dimensions.y * 10000) / 10000,
        z: Math.round(item.dimensions.z * 10000) / 10000,
      };

      // Finishes (tile, wood, paint, etc.)
      if (item.finish) {
        rawItem.finish = item.finish;
      } else {
        delete rawItem.finish;
      }

      if (item.sectionFinishes && Object.keys(item.sectionFinishes).length > 0) {
        rawItem.sectionFinishes = item.sectionFinishes;
      } else {
        delete rawItem.sectionFinishes;
      }

      // Light fixtures config (chandeliers, spots, sconces)
      if (item.lightConfig) {
        rawItem.lightConfig = item.lightConfig;
      } else {
        delete rawItem.lightConfig;
      }

      // Shelving lids / doors
      if (item.hasLids !== undefined) {
        rawItem.hasLids = item.hasLids;
      } else {
        delete rawItem.hasLids;
      }

      planObj.items[item.id] = rawItem;
    }

    // Prune deleted furniture items
    const activeFurnitureIds = new Set(plan.furniture.map((f) => f.id));
    for (const itemId of Object.keys(planObj.items)) {
      if (!activeFurnitureIds.has(itemId)) {
        delete planObj.items[itemId];
      }
    }

    // 2. Update walls and openings (finishes, side finishes, door open angle)
    if (!planObj.walls || Array.isArray(planObj.walls)) {
      const wallsDict: Record<string, any> = {};
      if (Array.isArray(planObj.walls)) {
        for (const wall of planObj.walls) {
          if (wall && wall.id) wallsDict[wall.id] = wall;
        }
      }
      planObj.walls = wallsDict;
    }

    // Prune deleted or split walls
    const activeWallIds = new Set([...plan.walls, ...plan.columns].map((w) => w.id));
    for (const wallId of Object.keys(planObj.walls)) {
      if (!activeWallIds.has(wallId)) {
        delete planObj.walls[wallId];
      }
    }

    for (const wall of [...plan.walls, ...plan.columns.map(column => column.wallShape(plan.totalHeight))]) {
      let rawWall = structuredClone(wall.rawWall || planObj.walls[wall.id]);
      if (!rawWall) {
        rawWall = {
          id: wall.id,
          role: 'wall',
          material: wall.material,
          depth: Math.round(wall.thickness * 100),
          height: Math.round(wall.height * 100),
          p1: { x: Math.round(wall.p1.x * 100 * 10) / 10, y: Math.round(wall.p1.y * 100 * 10) / 10 },
          p2: { x: Math.round(wall.p2.x * 100 * 10) / 10, y: Math.round(wall.p2.y * 100 * 10) / 10 },
          holes: {},
        };
        planObj.walls[wall.id] = rawWall;
      }

      rawWall.id = wall.id;
      rawWall.p1 = { x: wall.p1.x * 100, y: wall.p1.y * 100 };
      rawWall.p2 = { x: wall.p2.x * 100, y: wall.p2.y * 100 };
      rawWall.depth = wall.thickness * 100;
      rawWall.height = wall.height * 100;
      if (wall.isColumn) {
        rawWall.isColumn = true;
        // Preserve the exact solid footprint rather than rounding to centimeters.
        rawWall.depth = wall.thickness * 100;
        rawWall.height = wall.height * 100;
        rawWall.p1 = { x: wall.p1.x * 100, y: wall.p1.y * 100 };
        rawWall.p2 = { x: wall.p2.x * 100, y: wall.p2.y * 100 };
      }

      // Wall finishes (all sides and individual sides A/B/edges)
      if (wall.material) rawWall.material = wall.material;
      if (wall.frameStyle) rawWall.frameStyle = wall.frameStyle; else delete rawWall.frameStyle;
      if (wall.frameColor) rawWall.frameColor = wall.frameColor; else delete rawWall.frameColor;
      if (wall.finish) rawWall.finish = wall.finish; else delete rawWall.finish;
      if (wall.finishSideA) rawWall.finishSideA = wall.finishSideA; else delete rawWall.finishSideA;
      if (wall.finishSideB) rawWall.finishSideB = wall.finishSideB; else delete rawWall.finishSideB;
      if (wall.finishEdgeStart) rawWall.finishEdgeStart = wall.finishEdgeStart; else delete rawWall.finishEdgeStart;
      if (wall.finishEdgeEnd) rawWall.finishEdgeEnd = wall.finishEdgeEnd; else delete rawWall.finishEdgeEnd;
      if (wall.finishEdgeTop) rawWall.finishEdgeTop = wall.finishEdgeTop; else delete rawWall.finishEdgeTop;
      if (wall.finishBaseboard) rawWall.finishBaseboard = wall.finishBaseboard; else delete rawWall.finishBaseboard;
      if (wall.finishEdges) rawWall.finishEdges = wall.finishEdges; else delete rawWall.finishEdges;
      if (wall.cavities && wall.cavities.length > 0) rawWall.cavities = wall.cavities; else delete rawWall.cavities;
      if (wall.startOffset !== undefined) rawWall.startOffset = wall.startOffset; else delete rawWall.startOffset;
      if (wall.endOffset !== undefined) rawWall.endOffset = wall.endOffset; else delete rawWall.endOffset;
      if (wall.color) rawWall.color = wall.color;

      rawWall.holes = {};

      for (const op of wall.openings) {
        const rawHole = structuredClone(op.rawOpening || {});
        rawHole.id = op.id;
        rawHole.type = op.type;
        rawHole.width = op.width * 100;
        rawHole.height = op.height * 100;
        rawHole.floor_height = op.floorHeight * 100;
        rawHole.pc = { x: op.position.x * 100, y: op.position.y * 100 };
        rawHole.distanceAlongWall = op.distanceAlongWall;
        rawHole.opening = `${op.swingSide || 'r'}-${op.hingeSide || 'r'}`;
        if (typeof op.openAngle === 'number') {
          rawHole.openAngle = op.openAngle;
        }
        if (op.finish) {
          rawHole.finish = op.finish;
        } else {
          delete rawHole.finish;
        }
        rawWall.holes[op.id] = rawHole;
      }

      planObj.walls[wall.id] = rawWall;
    }

    // Rebuild recognized collections from the aggregate so deleted IDs cannot return.
    const rooms: Record<string, unknown> = {};
    for (const room of plan.rooms) {
      rooms[room.id] = {
        ...structuredClone(room.rawRoom || {}), id: room.id,
        title: room.name, name: room.name, area: room.area, height: room.height * 100,
        polygon: room.polygon.map(point => ({ x: point.x * 100, y: point.y * 100 })),
        floorFinish: room.floorFinish, ceilingType: room.ceilingType, wallFinish: room.wallFinish
      };
    }
    planObj.rooms2 = rooms;
    delete planObj.rooms1;
    planObj.total_height = plan.totalHeight * 100;

    // Columns have been migrated to thick walls; do not resurrect legacy boxes.
    delete planObj.columns;
    if (exported !== planObj) delete exported.columns;

    return JSON.stringify(exported, null, 2);
  }
}
