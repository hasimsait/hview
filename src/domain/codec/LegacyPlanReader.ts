import { AssetCatalog } from '../catalog/AssetCatalog';
import {
FurnitureCategory,
FurnitureData,
OpeningData,
OpeningType,
PlanData,
Point2D,
RoomData,
WallData,
} from '../model/PlanData';
import { WallTopology } from '../model/WallTopology';
import { migrateColumnWalls } from './LegacyColumnMigration';

export class LegacyPlanReader {
  constructor(private assetRegistry = new AssetCatalog()) { }
  parse(rawInput: string | object): PlanData {
    const raw: any = typeof rawInput === 'string' ? JSON.parse(rawInput) : structuredClone(rawInput);

    // Fast-path: If input is already an in-memory or serialized PlanData
    const candidateDoc = raw.plan && Array.isArray(raw.plan.walls) ? raw.plan : raw;
    if (
      candidateDoc &&
      Array.isArray(candidateDoc.walls) &&
      Array.isArray(candidateDoc.furniture) &&
      Array.isArray(candidateDoc.rooms)
    ) {
      const wallIdSet = new Set(
        candidateDoc.walls.filter((w: any) => w && w.id).map((w: any) => w.id)
      );
      const activeWalls = candidateDoc.walls.filter((w: any) => {
        if (!w || !w.id) return false;
        if (wallIdSet.has(`${w.id}_a`) || wallIdSet.has(`${w.id}_b`)) {
          return false;
        }
        return true;
      });
      candidateDoc.walls = activeWalls;
      candidateDoc.totalHeight ||= 2.7;
      this.mapWallRooms(candidateDoc.walls, candidateDoc.rooms);
      migrateColumnWalls(candidateDoc, false);
      this.excludeTinySpaces(candidateDoc);
      this.mapWallRooms(candidateDoc.walls, candidateDoc.rooms);
      return {
        version: candidateDoc.version || 3,
        totalHeight: candidateDoc.totalHeight || 2.7,
        walls: candidateDoc.walls,
        rooms: candidateDoc.rooms,
        columns: [],
        furniture: candidateDoc.furniture,
        rawPlan: raw,
      };
    }

    const plan = raw.plan || raw;

    const totalHeight = (plan.total_height || 270) / 100; // to meters

    const walls: WallData[] = [];
    if (plan.walls && typeof plan.walls === 'object') {
      const wallEntries = Array.isArray(plan.walls)
        ? plan.walls.map((w: any, idx: number) => [w.id || `wall_${idx}`, w])
        : Object.entries<any>(plan.walls);

      for (const [key, w] of wallEntries) {
        if (w.archive === 1 || w.demount === 1) continue; // skip archived or demolished walls
        if (!w.p1 || !w.p2) continue;

        const wallId = w.id || key;
        const isMeter = w.thickness !== undefined && w.depth === undefined;
        const p1 = isMeter ? { x: w.p1.x, y: w.p1.y } : { x: w.p1.x / 100, y: w.p1.y / 100 };
        const p2 = isMeter ? { x: w.p2.x, y: w.p2.y } : { x: w.p2.x / 100, y: w.p2.y / 100 };
        const thickness = isMeter ? w.thickness : (w.depth || 10) / 100;
        const height = isMeter ? w.height : (w.height || plan.total_height || 270) / 100;
        const material = w.material || 'a_block';

        const openings: OpeningData[] = [];
        if (w.holes && typeof w.holes === 'object') {
          for (const [holeId, h] of Object.entries<any>(w.holes)) {
            const width = (h.width || 80) / 100;
            const holeHeight = (h.height || 210) / 100;
            const floorHeight = (h.floor_height || 0) / 100;
            const pc = h.pc ? { x: h.pc.x / 100, y: h.pc.y / 100 } : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            // Determine opening type
            let type: OpeningType = 'door';
            if (h.group === 'windows' || h.type?.includes('window')) {
              type = h.type === 'french_window' ? 'french_window' : 'window';
            } else if (h.type === 'door_coupe') {
              type = 'door_coupe';
            } else {
              type = 'door';
            }

            // Distance along wall from p1
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const wallLength = Math.hypot(dx, dy);
            let distanceAlongWall = wallLength / 2;
            if (wallLength > 0.001) {
              const hdx = pc.x - p1.x;
              const hdy = pc.y - p1.y;
              distanceAlongWall = (hdx * dx + hdy * dy) / wallLength;
            }

            const rawOpeningStr = (h.opening || h.position || 'r-r').toString().toLowerCase();
            const parts = rawOpeningStr.split('-');
            const swingSide: 'r' | 'l' = parts[0] === 'l' ? 'l' : 'r';
            const hingeSide: 'r' | 'l' = (parts[1] || parts[0]) === 'l' ? 'l' : 'r';

            openings.push({
              id: holeId,
              type,
              width,
              height: holeHeight,
              floorHeight,
              wallId,
              position: pc,
              distanceAlongWall,
              swingSide,
              hingeSide,
              openAngle: typeof h.openAngle === 'number' ? h.openAngle : 40,
              finish: h.finish || undefined,
              frameColor: h.frameColor || undefined,
              curtainState: h.curtainState,
              pelmetState: h.pelmetState,
              rawOpening: h,
            });
          }
        }

        // Sort openings along wall
        openings.sort((a, b) => a.distanceAlongWall - b.distanceAlongWall);

        walls.push({
          id: wallId,
          isColumn: w.isColumn || undefined,
          p1,
          p2,
          thickness,
          height,
          material,
          color: w.color || undefined,
          finish: w.finish || undefined,
          finishSideA: w.finishSideA || undefined,
          finishSideB: w.finishSideB || undefined,
          finishEdgeStart: w.finishEdgeStart || undefined,
          finishEdgeEnd: w.finishEdgeEnd || undefined,
          finishEdgeTop: w.finishEdgeTop || undefined,
          finishBaseboard: w.finishBaseboard || undefined,
          finishEdges: w.finishEdges || undefined,
          startOffset: w.startOffset,
          endOffset: w.endOffset,
          frameStyle: w.frameStyle || undefined,
          frameColor: w.frameColor || undefined,
          openings,
          roomIds: [],
          rawWall: w,
        });
      }

      // Filter out obsolete/superseded parent walls that were split into child segments
      const wallIdSet = new Set(walls.map((w) => w.id));
      const activeWalls = walls.filter((w) => {
        if (wallIdSet.has(`${w.id}_a`) || wallIdSet.has(`${w.id}_b`)) {
          return false;
        }
        return true;
      });
      walls.length = 0;
      walls.push(...activeWalls);
    }

    const rooms: RoomData[] = [];
    const roomsSource = plan.rooms2 || plan.rooms1 || {};
    if (typeof roomsSource === 'object') {
      let roomIdx = 0;
      for (const [roomId, r] of Object.entries<any>(roomsSource)) {
        let polygonPoints: any[] = [];
        if (r.zones && r.zones[0]?.polygon && r.zones[0].polygon.length >= 3) {
          polygonPoints = r.zones[0].polygon;
        } else if (r.polygon && r.polygon.length >= 3) {
          polygonPoints = r.polygon;
        } else if (r.points && r.points.length >= 3) {
          polygonPoints = r.points.filter((pt: any) => !pt.delete);
        }

        if (polygonPoints.length < 3) continue;

        const polygon = polygonPoints.map((pt: any) => ({
          x: pt.x / 100,
          y: pt.y / 100,
        }));

        const polygonArea = Math.abs(polygon.reduce((sum: number, pt: Point2D, i: number) => {
          const next = polygon[(i + 1) % polygon.length];
          return sum + pt.x * next.y - next.x * pt.y;
        }, 0)) / 2;
        const area = typeof r.area === 'number' && r.area > 0 ? r.area : polygonArea;
        let name = r.title;
        if (!name || name === 'none') {
          name = this.inferRoomName(roomId, plan.items, area, roomIdx);
        }
        const height = (r.height || plan.total_height || 270) / 100;

        rooms.push({
          id: roomId,
          name,
          area,
          polygon,
          height,
          floorFinish: r.floorFinish || undefined,
          ceilingType: r.ceilingType || undefined,
          wallFinish: r.wallFinish || undefined,
          rawRoom: r,
        });
        roomIdx++;
      }
    }

    // Resolve original boundaries before converting columns and tiny spaces.
    this.mapWallRooms(walls, rooms);

    const furniture: FurnitureData[] = [];
    if (plan.items && typeof plan.items === 'object') {
      for (const [itemId, it] of Object.entries<any>(plan.items)) {
        if (!it.pc) continue;

        const name = it.name || 'item';
        // Saved replacements override the original RemPlanner name. Legacy plans
        // without an assetKey still resolve their asset from that name.
        const assetName = it.assetKey || name;
        const assetDef = this.assetRegistry
          ? this.assetRegistry.get(this.assetRegistry.resolveLegacyName(assetName)) || this.assetRegistry.get(assetName)
          : undefined;

        const category = (assetDef?.category as FurnitureCategory) || this.mapCategory(assetName);
        const displayName = this.formatDisplayName(assetName);

        const width = (typeof it.dimensions?.x === 'number' && it.dimensions.x > 0)
          ? it.dimensions.x
          : ((it.width || (assetDef ? assetDef.defaultDimensions.x * 100 : 60)) / 100);
        let depth = (typeof it.dimensions?.z === 'number' && it.dimensions.z > 0)
          ? it.dimensions.z
          : ((it.height || (assetDef ? assetDef.defaultDimensions.z * 100 : 60)) / 100); // RemPlanner 'height' in 2D is depth in 3D floor plan
        if (
          (assetName === 'wall_recess' || assetName === 'girinti') &&
          depth < 0.05
        ) {
          depth = Math.max(0.10, (it.wallThickness as number) || (it.depth ? it.depth / 100 : 0) || 0.10);
        }
        let height = (typeof it.dimensions?.y === 'number' && it.dimensions.y > 0)
          ? it.dimensions.y
          : ((it.self_height || (assetDef ? assetDef.defaultDimensions.y * 100 : this.getDefaultHeightForCategory(category, assetName))) / 100);
        if (typeof height !== 'number' || isNaN(height) || height <= 0) {
          height = (assetDef ? assetDef.defaultDimensions.y * 100 : this.getDefaultHeightForCategory(category, assetName)) / 100;
        }

        let posX: number;
        let posY: number;
        let posZ: number;

        if (it.position && typeof it.position.x === 'number') {
          posX = it.position.x;
          posY = it.position.y;
          posZ = it.position.z;
        } else {
          const overFloorVal = typeof it.over_floor === 'object' ? it.over_floor?.value : it.over_floor;
          const elevation = ((it.f0offset !== undefined ? it.f0offset : overFloorVal) || 0) / 100;
          posX = it.pc.x / 100;
          posZ = it.pc.y / 100;
          posY = elevation;

          // In 2D floor plans, items like upper cabinets, hoods, and ceiling lights default to f0offset=0.
          // In 3D, elevate them to their realistic functional positions via metadata:
          if (posY === 0 && assetDef?.placement) {
            if (assetDef.placement.mount === 'ceiling') {
              const offset = assetDef.placement.ceilingOffset ?? (height || 0.14);
              posY = Math.max(1.8, totalHeight - offset);
            } else if (assetDef.placement.defaultElevation !== undefined) {
              posY = assetDef.placement.defaultElevation;
            }
          }
        }

        // Angle in degrees to radians. RemPlanner angle 0 faces -Y (into room with back against north wall):
        const rotationY = it.rotationY !== undefined
          ? it.rotationY
          : Math.PI - (((it.angle || 0) * Math.PI) / 180);

        furniture.push({
          id: itemId,
          name,
          displayName,
          category,
          position: { x: posX, y: posY, z: posZ },
          rotationY,
          dimensions: { x: width, y: height, z: depth },
          roomId: it.roomId ?? it.id_room,
          assetKey: it.assetKey || assetDef?.key || name,
          customModelUrl: it.customModelUrl || undefined,
          visible: typeof it.visible === 'boolean' ? it.visible : true,
          finish: it.finish || undefined,
          sectionFinishes: it.sectionFinishes || undefined,
          lightConfig: it.lightConfig || undefined,
          hasLids: it.hasLids !== undefined ? !!it.hasLids : undefined,
          shelfCount: it.shelfCount,
          recessHostId: it.recessHostId,
          rawItem: it,
        });
      }
    }

    const document: PlanData = {
      version: plan.v || 3,
      totalHeight,
      walls,
      rooms,
      columns: plan.columns || raw.columns || [],
      furniture,
      rawPlan: raw,
    };
    migrateColumnWalls(document);
    this.excludeTinySpaces(document);
    this.mapWallRooms(document.walls, document.rooms);
    return document;
  }

  private excludeTinySpaces(plan: PlanData): void {
    plan.rooms = plan.rooms.filter(room => room.area >= 0.5);
  }
  private mapWallRooms(walls: WallData[], rooms: RoomData[]): void {
    const topology = new WallTopology();
    for (const wall of walls) Object.assign(wall, topology.roomsFor(wall, rooms));
  }


  private mapCategory(name: string): FurnitureCategory {
    const n = name.toLowerCase();
    if (n.includes('bed')) return 'bed';
    if (n.includes('sofa') || n.includes('chair') || n.includes('ottoman') || n.includes('module')) return 'seating';
    if (n.includes('table') || n.includes('desk')) return 'table';
    if (n.includes('ward') || n.includes('shelving') || n.includes('closet') || n.includes('shelf') || n.includes('pencil_cabinet')) return 'storage';
    if (n.includes('kitchen') || n.includes('fridge') || n.includes('hood') || n.includes('stove')) return 'kitchen';
    if (n.includes('toilet') || n.includes('sink') || n.includes('shower') || n.includes('bath') || n.includes('towel') || n.includes('mirror')) return 'bathroom';
    if (n.includes('socket') || n.includes('shield') || n.includes('boiler') || n.includes('switch')) return 'fixture';
    if (n.includes('tv') || n.includes('cleaner') || n.includes('vacuum') || n.includes('conditioner') || n.includes('fan') || n.includes('wash') || n.includes('dryer') || n.includes('laundry')) return 'appliance';
    return 'decor';
  }

  private formatDisplayName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private getDefaultHeightForCategory(category: FurnitureCategory, name: string): number {
    const n = name.toLowerCase();
    if (n.includes('bed')) return 65;
    if (n.includes('table')) return 75;
    if (n.includes('chair')) return 85;
    if (n.includes('sofa')) return 80;
    if (n.includes('ward')) return 220;
    if (n.includes('fridge')) return 190;
    if (n.includes('toilet')) return 75;
    if (n.includes('shower')) return 215;
    if (n.includes('sink')) return 85;
    if (n.includes('dryer_over_washing')) return 170;
    if (n.includes('wash') || n.includes('dryer') || n.includes('laundry')) return 85;
    if (n.includes('ceiling_spot') || n.includes('cylinder_spot') || n.includes('surface_spot')) return 14;
    if (n.includes('shelf') || n.includes('cabinet')) return 120;
    if (n.includes('tv')) return 60;
    if (n.includes('fan')) return 23;
    if (n.includes('towel')) return 5;
    if (category === 'fixture') return 10;
    return 60; // default 60cm
  }

  private inferRoomName(roomId: string, items: any, area: number, index: number): string {
    const roomItems = Object.values<any>(items || {})
      .filter((it) => it.id_room === roomId)
      .map((it) => (it.name || '').toLowerCase());
    const itemStr = roomItems.join(' ');

    if (itemStr.includes('bed_double') || itemStr.includes('ward_double')) {
      return `Master Bedroom (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('bed_single') || itemStr.includes('bed')) {
      return `Bedroom (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('sofa') || itemStr.includes('tv')) {
      return `Living Room (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('kitchen_box') || itemStr.includes('stove') || itemStr.includes('hood') || itemStr.includes('fridge')) {
      return `Kitchen (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('shower') || itemStr.includes('bath') || itemStr.includes('wash')) {
      return `Bathroom (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('toilet') && !itemStr.includes('shower')) {
      return `Guest WC (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('table_round') || itemStr.includes('work_table')) {
      return `Dining / Office (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('shoes_closet') || itemStr.includes('shield')) {
      return `Hallway / Entry (${area.toFixed(1)} m²)`;
    }
    if (itemStr.includes('boiler')) {
      return `Utility / Laundry (${area.toFixed(1)} m²)`;
    }
    if (area < 1.0) {
      return `Storage / Niche (${area.toFixed(1)} m²)`;
    }
    return `Room ${index + 1} (${area.toFixed(1)} m²)`;
  }
}
