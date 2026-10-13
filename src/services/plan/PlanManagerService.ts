import { PlanDocument, FurnitureEntity, OpeningEntity, WallEntity, SurfaceFinishConfig, Point2D, RoomEntity, LightFixtureConfig, WallFrameStyle, CavityModifier } from '@core/types/plan';
import { WallJunctionService } from '../rendering/WallJunctionService';
import {
  IPlanManagerService,
  IPlanParserService,
  IPlanExportService,
  PlanChangeListener,
  PlanLoadedListener,
  WallsChangedListener,
  FurnitureUpdatedListener,
  FurnitureDeletedListener,
  SelectionChangeListener,
  OpeningUpdatedListener,
  OpeningSelectionChangeListener,
  WallUpdatedListener,
  WallSelectionChangeListener,
  RoomSelectionChangeListener,
  RoomUpdatedListener,
  WallSide,
  IPlanPersistenceService,
  PlanSaveStatus,
  PlanSaveStatusListener,
} from '@core/types/services';

export class PlanManagerService implements IPlanManagerService {
  private currentPlan: PlanDocument | null = null;
  private selectedFurniture: FurnitureEntity | null = null;
  private selectedFurnitureSection: string = 'all';
  private selectedOpening: { opening: OpeningEntity; wall: WallEntity } | null = null;
  private selectedWall: WallEntity | null = null;
  private selectedWallSide: WallSide = 'A';
  private selectedRoom: RoomEntity | null = null;
  private planChangeListeners = new Set<PlanChangeListener>();
  private planLoadedListeners = new Set<PlanLoadedListener>();
  private wallsChangedListeners = new Set<WallsChangedListener>();
  private furnitureUpdatedListeners = new Set<FurnitureUpdatedListener>();
  private furnitureDeletedListeners = new Set<FurnitureDeletedListener>();
  private selectionChangeListeners = new Set<SelectionChangeListener>();
  private openingUpdatedListeners = new Set<OpeningUpdatedListener>();
  private openingSelectionChangeListeners = new Set<OpeningSelectionChangeListener>();
  private wallUpdatedListeners = new Set<WallUpdatedListener>();
  private wallSelectionChangeListeners = new Set<WallSelectionChangeListener>();
  private roomSelectionChangeListeners = new Set<RoomSelectionChangeListener>();
  private roomUpdatedListeners = new Set<RoomUpdatedListener>();
  private isDirty = false;
  private autoSaveTimer: any = null;

  constructor(
    private parser: IPlanParserService,
    private exporter: IPlanExportService,
    private persistence?: IPlanPersistenceService
  ) {}

  getPlan(): PlanDocument | null {
    return this.currentPlan;
  }

  loadPlan(rawJson: string | object): PlanDocument {
    this.currentPlan = this.parser.parse(rawJson);
    this.selectedFurniture = null;
    this.selectedOpening = null;
    this.selectedWall = null;
    this.selectedRoom = null;
    this.isDirty = false;
    this.notifyPlanLoaded(this.currentPlan);
    this.notifyPlanChange();
    this.notifySelectionChange();
    this.notifyOpeningSelectionChange();
    this.notifyWallSelectionChange();
    this.notifyRoomSelectionChange();
    return this.currentPlan;
  }

  async loadPlanFromUrl(url: string): Promise<PlanDocument> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch plan from ${url}: ${res.statusText}`);
    }
    const json = await res.json();
    return this.loadPlan(json);
  }

  addFurniture(entity: Omit<FurnitureEntity, 'id'> & { id?: string }): FurnitureEntity {
    if (!this.currentPlan) {
      throw new Error('No plan loaded to add furniture to');
    }
    const id = entity.id || `furniture_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEntity: FurnitureEntity = {
      ...entity,
      id,
    };
    this.currentPlan.furniture.push(newEntity);
    this.isDirty = true;

    this.notifyFurnitureUpdated(newEntity);
    this.setSelectedFurniture(newEntity);
    this.notifyPlanChange();
    return newEntity;
  }

  updateFurniture(id: string, updates: Partial<FurnitureEntity>): void {
    if (!this.currentPlan) return;
    const idx = this.currentPlan.furniture.findIndex((f) => f.id === id);
    if (idx === -1) return;

    this.currentPlan.furniture[idx] = {
      ...this.currentPlan.furniture[idx],
      ...updates,
    };
    this.isDirty = true;

    if (this.selectedFurniture && this.selectedFurniture.id === id) {
      this.selectedFurniture = this.currentPlan.furniture[idx];
      this.notifySelectionChange();
    }
    this.notifyFurnitureUpdated(this.currentPlan.furniture[idx]);
    this.notifyPlanChange();
  }

  replaceFurnitureAsset(id: string, newAssetKey: string, customModelUrl?: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.furniture.find((f) => f.id === id);
    if (!item) return;

    this.updateFurniture(id, {
      assetKey: newAssetKey,
      displayName: newAssetKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      customModelUrl: customModelUrl,
    });
  }

  deleteFurniture(id: string): void {
    if (!this.currentPlan) return;
    this.currentPlan.furniture = this.currentPlan.furniture.filter((f) => f.id !== id);
    this.isDirty = true;
    if (this.selectedFurniture?.id === id) {
      this.selectedFurniture = null;
      this.notifySelectionChange();
    }
    this.notifyFurnitureDeleted(id);
    this.notifyPlanChange();
  }

  updateRoomName(roomId: string, newName: string): void {
    if (!this.currentPlan) return;
    const room = this.currentPlan.rooms.find((r) => r.id === roomId);
    if (room) {
      room.name = newName;
      if (room.rawRoom) {
        room.rawRoom.title = newName;
        room.rawRoom.name = newName;
      }
      this.isDirty = true;
      this.notifyPlanChange();
    }
  }

  getSelectedFurniture(): FurnitureEntity | null {
    return this.selectedFurniture;
  }

  getSelectedFurnitureSection(): string {
    return this.selectedFurnitureSection;
  }

  setSelectedFurniture(item: FurnitureEntity | null, section: string = 'all'): void {
    if (item && this.currentPlan) {
      const canonical = this.currentPlan.furniture.find((f) => f.id === item.id);
      this.selectedFurniture = canonical || item;
    } else {
      this.selectedFurniture = item;
    }
    this.selectedFurnitureSection = section;
    if (item) {
      this.selectedOpening = null;
      this.selectedWall = null;
      this.selectedRoom = null;
      this.notifyOpeningSelectionChange();
      this.notifyWallSelectionChange();
      this.notifyRoomSelectionChange();
    }
    this.notifySelectionChange();
  }

  flipDoor(openingId: string, type: 'swing' | 'hinge'): void {
    if (!this.currentPlan) return;

    for (const wall of this.currentPlan.walls) {
      const op = wall.openings.find((o) => o.id === openingId);
      if (op) {
        if (!op.swingSide) op.swingSide = 'r';
        if (!op.hingeSide) op.hingeSide = 'r';

        if (type === 'swing') {
          op.swingSide = op.swingSide === 'r' ? 'l' : 'r';
          op.swingFlipped = !op.swingFlipped;
        } else {
          op.hingeSide = op.hingeSide === 'r' ? 'l' : 'r';
          op.hingeFlipped = !op.hingeFlipped;
        }

        // Sync rawOpening.opening for export
        if (op.rawOpening) {
          op.rawOpening.opening = `${op.swingSide}-${op.hingeSide}`;
        }

        this.isDirty = true;

        // 1. Rebuild the 3D mesh first
        this.notifyOpeningUpdated(op, wall);

        // 2. Update selection and notify listeners
        if (this.selectedOpening && this.selectedOpening.opening.id === openingId) {
          this.selectedOpening = { opening: op, wall };
          this.notifyOpeningSelectionChange();
        }

        this.notifyPlanChange();
        return;
      }
    }
  }

  setDoorAngle(openingId: string, angleDeg: number): void {
    if (!this.currentPlan) return;
    const clampedAngle = Math.max(0, Math.min(180, Math.round(angleDeg)));
    for (const wall of this.currentPlan.walls) {
      const op = wall.openings.find((o) => o.id === openingId);
      if (op) {
        op.openAngle = clampedAngle;
        this.isDirty = true;

        if (this.selectedOpening && this.selectedOpening.opening.id === openingId) {
          this.selectedOpening = { opening: op, wall };
          this.notifyOpeningSelectionChange();
        }

        this.notifyOpeningUpdated(op, wall);
        this.notifyPlanChange();
        return;
      }
    }
  }

  rotateDoor(openingId: string, degDelta: number): void {
    if (!this.currentPlan) return;
    for (const wall of this.currentPlan.walls) {
      const op = wall.openings.find((o) => o.id === openingId);
      if (op) {
        if (degDelta === 180) {
          this.flipDoor(openingId, 'swing');
          return;
        }
        const current = op.openAngle !== undefined ? op.openAngle : 40;
        let next = current + degDelta;
        if (next < 0) next = 0;
        if (next > 180) next = 180;
        this.setDoorAngle(openingId, next);
        return;
      }
    }
  }

  getSelectedOpening(): { opening: OpeningEntity; wall: WallEntity } | null {
    return this.selectedOpening;
  }

  setSelectedOpening(selected: { opening: OpeningEntity; wall: WallEntity } | null): void {
    this.selectedOpening = selected;
    if (selected) {
      this.selectedFurniture = null;
      this.selectedWall = null;
      this.selectedRoom = null;
      this.notifySelectionChange();
      this.notifyWallSelectionChange();
      this.notifyRoomSelectionChange();
    }
    this.notifyOpeningSelectionChange();
  }

  getAllDoors(): { opening: OpeningEntity; wall: WallEntity }[] {
    if (!this.currentPlan) return [];
    const doors: { opening: OpeningEntity; wall: WallEntity }[] = [];
    for (const wall of this.currentPlan.walls) {
      for (const op of wall.openings) {
        if (op.type === 'door' || op.type === 'door_coupe') {
          doors.push({ opening: op, wall });
        }
      }
    }
    return doors;
  }

  getSelectedWall(): WallEntity | null {
    return this.selectedWall;
  }

  getSelectedWallSide(): WallSide {
    return this.selectedWallSide;
  }

  setSelectedWall(wall: WallEntity | null, side?: WallSide): void {
    this.selectedWall = wall;
    if (side) {
      this.selectedWallSide = side;
    }
    if (wall) {
      this.selectedFurniture = null;
      this.selectedOpening = null;
      this.selectedRoom = null;
      this.notifySelectionChange();
      this.notifyOpeningSelectionChange();
      this.notifyRoomSelectionChange();
    }
    this.notifyWallSelectionChange();
  }

  getSelectedRoom(): RoomEntity | null {
    return this.selectedRoom;
  }

  setSelectedRoom(room: RoomEntity | null): void {
    if (this.selectedRoom?.id === room?.id && !!this.selectedRoom === !!room) {
      return;
    }
    this.selectedRoom = room;
    if (room) {
      this.selectedFurniture = null;
      this.selectedOpening = null;
      this.selectedWall = null;
      this.notifySelectionChange();
      this.notifyOpeningSelectionChange();
      this.notifyWallSelectionChange();
    }
    this.notifyRoomSelectionChange();
  }

  setRoomFloorFinish(roomId: string, finish?: SurfaceFinishConfig): void {
    if (!this.currentPlan) return;
    const room = this.currentPlan.rooms.find((r) => r.id === roomId);
    if (!room) return;

    if (finish) {
      room.floorFinish = { ...finish };
    } else {
      delete room.floorFinish;
    }

    this.isDirty = true;
    this.notifyRoomUpdated(room);
    if (this.selectedRoom?.id === roomId) {
      this.selectedRoom = { ...room };
      this.notifyRoomSelectionChange();
    }
    this.notifyPlanChange();
  }

  private isWallInvisible(wall: WallEntity): boolean {
    if (!this.currentPlan) return false;
    // Only completely degenerate zero-length walls (< 0.02m) are invisible
    const len = Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
    if (len < 0.02) {
      return true;
    }
    return false;
  }

  setWallFinish(wallId: string, finish: SurfaceFinishConfig, side: WallSide = 'both'): void {
    if (!this.currentPlan) return;
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return;

    if (side === 'A') {
      wall.finishSideA = { ...finish };
      if (wall.finish && !wall.finishSideB) {
        wall.finishSideB = { ...wall.finish };
      }
      delete wall.finish;
    } else if (side === 'B') {
      wall.finishSideB = { ...finish };
      if (wall.finish && !wall.finishSideA) {
        wall.finishSideA = { ...wall.finish };
      }
      delete wall.finish;
    } else if (side === 'edge_start') {
      wall.finishEdgeStart = { ...finish };
    } else if (side === 'edge_end') {
      wall.finishEdgeEnd = { ...finish };
    } else if (side === 'edge_top') {
      wall.finishEdgeTop = { ...finish };
    } else if (side === 'baseboard' || side === 'edge_bottom') {
      wall.finishBaseboard = { ...finish };
    } else if (side === 'edges') {
      wall.finishEdges = { ...finish };
      wall.finishEdgeStart = { ...finish };
      wall.finishEdgeEnd = { ...finish };
      wall.finishEdgeTop = { ...finish };
    } else {
      wall.finishSideA = { ...finish };
      wall.finishSideB = { ...finish };
      wall.finishEdges = { ...finish };
      wall.finishEdgeStart = { ...finish };
      wall.finishEdgeEnd = { ...finish };
      wall.finishEdgeTop = { ...finish };
      wall.finish = { ...finish };
    }
    this.isDirty = true;
    if (this.selectedWall && this.selectedWall.id === wallId) {
      this.selectedWall = { ...wall };
      this.notifyWallSelectionChange();
    }
    this.notifyWallUpdated(wall);
    this.notifyPlanChange();
  }

  setWallFrame(
    wallId: string,
    frameStyle: WallFrameStyle,
    frameColor: string = '#18181b'
  ): void {
    if (!this.currentPlan) return;
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return;

    wall.frameStyle = frameStyle;
    wall.frameColor = frameColor;
    this.isDirty = true;

    if (this.selectedWall && this.selectedWall.id === wallId) {
      this.selectedWall = { ...wall };
    }
    this.notifyWallUpdated(wall);
    this.notifyPlanChange();
  }

  setWallMaterial(wallId: string, material: string): void {
    if (!this.currentPlan) return;
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return;

    wall.material = material;
    this.isDirty = true;

    if (this.selectedWall && this.selectedWall.id === wallId) {
      this.selectedWall = { ...wall };
    }
    this.notifyWallUpdated(wall);
    this.notifyPlanChange();
  }

  setRoomWallFinish(roomId: string, finish: SurfaceFinishConfig): void {
    if (!this.currentPlan) return;
    for (const wall of this.currentPlan.walls) {
      if (wall.roomIds && wall.roomIds.includes(roomId)) {
        if (this.isWallInvisible(wall)) continue;

        let modified = false;
        if (wall.roomSideA === roomId) {
          wall.finishSideA = { ...finish };
          wall.finishEdges = { ...finish };
          modified = true;
        }
        if (wall.roomSideB === roomId) {
          wall.finishSideB = { ...finish };
          wall.finishEdges = { ...finish };
          modified = true;
        }
        if (!modified) {
          if (!wall.roomSideA && !wall.roomSideB) {
            wall.finishSideA = { ...finish };
            wall.finishSideB = { ...finish };
            wall.finishEdges = { ...finish };
            wall.finish = { ...finish };
            modified = true;
          } else if (!wall.roomSideA) {
            wall.finishSideA = { ...finish };
            wall.finishEdges = { ...finish };
            modified = true;
          } else if (!wall.roomSideB) {
            wall.finishSideB = { ...finish };
            wall.finishEdges = { ...finish };
            modified = true;
          }
        }

        if (modified) {
          this.notifyWallUpdated(wall);
        }
      }
    }

    const rm = this.currentPlan.rooms.find((r) => r.id === roomId);
    if (rm) {
      rm.wallFinish = { ...finish };
    }

    this.isDirty = true;
    this.notifyPlanChange();
  }

  findWallSplitCandidates(wallId: string): { distance: number; point: Point2D; description: string }[] {
    if (!this.currentPlan) return [];
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return [];

    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.2) return [];

    const candidates: { distance: number; point: Point2D; description: string }[] = [];
    const dir = { x: dx / len, y: dy / len };

    // 1. Detect intersecting partition walls / T-junctions
    for (const other of this.currentPlan.walls) {
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
              const r = this.currentPlan.rooms.find((rm) => other.roomIds!.includes(rm.id));
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

  splitWall(wallId: string, splitDistance: number): { wall1: WallEntity; wall2: WallEntity } | null {
    if (!this.currentPlan) return null;
    const wallIdx = this.currentPlan.walls.findIndex((w) => w.id === wallId);
    if (wallIdx === -1) return null;

    const wall = this.currentPlan.walls[wallIdx];
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.2 || splitDistance <= 0.05 || splitDistance >= len - 0.05) {
      return null;
    }

    const t = splitDistance / len;
    const splitPt: Point2D = {
      x: wall.p1.x + t * dx,
      y: wall.p1.y + t * dy,
    };

    const wall1Id = `${wall.id}_a`;
    const wall2Id = `${wall.id}_b`;

    // Partition openings
    const openings1: OpeningEntity[] = [];
    const openings2: OpeningEntity[] = [];

    for (const op of wall.openings || []) {
      if (op.distanceAlongWall <= splitDistance) {
        openings1.push({
          ...op,
          wallId: wall1Id,
        });
      } else {
        openings2.push({
          ...op,
          wallId: wall2Id,
          distanceAlongWall: op.distanceAlongWall - splitDistance,
        });
      }
    }

    // Partition cavities (wall-pinned recesses)
    const cavities1: CavityModifier[] = [];
    const cavities2: CavityModifier[] = [];

    for (const cav of wall.cavities || []) {
      if (cav.distanceAlongWall <= splitDistance) {
        cavities1.push({ ...cav });
      } else {
        cavities2.push({
          ...cav,
          distanceAlongWall: cav.distanceAlongWall - splitDistance,
        });
      }
    }

    const wall1: WallEntity = {
      ...wall,
      id: wall1Id,
      p1: { ...wall.p1 },
      p2: splitPt,
      openings: openings1,
      cavities: cavities1,
      roomIds: [],
    };

    const wall2: WallEntity = {
      ...wall,
      id: wall2Id,
      p1: splitPt,
      p2: { ...wall.p2 },
      openings: openings2,
      cavities: cavities2,
      roomIds: [],
    };

    if (this.currentPlan.rooms) {
      this.mapWallToRooms(wall1, this.currentPlan.rooms);
      this.mapWallToRooms(wall2, this.currentPlan.rooms);
    }

    this.currentPlan.walls.splice(wallIdx, 1, wall1, wall2);

    // Recompute non-penetrating wall corner offsets
    WallJunctionService.computeJunctionOffsets(this.currentPlan.walls);

    if (this.selectedWall?.id === wallId) {
      this.selectedWall = wall1;
    }

    this.isDirty = true;
    this.notifyWallsChanged(this.currentPlan);
    this.notifyWallSelectionChange();
    this.notifyPlanChange();

    return { wall1, wall2 };
  }

  getWallRecesses(wallId: string): FurnitureEntity[] {
    if (!this.currentPlan) return [];
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return [];

    const p1x = wall.p1.x;
    const p1z = wall.p1.y;
    const p2x = wall.p2.x;
    const p2z = wall.p2.y;
    const dx = p2x - p1x;
    const dz = p2z - p1z;
    const lenSq = dx * dx + dz * dz;
    const maxDist = (wall.thickness || 0.1) / 2 + 0.35;

    return this.currentPlan.furniture.filter((f) => {
      if (f.visible === false) return false;
      if (f.assetKey !== 'wall_recess' && f.assetKey !== 'recess' && f.assetKey !== 'girinti') return false;
      const t = ((f.position.x - p1x) * dx + (f.position.z - p1z) * dz) / lenSq;
      if (t < -0.15 || t > 1.15) return false;
      const projX = p1x + t * dx;
      const projZ = p1z + t * dz;
      return Math.hypot(f.position.x - projX, f.position.z - projZ) <= maxDist;
    });
  }

  addWallRecess(
    wallId: string,
    options?: {
      width?: number;
      height?: number;
      elevation?: number;
      depth?: number;
      distanceAlongWall?: number;
    }
  ): FurnitureEntity | null {
    if (!this.currentPlan) return null;
    const wall = this.currentPlan.walls.find((w) => w.id === wallId);
    if (!wall) return null;

    const dx = wall.p2.x - wall.p1.x;
    const dz = wall.p2.y - wall.p1.y;
    const wallLen = Math.hypot(dx, dz);
    if (wallLen < 0.2) return null;

    const width = options?.width ?? 1.20;
    const height = options?.height ?? 1.70;
    const elevation = options?.elevation ?? 0.70;
    const depth = options?.depth ?? Math.max(0.1, wall.thickness || 0.12);

    let dist = options?.distanceAlongWall;
    if (dist === undefined) {
      if (wallLen >= width + 0.45) {
        dist = 0.25 + width / 2;
      } else {
        dist = wallLen / 2;
      }
    }

    const t = Math.max(0.05, Math.min(0.95, dist / wallLen));
    const posX = wall.p1.x + t * dx;
    const posZ = wall.p1.y + t * dz;
    const angle = Math.atan2(dz, dx);
    const rotationY = -angle;

    const roomId = wall.roomSideA || wall.roomSideB || wall.roomIds?.[0];

    const entity = this.addFurniture({
      name: 'wall_recess',
      displayName: 'Wall Recess (Niche)',
      category: 'fixture',
      position: { x: posX, y: elevation, z: posZ },
      rotationY,
      dimensions: { x: width, y: height, z: depth },
      assetKey: 'wall_recess',
      roomId,
      visible: true,
      rawItem: { wallThickness: wall.thickness, wallId: wall.id },
      sectionFinishes: {
        recess_wall: wall.finishSideA || wall.finish || {
          type: 'tile',
          variant: 'canakkale_wabi_maburu_bej_34x111',
          color: '#cec8ba',
          roughness: 0.22,
        },
        girinti_wall: wall.finishSideA || wall.finish || {
          type: 'tile',
          variant: 'canakkale_wabi_maburu_bej_34x111',
          color: '#cec8ba',
          roughness: 0.22,
        },
        sides: {
          type: 'tile',
          variant: 'canakkale_diadem_bej_59x59',
          color: '#d3c7b8',
          roughness: 0.76,
        },
        corners: {
          type: 'tile',
          variant: 'canakkale_diadem_bej_59x59',
          color: '#d3c7b8',
          roughness: 0.76,
        },
        back: wall.finishSideB || wall.finish || {
          type: 'plaster',
          variant: 'smooth',
          color: '#efede8',
          roughness: 0.85,
        },
      },
    });

    return entity;
  }

  setOpeningFinish(openingId: string, finish: SurfaceFinishConfig): void {
    if (!this.currentPlan) return;
    for (const wall of this.currentPlan.walls) {
      const op = wall.openings.find((o) => o.id === openingId);
      if (op) {
        op.finish = { ...finish };
        this.isDirty = true;
        this.notifyOpeningUpdated(op, wall);
        this.notifyPlanChange();
        return;
      }
    }
  }

  setFurnitureFinish(id: string, finish?: SurfaceFinishConfig): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.furniture.find((f) => f.id === id);
    if (!item) return;
    if (finish) {
      item.finish = { ...finish };
      delete item.sectionFinishes;
    } else {
      delete item.finish;
    }
    this.isDirty = true;
    this.notifyFurnitureUpdated(item);
    if (this.selectedFurniture?.id === id) {
      this.selectedFurniture = { ...item };
      this.notifySelectionChange();
    }
    this.notifyPlanChange();
  }

  setFurnitureSectionFinish(id: string, section: string, finish: SurfaceFinishConfig | undefined): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.furniture.find((f) => f.id === id);
    if (!item) return;
    if (finish) {
      item.sectionFinishes = { ...item.sectionFinishes, [section]: { ...finish } };
    } else {
      if (item.sectionFinishes) {
        const updated = { ...item.sectionFinishes };
        delete updated[section];
        item.sectionFinishes = Object.keys(updated).length > 0 ? updated : undefined;
      }
    }
    this.isDirty = true;
    this.notifyFurnitureUpdated(item);
    if (this.selectedFurniture?.id === id) {
      this.selectedFurniture = { ...item };
      this.notifySelectionChange();
    }
    this.notifyPlanChange();
  }

  setFurnitureLightConfig(id: string, config: Partial<LightFixtureConfig>): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.furniture.find((f) => f.id === id);
    if (!item) return;
    item.lightConfig = {
      ...(item.lightConfig || {}),
      ...config,
    };
    this.isDirty = true;
    this.notifyFurnitureUpdated(item);
    if (this.selectedFurniture?.id === id) {
      this.selectedFurniture = { ...item };
      this.notifySelectionChange();
    }
    this.notifyPlanChange();
  }

  setFurnitureHasLids(id: string, hasLids: boolean): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.furniture.find((f) => f.id === id);
    if (!item) return;
    item.hasLids = hasLids;
    if (!item.rawItem) item.rawItem = {};
    item.rawItem.hasLids = hasLids;
    this.isDirty = true;
    this.notifyFurnitureUpdated(item);
    if (this.selectedFurniture?.id === id) {
      this.selectedFurniture = { ...item };
      this.notifySelectionChange();
    }
    this.notifyPlanChange();
  }

  setRoomCeiling(roomId: string, ceilingType: 'clip_in' | 'gypsum' | 'none'): void {
    if (!this.currentPlan) return;
    const room = this.currentPlan.rooms.find((r) => r.id === roomId);
    if (!room) return;
    room.ceilingType = ceilingType;
    this.isDirty = true;
    this.notifyPlanChange();
  }

  onPlanChange(listener: PlanChangeListener): () => void {
    this.planChangeListeners.add(listener);
    return () => this.planChangeListeners.delete(listener);
  }

  onPlanLoaded(listener: PlanLoadedListener): () => void {
    this.planLoadedListeners.add(listener);
    return () => this.planLoadedListeners.delete(listener);
  }

  onWallsChanged(listener: WallsChangedListener): () => void {
    this.wallsChangedListeners.add(listener);
    return () => this.wallsChangedListeners.delete(listener);
  }

  onFurnitureUpdated(listener: FurnitureUpdatedListener): () => void {
    this.furnitureUpdatedListeners.add(listener);
    return () => this.furnitureUpdatedListeners.delete(listener);
  }

  onFurnitureDeleted(listener: FurnitureDeletedListener): () => void {
    this.furnitureDeletedListeners.add(listener);
    return () => this.furnitureDeletedListeners.delete(listener);
  }

  onSelectionChange(listener: SelectionChangeListener): () => void {
    this.selectionChangeListeners.add(listener);
    return () => this.selectionChangeListeners.delete(listener);
  }

  onOpeningUpdated(listener: OpeningUpdatedListener): () => void {
    this.openingUpdatedListeners.add(listener);
    return () => this.openingUpdatedListeners.delete(listener);
  }

  onOpeningSelectionChange(listener: OpeningSelectionChangeListener): () => void {
    this.openingSelectionChangeListeners.add(listener);
    return () => this.openingSelectionChangeListeners.delete(listener);
  }

  onWallUpdated(listener: WallUpdatedListener): () => void {
    this.wallUpdatedListeners.add(listener);
    return () => this.wallUpdatedListeners.delete(listener);
  }

  onWallSelectionChange(listener: WallSelectionChangeListener): () => void {
    this.wallSelectionChangeListeners.add(listener);
    return () => this.wallSelectionChangeListeners.delete(listener);
  }

  onRoomSelectionChange(listener: RoomSelectionChangeListener): () => void {
    this.roomSelectionChangeListeners.add(listener);
    return () => this.roomSelectionChangeListeners.delete(listener);
  }

  onRoomUpdated(listener: RoomUpdatedListener): () => void {
    this.roomUpdatedListeners.add(listener);
    return () => this.roomUpdatedListeners.delete(listener);
  }

  exportPlanJson(): string {
    if (!this.currentPlan) return '{}';
    return this.exporter.exportPlan(this.currentPlan);
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  async saveCurrentPlan(): Promise<boolean> {
    if (!this.currentPlan || !this.persistence) return false;
    const json = this.exportPlanJson();
    const ok = await this.persistence.savePlan(json);
    if (ok) {
      this.isDirty = false;
    }
    return ok;
  }

  async resetToTemplate(): Promise<PlanDocument> {
    if (!this.persistence) throw new Error('Persistence service not available');
    const planJson = await this.persistence.resetToTemplate();
    return this.loadPlan(planJson);
  }

  onSaveStatusChange(listener: PlanSaveStatusListener): () => void {
    return this.persistence?.onSaveStatusChange(listener) || (() => {});
  }

  getSaveStatus(): PlanSaveStatus {
    return this.persistence?.getSaveStatus() || 'idle';
  }

  private triggerDebouncedSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.saveCurrentPlan();
    }, 600);
  }

  private notifyPlanLoaded(plan: PlanDocument): void {
    for (const listener of this.planLoadedListeners) {
      listener(plan);
    }
  }

  private notifyWallsChanged(plan: PlanDocument): void {
    for (const listener of this.wallsChangedListeners) {
      listener(plan);
    }
  }

  private notifyFurnitureUpdated(entity: FurnitureEntity): void {
    for (const listener of this.furnitureUpdatedListeners) {
      listener(entity);
    }
  }

  private notifyFurnitureDeleted(id: string): void {
    for (const listener of this.furnitureDeletedListeners) {
      listener(id);
    }
  }

  private notifyOpeningUpdated(opening: OpeningEntity, wall: WallEntity): void {
    for (const listener of this.openingUpdatedListeners) {
      listener(opening, wall);
    }
  }

  private notifyOpeningSelectionChange(): void {
    for (const listener of this.openingSelectionChangeListeners) {
      listener(this.selectedOpening);
    }
  }

  private notifyWallUpdated(wall: WallEntity): void {
    for (const listener of this.wallUpdatedListeners) {
      listener(wall);
    }
  }

  private notifyWallSelectionChange(): void {
    for (const listener of this.wallSelectionChangeListeners) {
      listener(this.selectedWall, this.selectedWallSide);
    }
  }

  private notifyPlanChange(): void {
    if (!this.currentPlan) return;
    for (const listener of this.planChangeListeners) {
      listener(this.currentPlan);
    }
    if (this.isDirty && this.persistence) {
      this.triggerDebouncedSave();
    }
  }

  private notifySelectionChange(): void {
    for (const listener of this.selectionChangeListeners) {
      listener(this.selectedFurniture, this.selectedFurnitureSection);
    }
  }

  private notifyRoomUpdated(room: RoomEntity): void {
    for (const listener of this.roomUpdatedListeners) {
      listener(room);
    }
  }

  private notifyRoomSelectionChange(): void {
    for (const listener of this.roomSelectionChangeListeners) {
      listener(this.selectedRoom);
    }
  }

  private isPointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y))
          && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private isWallOnRoomBoundary(w: WallEntity, poly: Point2D[]): boolean {
    const mx = (w.p1.x + w.p2.x) / 2;
    const my = (w.p1.y + w.p2.y) / 2;
    for (let i = 0; i < poly.length; i++) {
      const pA = poly[i];
      const pB = poly[(i + 1) % poly.length];
      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) continue;
      let t = ((mx - pA.x) * dx + (my - pA.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(mx - (pA.x + t * dx), my - (pA.y + t * dy));
      if (dist < 0.3) return true;
    }
    return false;
  }

  private mapWallToRooms(wall: WallEntity, rooms: RoomEntity[]): void {
    wall.roomIds = [];
    for (const room of rooms) {
      if (this.isWallOnRoomBoundary(wall, room.polygon)) {
        wall.roomIds.push(room.id);
      }
    }

    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;

    const nxA = -dy / len;
    const nyA = dx / len;
    const nxB = dy / len;
    const nyB = -dx / len;
    const probeDist = (wall.thickness || 0.1) / 2 + 0.15;

    const findRoomForSide = (nx: number, ny: number): string | undefined => {
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const px = wall.p1.x + dx * t + nx * probeDist;
        const py = wall.p1.y + dy * t + ny * probeDist;
        for (const room of rooms) {
          if (room.polygon && this.isPointInPolygon({ x: px, y: py }, room.polygon)) {
            return room.id;
          }
        }
      }
      return undefined;
    };

    wall.roomSideA = findRoomForSide(nxA, nyA);
    wall.roomSideB = findRoomForSide(nxB, nyB);

    if (wall.roomIds && wall.roomIds.length > 0) {
      if (!wall.roomSideA && wall.roomSideB) {
        wall.roomSideA = wall.roomIds.find((id) => id !== wall.roomSideB);
      } else if (!wall.roomSideB && wall.roomSideA) {
        wall.roomSideB = wall.roomIds.find((id) => id !== wall.roomSideA);
      } else if (!wall.roomSideA && !wall.roomSideB) {
        wall.roomSideA = wall.roomIds[0];
      }
    }
  }
}
