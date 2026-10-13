import * as THREE from 'three';
import { PlanDocument, FurnitureEntity, OpeningEntity, WallEntity, RoomEntity, SurfaceFinishConfig } from '@core/types/plan';
import { intersectVisibleObjects } from '@services/interaction/VisibleRaycast';
import { ThreeSceneService } from '@services/rendering/ThreeSceneService';
import { PlanParserService } from '@services/plan/PlanParserService';
import { AssetRegistryService } from '@services/rendering/AssetRegistryService';
import { SurfaceFinishService } from '@services/rendering/SurfaceFinishService';
import { TileCatalogService } from '@services/tile-catalog/TileCatalogService';

export class StandaloneViewerApp {
  private sceneService: ThreeSceneService;
  private planParser: PlanParserService;
  private assetRegistry: AssetRegistryService;
  private tileCatalog: TileCatalogService;
  private surfaceFinish: SurfaceFinishService;

  private currentPlan: PlanDocument | null = null;
  private isNightLighting = false;

  // UI Elements
  private containerEl!: HTMLElement;
  private roomBarEl!: HTMLElement;
  private specDrawerEl!: HTMLElement;
  private drawerCategoryEl!: HTMLElement;
  private drawerTitleEl!: HTMLElement;
  private drawerDimensionsEl!: HTMLElement;
  private drawerRoomEl!: HTMLElement;
  private drawerFinishEl!: HTMLElement;
  private drawerDetailsEl!: HTMLElement;
  private drawerCloseBtn!: HTMLElement;
  private tapIndicatorEl!: HTMLElement;

  // Buttons
  private btnOrbit!: HTMLElement;
  private btnTopDown!: HTMLElement;
  private btnWalkthrough!: HTMLElement;
  private btnCutaway!: HTMLElement;
  private btnCeiling!: HTMLElement;
  private btnLighting!: HTMLElement;
  private btnReset!: HTMLElement;

  // Raycasting for tap-to-inspect
  private raycaster = new THREE.Raycaster();
  private pointerDownPos = { x: 0, y: 0, time: 0 };

  constructor() {
    this.assetRegistry = new AssetRegistryService();
    this.tileCatalog = new TileCatalogService();
    this.surfaceFinish = new SurfaceFinishService(this.tileCatalog);
    this.planParser = new PlanParserService(this.assetRegistry);
    this.sceneService = new ThreeSceneService(this.assetRegistry, this.surfaceFinish);
  }

  public init(): void {
    // Intercept texture URLs with offline embedded base64 textures
    THREE.DefaultLoadingManager.setURLModifier((url: string) => {
      if (typeof window !== 'undefined' && (window as any).__EMBEDDED_TEXTURES__) {
        const map = (window as any).__EMBEDDED_TEXTURES__ as Record<string, string>;
        if (map[url]) return map[url];
        // Also normalize /textures/... prefix if leading slash differed
        const normUrl = url.startsWith('/') ? url : `/${url}`;
        if (map[normUrl]) return map[normUrl];
        const filename = url.split('/').pop()?.split('?')[0];
        if (filename) {
          for (const key in map) {
            if (key.endsWith('/' + filename) || key === filename) {
              return map[key];
            }
          }
        }
      }
      return url;
    });

    this.cacheDomElements();
    this.setupUIListeners();
    this.initScene();
    this.loadPlanData();
  }

  private cacheDomElements(): void {
    this.containerEl = document.getElementById('canvas-container')!;
    this.roomBarEl = document.getElementById('room-bar')!;
    this.specDrawerEl = document.getElementById('spec-drawer')!;
    this.drawerCategoryEl = document.getElementById('drawer-category')!;
    this.drawerTitleEl = document.getElementById('drawer-title')!;
    this.drawerDimensionsEl = document.getElementById('drawer-dimensions')!;
    this.drawerRoomEl = document.getElementById('drawer-room')!;
    this.drawerFinishEl = document.getElementById('drawer-finish')!;
    this.drawerDetailsEl = document.getElementById('drawer-details')!;
    this.drawerCloseBtn = document.getElementById('drawer-close')!;
    this.tapIndicatorEl = document.getElementById('tap-indicator')!;

    this.btnOrbit = document.getElementById('btn-orbit')!;
    this.btnTopDown = document.getElementById('btn-topdown')!;
    this.btnWalkthrough = document.getElementById('btn-walkthrough')!;
    this.btnCutaway = document.getElementById('btn-cutaway')!;
    this.btnCeiling = document.getElementById('btn-ceiling')!;
    this.btnLighting = document.getElementById('btn-lighting')!;
    this.btnReset = document.getElementById('btn-reset')!;
  }

  private initScene(): void {
    this.sceneService.initialize(this.containerEl);

    // Touch-friendly OrbitControls configuration
    const controls = this.sceneService.getControls();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 1.1;
      controls.panSpeed = 0.9;
    }

    // Attach raycasting tap-to-inspect on canvas
    const dom = this.sceneService.getDomElement();
    if (dom) {
      dom.addEventListener('pointerdown', (e: PointerEvent) => {
        this.pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
      });

      dom.addEventListener('pointerup', (e: PointerEvent) => {
        const dx = e.clientX - this.pointerDownPos.x;
        const dy = e.clientY - this.pointerDownPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = Date.now() - this.pointerDownPos.time;

        // Only trigger inspection on deliberate tap/click (drag distance <= 6px, duration < 500ms)
        if (dist <= 6 && duration < 500) {
          this.handleInspectTap(e);
        }
      });
    }
  }

  private loadPlanData(): void {
    let rawData: any = null;

    // 1. Check window.__PLAN_DATA__
    if ((window as any).__PLAN_DATA__) {
      rawData = (window as any).__PLAN_DATA__;
    } else {
      // 2. Check <script id="plan-data" type="application/json">
      const scriptEl = document.getElementById('plan-data');
      if (scriptEl && scriptEl.textContent) {
        try {
          rawData = JSON.parse(scriptEl.textContent.trim());
        } catch (err) {
          console.error('[StandaloneViewer] Failed to parse script#plan-data JSON:', err);
        }
      }
    }

    if (!rawData) {
      console.warn('[StandaloneViewer] No plan data found in document.');
      return;
    }

    try {
      this.currentPlan = this.planParser.parse(rawData);
      this.sceneService.renderPlan(this.currentPlan);
      this.buildRoomBar(this.currentPlan.rooms);
    } catch (err) {
      console.error('[StandaloneViewer] Error rendering plan:', err);
    }
  }

  private buildRoomBar(rooms: RoomEntity[]): void {
    this.roomBarEl.innerHTML = '';

    // "Overview (All)" Chip
    const allChip = document.createElement('button');
    allChip.className = 'room-chip active';
    allChip.textContent = 'All Rooms';
    allChip.onclick = () => {
      this.setActiveRoomChip(allChip);
      this.sceneService.isolateRooms([]);
      this.sceneService.resetCamera();
    };
    this.roomBarEl.appendChild(allChip);

    // Individual Room Chips
    for (const room of rooms) {
      const chip = document.createElement('button');
      chip.className = 'room-chip';
      chip.textContent = room.name || `Room ${room.id}`;
      chip.onclick = () => {
        this.setActiveRoomChip(chip);
        this.sceneService.focusOnRoom(room.id);
      };
      this.roomBarEl.appendChild(chip);
    }
  }

  private setActiveRoomChip(activeEl: HTMLElement): void {
    const chips = this.roomBarEl.querySelectorAll('.room-chip');
    chips.forEach((c) => c.classList.remove('active'));
    activeEl.classList.add('active');
  }

  private setupUIListeners(): void {
    // Mode Switchers
    this.btnOrbit?.addEventListener('click', () => {
      this.setModeActive(this.btnOrbit);
      this.sceneService.setViewMode('perspective');
    });

    this.btnTopDown?.addEventListener('click', () => {
      this.setModeActive(this.btnTopDown);
      this.sceneService.setViewMode('topDown');
    });

    this.btnWalkthrough?.addEventListener('click', () => {
      this.setModeActive(this.btnWalkthrough);
      this.sceneService.setViewMode('walkthrough');
    });

    // Craftsman Toggles
    this.btnCutaway?.addEventListener('click', () => {
      const current = this.sceneService.getSettings().wallCutaway;
      const next = !current;
      this.sceneService.updateSettings({ wallCutaway: next });
      this.btnCutaway.classList.toggle('active', next);
    });

    this.btnCeiling?.addEventListener('click', () => {
      const visible = this.sceneService.toggleCeilings();
      this.btnCeiling.classList.toggle('active', visible);
    });

    this.btnLighting?.addEventListener('click', () => {
      this.isNightLighting = !this.isNightLighting;
      this.sceneService.updateSettings({
        globalLightIntensity: this.isNightLighting ? 0.35 : 1.0,
        spotLightIntensity: this.isNightLighting ? 2.4 : 1.0,
        chandelierIntensity: this.isNightLighting ? 2.2 : 1.0,
      });
      this.btnLighting.classList.toggle('active', this.isNightLighting);
    });

    this.btnReset?.addEventListener('click', () => {
      this.sceneService.resetCamera();
    });

    // Drawer Close
    this.drawerCloseBtn?.addEventListener('click', () => {
      this.closeDrawer();
    });
  }

  private setModeActive(targetBtn: HTMLElement): void {
    [this.btnOrbit, this.btnTopDown, this.btnWalkthrough].forEach((btn) => {
      btn?.classList.remove('active');
    });
    targetBtn.classList.add('active');
  }

  private handleInspectTap(event: PointerEvent): void {
    const camera = this.sceneService.getCamera();
    const scene = this.sceneService.getScene();
    const dom = this.sceneService.getDomElement();
    if (!dom || !camera || !this.currentPlan) return;

    const rect = dom.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    // Candidate root groups in scene
    const wallsGroup = scene.getObjectByName('wallsGroup');
    const openingsGroup = scene.getObjectByName('openingsGroup');
    const furnitureGroup = scene.getObjectByName('furnitureGroup');
    const fixturesGroup = scene.getObjectByName('fixturesGroup');
    const floorsGroup = scene.getObjectByName('floorsGroup');

    const candidates: THREE.Object3D[] = [];
    if (openingsGroup?.visible) candidates.push(...openingsGroup.children);
    if (furnitureGroup?.visible) candidates.push(...furnitureGroup.children);
    if (fixturesGroup?.visible) candidates.push(...fixturesGroup.children);
    if (wallsGroup?.visible) candidates.push(...wallsGroup.children);
    if (floorsGroup?.visible) candidates.push(...floorsGroup.children);

    const hits = intersectVisibleObjects(this.raycaster, candidates);

    for (const hit of hits) {
      if (hit.object instanceof THREE.LineSegments) continue;
      if (this.sceneService.isPointForegroundOccluded(hit.point)) continue;

      this.triggerTapAnimation(event.clientX, event.clientY);

      // Check door / window opening
      let curr: THREE.Object3D | null = hit.object;
      let foundOpening: { opening: OpeningEntity; wall: WallEntity } | null = null;
      while (curr && curr !== openingsGroup && curr !== scene) {
        if (curr.userData?.isDoor && curr.userData?.opening && curr.userData?.wall) {
          foundOpening = { opening: curr.userData.opening, wall: curr.userData.wall };
          break;
        }
        curr = curr.parent;
      }
      if (foundOpening) {
        this.showOpeningSpec(foundOpening.opening, foundOpening.wall);
        return;
      }

      // Check furniture / fixture
      let foundFurniture: FurnitureEntity | null = null;
      curr = hit.object;
      while (curr && curr !== furnitureGroup && curr !== fixturesGroup && curr !== scene) {
        if (curr.userData?.entity) {
          foundFurniture = curr.userData.entity as FurnitureEntity;
          break;
        }
        curr = curr.parent;
      }
      if (foundFurniture) {
        this.showFurnitureSpec(foundFurniture);
        return;
      }

      // Check wall
      let foundWall: WallEntity | null = null;
      let isBaseboard = false;
      curr = hit.object;
      while (curr && curr !== wallsGroup && curr !== scene) {
        if (curr.userData?.wall) {
          foundWall = curr.userData.wall as WallEntity;
          isBaseboard = hit.object.userData?.section === 'baseboard' || curr.userData?.section === 'baseboard';
          break;
        }
        curr = curr.parent;
      }
      if (foundWall) {
        this.showWallSpec(foundWall, isBaseboard);
        return;
      }

      // Check floor
      let foundRoomId: string | null = null;
      curr = hit.object;
      while (curr && curr !== floorsGroup && curr !== scene) {
        if (curr.userData?.type === 'floor' && curr.userData?.roomId) {
          foundRoomId = curr.userData.roomId;
          break;
        }
        if (curr.userData?.type === 'room' && curr.userData?.id) {
          foundRoomId = curr.userData.id;
          break;
        }
        curr = curr.parent;
      }
      if (foundRoomId) {
        const room = this.currentPlan.rooms?.find((r) => r.id === foundRoomId);
        if (room) {
          this.showFloorSpec(room);
          return;
        }
      }
    }

    // Tapped empty space
    this.closeDrawer();
  }

  private triggerTapAnimation(screenX: number, screenY: number): void {
    if (!this.tapIndicatorEl) return;
    this.tapIndicatorEl.style.left = `${screenX}px`;
    this.tapIndicatorEl.style.top = `${screenY}px`;
    this.tapIndicatorEl.classList.remove('pulse');
    void this.tapIndicatorEl.offsetWidth; // Force reflow
    this.tapIndicatorEl.classList.add('pulse');
  }

  // ── Specification Formatters for Craftsmen ──────────────────────────────

  private showFurnitureSpec(item: FurnitureEntity): void {
    const roomName = this.findEnclosingRoomName(item.position.x, item.position.z);
    const category = item.category || 'furniture';
    const title = item.displayName || item.name || item.assetKey || 'Furniture Piece';

    const wCm = Math.round(item.dimensions.x * 100);
    const dCm = Math.round(item.dimensions.z * 100);
    const hCm = Math.round(item.dimensions.y * 100);

    let finishText = 'Default Manufacturer Spec';
    if (item.finish?.variant) {
      finishText = `${item.finish.type.toUpperCase()}: ${item.finish.variant}`;
    } else if (item.finish?.color) {
      finishText = `Color ${item.finish.color}`;
    }

    const details: string[] = [];
    if (item.sectionFinishes) {
      for (const [sec, finish] of Object.entries(item.sectionFinishes)) {
        details.push(`${sec}: ${finish.variant || finish.color || finish.type}`);
      }
    }
    const detailsText = details.length > 0 ? details.join(' • ') : `Position: X:${item.position.x.toFixed(2)}m, Z:${item.position.z.toFixed(2)}m`;

    this.renderDrawer({
      category: `Furniture / ${category}`,
      title,
      dimensions: `${wCm} × ${dCm} × ${hCm} cm`,
      room: roomName,
      finish: finishText,
      details: detailsText,
      color: item.finish?.color,
    });
  }

  private showWallSpec(wall: WallEntity, isBaseboard: boolean): void {
    const lengthM = Math.sqrt(
      Math.pow(wall.p2.x - wall.p1.x, 2) + Math.pow(wall.p2.y - wall.p1.y, 2)
    );
    const thicknessCm = Math.round((wall.thickness || 0.15) * 100);
    const heightM = wall.height || this.currentPlan?.totalHeight || 2.7;

    const roomName = this.findEnclosingRoomName((wall.p1.x + wall.p2.x) / 2, (wall.p1.y + wall.p2.y) / 2);

    if (isBaseboard) {
      const baseboardFinish = wall.finishBaseboard;
      const bColor = baseboardFinish?.color || '#ffffff';
      return this.renderDrawer({
        category: 'Interior Trim / Baseboard',
        title: 'Skirting / Baseboard (10 cm)',
        dimensions: `${lengthM.toFixed(2)} m run, 10 cm height`,
        room: roomName,
        finish: baseboardFinish?.variant || `Matte Lacquer (${bColor})`,
        details: `Attached to Wall ${wall.id}. Material thickness: 16mm.`,
        color: bColor,
      });
    }

    const sideA = wall.finishSideA || wall.finish;
    const sideB = wall.finishSideB;
    const finishDescA = this.formatFinishName(sideA);
    const finishDescB = sideB ? this.formatFinishName(sideB) : 'Matches Side A';

    const isLambri = sideA?.type === 'lambri' || sideB?.type === 'lambri';
    const category = isLambri ? 'Architectural Paneling' : 'Partition Wall';
    const title = isLambri ? 'Acoustic Slat Lambri Wall' : `Interior Wall (${thicknessCm} cm)`;

    let details = `Side A: ${finishDescA}`;
    if (sideB) {
      details += `\nSide B: ${finishDescB}`;
    }
    if (wall.frameStyle && wall.frameStyle !== 'none') {
      details += ` • Frame Style: ${wall.frameStyle}`;
    }

    this.renderDrawer({
      category,
      title,
      dimensions: `${lengthM.toFixed(2)} m (L) × ${heightM.toFixed(2)} m (H) × ${thicknessCm} cm (T)`,
      room: roomName,
      finish: finishDescA,
      details,
      color: sideA?.color,
    });
  }

  private showOpeningSpec(opening: OpeningEntity, wall: WallEntity): void {
    const isDoor = opening.type === 'door' || opening.type === 'door_coupe';
    const category = isDoor ? 'Joinery / Door' : 'Window / Glazing';
    const title = isDoor ? 'Interior Door' : 'Window / Glazed Opening';

    const wCm = Math.round(opening.width * 100);
    const hCm = Math.round(opening.height * 100);
    const sillCm = Math.round((opening.floorHeight || 0) * 100);

    const roomName = this.findEnclosingRoomName((wall.p1.x + wall.p2.x) / 2, (wall.p1.y + wall.p2.y) / 2);

    let details = `Wall Location: ${wall.id}`;
    if (isDoor) {
      details += ` • Swing: ${opening.swingSide || 'default'} • Hinge: ${opening.hingeSide || 'default'}`;
      if (opening.openAngle !== undefined) details += ` • Angle: ${opening.openAngle}°`;
    } else {
      details += ` • Sill Height: ${sillCm} cm`;
    }

    this.renderDrawer({
      category,
      title,
      dimensions: `${wCm} × ${hCm} cm${sillCm > 0 ? ` (Sill: ${sillCm} cm)` : ''}`,
      room: roomName,
      finish: opening.finish ? this.formatFinishName(opening.finish) : (isDoor ? 'Lacquered Interior Flush Door' : 'Thermally Broken Aluminum Profile'),
      details,
      color: opening.finish?.color,
    });
  }

  private showFloorSpec(room: RoomEntity): void {
    const finish = room.floorFinish;
    const tileEntry = finish?.variant ? this.tileCatalog.getById(finish.variant) : undefined;

    let finishName = 'Standard Floor Finish';
    let details = `Room: ${room.name || room.id}`;

    if (tileEntry) {
      finishName = tileEntry.name;
      details = `Tile Size: ${tileEntry.widthCm}×${tileEntry.heightCm} cm • Grout: ${tileEntry.defaultGroutWidth || 2} mm • Pattern: ${finish?.pattern || 'grid'}`;
    } else if (finish?.type === 'tile') {
      finishName = `Porcelain Tile (${finish.variant || 'Standard'})`;
      details = `Pattern: ${finish.pattern || 'grid'}`;
    } else if (finish?.type === 'wood') {
      finishName = `Engineered Hardwood Parquet (${finish.variant || 'Oak'})`;
    }

    const area = this.calculatePolygonArea(room.polygon);

    this.renderDrawer({
      category: 'Flooring Specification',
      title: `${room.name || 'Room'} Floor`,
      dimensions: `${area.toFixed(1)} m² floor area`,
      room: room.name || room.id,
      finish: finishName,
      details,
      color: finish?.color,
    });
  }

  private formatFinishName(finish?: SurfaceFinishConfig): string {
    if (!finish) return 'Plaster & Paint';
    if (finish.type === 'lambri') {
      return `Acoustic Lambri (${finish.variant || 'Wood Slats'} on ${finish.backingColor || 'Dark Felt'})`;
    }
    if (finish.type === 'tile') {
      const tile = finish.variant ? this.tileCatalog.getById(finish.variant) : undefined;
      return tile ? tile.name : `Tile (${finish.variant || 'Standard'})`;
    }
    if (finish.type === 'paint') return `Interior Wall Paint (${finish.color || '#f8fafc'})`;
    if (finish.type === 'wood') return `Wood Veneer (${finish.variant || 'Oak'})`;
    if (finish.type === 'fabric') return `Fabric Upholstery (${finish.variant || 'Velvet'})`;
    return `${finish.type} (${finish.variant || finish.color || 'Standard'})`;
  }

  private findEnclosingRoomName(x: number, z: number): string {
    if (!this.currentPlan?.rooms) return 'Interior';
    for (const room of this.currentPlan.rooms) {
      if (room.polygon && this.isPointInPolygon({ x, y: z }, room.polygon)) {
        return room.name || `Room ${room.id}`;
      }
    }
    return 'Main Living Area';
  }

  private isPointInPolygon(point: { x: number; y: number }, vs: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x, yi = vs[i].y;
      const xj = vs[j].x, yj = vs[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private calculatePolygonArea(polygon: { x: number; y: number }[]): number {
    if (!polygon || polygon.length < 3) return 0;
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      area += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
    }
    return Math.abs(area / 2);
  }

  private renderDrawer(spec: {
    category: string;
    title: string;
    dimensions: string;
    room: string;
    finish: string;
    details: string;
    color?: string;
  }): void {
    this.drawerCategoryEl.textContent = spec.category;
    this.drawerTitleEl.textContent = spec.title;
    this.drawerDimensionsEl.textContent = spec.dimensions;
    this.drawerRoomEl.textContent = spec.room;

    if (spec.color) {
      this.drawerFinishEl.innerHTML = `<span class="spec-color-swatch" style="background:${spec.color}"></span>${spec.finish}`;
    } else {
      this.drawerFinishEl.textContent = spec.finish;
    }

    this.drawerDetailsEl.textContent = spec.details;
    this.specDrawerEl.classList.add('open');
  }

  private closeDrawer(): void {
    this.specDrawerEl.classList.remove('open');
  }
}

// Auto-boot when DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new StandaloneViewerApp();
    app.init();
    (window as any).__viewerApp = app;
  });
}
