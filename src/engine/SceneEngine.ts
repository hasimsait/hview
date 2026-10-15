import { FurnitureEntity,OpeningEntity,PlanDocument,RoomEntity,WallEntity } from '@core/types/plan';
import { ISceneService,ISurfaceFinishService,ViewMode,ViewportSettings } from '@core/types/services';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DocumentChange } from '../application/EditorSession';
import { Furniture } from '../domain/elements/Furniture';
import { Opening } from '../domain/elements/Opening';
import { Wall } from '../domain/elements/Wall';
import { WallRecess } from '../domain/elements/WallRecess';
import { surfaceSection } from '../domain/model/SurfaceSections';
import type { FurnitureMeshBuilder } from './assets/FurnitureMeshBuilder';
import { PlanCameraFocus } from './camera/PlanCameraFocus';
import { WallMeshBuilder } from "./geometry/WallMeshBuilder";
import { SceneLighting } from './lighting/SceneLighting';
import { FurnitureAppearance } from './materials/FurnitureAppearance';
import { PlanSceneGraph } from './nodes/PlanSceneGraph';
import { SceneNodeFactory } from './nodes/SceneNodeFactory';
import { PickRegistry,PickingController } from './picking/PickRegistry';
import { RenderScheduler } from './RenderScheduler';
import { ResourcePool,type ResourceLease } from './resources/ResourcePool';
import { SceneVisibility } from './visibility/SceneVisibility';

import { CameraNavigationController } from '../services/rendering/CameraNavigationController';
import { CeilingMeshBuilder } from "./geometry/CeilingMeshBuilder";
import { FloorMeshBuilder } from "./geometry/FloorMeshBuilder";
import { OpeningMeshBuilder } from "./geometry/OpeningMeshBuilder";
import { SurfaceMaterialFactory } from "./materials/SurfaceMaterialFactory";

export class SceneEngine implements ISceneService {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private controls: OrbitControls | null = null;
  private cameraNavController: CameraNavigationController | null = null;
  private interactionEnabled = true;

  private wallsGroup = new THREE.Group();
  private ceilingsGroup = new THREE.Group();
  private openingsGroup = new THREE.Group();
  private floorsGroup = new THREE.Group();
  private furnitureGroup = new THREE.Group();
  private fixturesGroup = new THREE.Group();
  private helpersGroup = new THREE.Group();

  private selectionHelper: THREE.BoxHelper | null = null;
  private openingSelectionHelper: THREE.BoxHelper | null = null;
  private wallSelectionHelper: THREE.BoxHelper | null = null;
  private floorSelectionHelper: THREE.Group | null = null;
  private splitPreviewHelper: THREE.Group | null = null;
  private readonly visibility = new SceneVisibility();
  private currentPlan: PlanDocument | null = null;

  readonly resources = new ResourcePool();
  readonly picking = new PickRegistry();
  readonly picker = new PickingController(this.picking);
  private readonly graph: PlanSceneGraph;
  private readonly appearance: FurnitureAppearance;
  private readonly paletteLease: ResourceLease;
  private ceilingLease: ResourceLease | null = null;
  private finishService: SurfaceMaterialFactory;
  private wallBuilder: WallMeshBuilder;
  private openingBuilder: OpeningMeshBuilder;
  private floorBuilder: FloorMeshBuilder;
  private ceilingBuilder: CeilingMeshBuilder;

  private readonly lighting: SceneLighting;
  private readonly cameraFocus: PlanCameraFocus;
  private settings: ViewportSettings = {
    showWalls: true,
    wallCutaway: false, // Default to FALSE so full 2.7m walls render
    wallOpacity: 1.0,
    foregroundOcclusionMode: 'transparent', // Default: closer to camera side of orbit is transparent
    isolatedRoomIds: [], // empty = show whole house
    showFurniture: true,
    showFixtures: false, // Hidden by default so 34 sockets don't clutter the scene
    showCeiling: false,
    showFloor: true,
    showRoomLabels: false, // OFF by default to eliminate annoying labels
    viewMode: 'perspective',
    globalLighting: true,
    globalLightIntensity: 1.0,
    spotLightIntensity: 1.0,
    chandelierIntensity: 1.0,
  };

  private scheduler: RenderScheduler | null = null;
  private stopTextureNotifications: (() => void) | null = null;
  invalidate(): void { this.scheduler?.invalidate(); }
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private furnitureBuilder: FurnitureMeshBuilder,
    finishService?: ISurfaceFinishService
  ) {
    this.finishService = finishService as SurfaceMaterialFactory;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep modern slate

    this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.02, 1000);
    this.perspectiveCamera.position.set(0, 12, 16);

    const aspect = 1;
    const frustumSize = 18;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.orthographicCamera.position.set(0, 30, 0);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.activeCamera = this.perspectiveCamera;

    this.wallBuilder = new WallMeshBuilder(this.finishService);
    this.openingBuilder = new OpeningMeshBuilder(this.finishService);
    this.floorBuilder = new FloorMeshBuilder(this.finishService);
    this.ceilingBuilder = new CeilingMeshBuilder(this.finishService);

    this.wallsGroup.name = 'wallsGroup';
    this.ceilingsGroup.name = 'ceilingsGroup';
    this.ceilingsGroup.visible = false; // OFF by default
    this.openingsGroup.name = 'openingsGroup';
    this.floorsGroup.name = 'floorsGroup';
    this.furnitureGroup.name = 'furnitureGroup';
    this.fixturesGroup.name = 'fixturesGroup';
    this.helpersGroup.name = 'helpersGroup';

    this.scene.add(
      this.floorsGroup,
      this.wallsGroup,
      this.ceilingsGroup,
      this.openingsGroup,
      this.furnitureGroup,
      this.fixturesGroup,
      this.helpersGroup
    );


    this.appearance = new FurnitureAppearance(this.finishService, this.resources, () => this.settings, item => item.hostId ? this.currentPlan?.requireRecessHost(item.hostId) : undefined);
    const palette = Object.assign(new THREE.Object3D(), { material: [...this.furnitureBuilder.palette, ...this.wallBuilder.materials.palette, ...this.openingBuilder.palette, ...this.floorBuilder.palette, ...this.ceilingBuilder.palette] });
    this.paletteLease = this.resources.ownTree(palette);
    const factory = new SceneNodeFactory({
      furniture: { build: element => this.furnitureBuilder.build(element, element instanceof WallRecess && element.hostId ? this.currentPlan?.requireRecessHost(element.hostId).thickness : undefined) }, appearance: this.appearance,
      wall: { build: wall => this.wallBuilder.buildWall(wall, this.settings.wallCutaway ? 1.15 : undefined, undefined, this.getRecessHolesForWall(wall)), applyMaterials: (root, wall) => this.wallBuilder.materials.applyMaterials(root, wall) },
      column: { build: column => this.wallBuilder.buildWall(column.wallShape(this.currentPlan!.totalHeight), this.settings.wallCutaway ? 1.15 : undefined, undefined, this.getRecessHolesForWall(column.wallShape(this.currentPlan!.totalHeight))), applyMaterials: (root, column) => this.wallBuilder.materials.applyMaterials(root, column.wallShape(this.currentPlan!.totalHeight)) },
      room: { build: room => this.floorBuilder.buildFloor(room, this.settings.showRoomLabels), applyMaterials: (root, room) => this.floorBuilder.applyMaterials(root, room) },
      opening: {
        update: (root, opening) => this.openingBuilder.update(root, opening), build: opening => {
          if (this.settings.wallCutaway && opening.floorHeight >= 1.15) return new THREE.Group();
          return this.openingBuilder.buildOpening(opening, this.currentPlan!.requireWall(opening.wallId));
        }
      },
    }, this.resources, this.picking);
    this.graph = new PlanSceneGraph(factory, { walls: this.wallsGroup, openings: this.openingsGroup, floors: this.floorsGroup, furniture: this.furnitureGroup, fixtures: this.fixturesGroup });
    this.lighting = new SceneLighting(this.scene);
    this.cameraFocus = new PlanCameraFocus(this.perspectiveCamera, this.orthographicCamera, () => this.controls, () => this.container, () => this.currentPlan, id => this.graph.get(id)?.group, () => this.invalidate());
    this.applyLightingSettings();
    this.setupGroundGrid();
  }

  initialize(container: HTMLElement): void {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.enableDamping = false; // Immediate stop on pointer release - zero momentum!
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't dip below floor
    this.controls.minDistance = 1;
    this.controls.maxDistance = 60;
    this.controls.target.set(0, 0, 0);

    this.cameraNavController = new CameraNavigationController(
      this.perspectiveCamera,
      this.orthographicCamera,
      () => this.controls,
      () => this.settings.viewMode,
      { onInput: () => this.invalidate() }
    );
    this.cameraNavController.attach();

    this.updateCameraAspect();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCameraAspect();
    });
    this.resizeObserver.observe(container);

    this.paletteLease.refresh(); this.graph.refreshResources();
    this.scheduler = new RenderScheduler(delta => this.renderFrame(delta), () => this.cameraNavController?.hasActiveInput ?? false);
    this.stopTextureNotifications = this.finishService.textures.subscribe(() => {
      this.paletteLease.refresh(); this.graph.refreshResources(); this.invalidate();
    });
    this.invalidate();
  }

  setInteractionEnabled(enabled: boolean): void {
    this.invalidate();
    this.interactionEnabled = enabled;
    if (this.controls) this.controls.enabled = enabled;
    if (enabled) this.cameraNavController?.attach();
    else this.cameraNavController?.detach();
  }

  dispose(): void {
    this.graph.dispose(); this.ceilingLease?.dispose(); this.paletteLease.dispose();
    this.finishService.dispose();
    this.scene.environment?.dispose();
    this.lighting.dispose();
    this.resources.ownTree(this.helpersGroup).dispose(); this.helpersGroup.clear();
    if (this.cameraNavController) {
      this.cameraNavController.dispose();
      this.cameraNavController = null;
    }
    this.scheduler?.dispose(); this.stopTextureNotifications?.();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
  }

  private setupGroundGrid(): void {
    this.invalidate();
    // Subtle floor grid
    const grid = new THREE.GridHelper(50, 50, 0x475569, 0x1e293b);
    grid.position.y = -0.01;
    this.helpersGroup.add(grid);
  }

  applyDocumentChange(change: DocumentChange): void {
    this.invalidate();
    this.currentPlan = change.document;
    this.graph.reconcile(change.document);
    if (!change.previous || change.previous.rooms.length !== change.document.rooms.length || change.document.rooms.some((room, index) => room !== change.previous!.rooms[index])) this.rebuildCeilings();
    this.applyVisibilitySettings(); this.applyLightingSettings();
    if (!change.previous || change.label === 'Load document') this.fitPlanInView();
  }

  renderPlan(plan: PlanDocument): void {
    this.invalidate();
    this.currentPlan = plan; this.graph.reconcile(plan); this.rebuildCeilings();
    this.applyVisibilitySettings(); this.applyLightingSettings(); this.fitPlanInView();
  }

  private rebuildCeilings(): void {
    const next = this.ceilingBuilder.buildCeilings(this.currentPlan!, this.settings.isolatedRoomIds);
    const lease = this.resources.ownTree(next);
    this.ceilingsGroup.clear(); this.ceilingsGroup.add(next);
    this.ceilingLease?.dispose(); this.ceilingLease = lease;
  }
  private applyLightingSettings(): void {
    this.lighting.update(this.settings);
    // Update all fixture lights across the scene
    for (const node of this.graph.values()) if (node.model instanceof Furniture) this.appearance.applyLighting(node.group, node.model);
    this.graph.refreshResources();

  }


  getFurnitureSections(id: string): string[] {
    const mesh = this.graph.get(id)?.group;
    if (!mesh) return [];
    const sections = new Set<string>();
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        if (!child.userData.section) {
          const matSec = (child.material as any)?.__section as string | undefined;
          if (matSec) {
            child.userData.section = matSec.charAt(0).toUpperCase() + matSec.slice(1);
          }
        }
        const sec = child.userData?.section as string | undefined;
        if (sec && sec !== 'Screen') sections.add(surfaceSection(sec));
      }
    });
    return Array.from(sections);
  }

  private getRecessHolesForWall(wall: WallEntity) {
    const native = (wall.cavities ?? []).map(cavity => ({
      start: cavity.distanceAlongWall - cavity.width / 2,
      end: cavity.distanceAlongWall + cavity.width / 2,
      floorHeight: cavity.floorElevation,
      topHeight: cavity.floorElevation + cavity.height,
    }));
    const recesses = this.currentPlan?.recessesFor(wall.id) ?? [];
    return [...native, ...recesses.flatMap(recess => {
      const cut = recess.cutFor(wall);
      return cut ? [cut] : [];
    })];
  }

  setSelectionHighlight(entity: FurnitureEntity | null): void {
    this.invalidate();
    if (this.selectionHelper) {
      this.helpersGroup.remove(this.selectionHelper);
      this.selectionHelper = null;
    }

    if (!entity) return;

    const mesh = this.graph.get(entity.id)?.group;
    if (!mesh) return;

    this.selectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    this.selectionHelper.userData = { id: entity.id };
    this.helpersGroup.add(this.selectionHelper);
  }

  setOpeningSelectionHighlight(selected: { opening: OpeningEntity; wall: WallEntity } | null): void {
    this.invalidate();
    if (this.openingSelectionHelper) {
      this.helpersGroup.remove(this.openingSelectionHelper);
      this.openingSelectionHelper = null;
    }

    if (!selected) return;

    const mesh = this.graph.get(selected.opening.id)?.group;
    if (!mesh) return;

    this.openingSelectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    this.openingSelectionHelper.userData = { id: selected.opening.id };
    this.helpersGroup.add(this.openingSelectionHelper);
  }
  focusOnOpening(opening: OpeningEntity, _wall: WallEntity): void { this.cameraFocus.focusOnOpening(opening, _wall); }


  setWallSelectionHighlight(wall: WallEntity | null): void {
    this.invalidate();
    if (this.wallSelectionHelper) {
      this.helpersGroup.remove(this.wallSelectionHelper);
      this.wallSelectionHelper.dispose();
      this.wallSelectionHelper = null;
    }

    if (!wall) return;

    const mesh = this.graph.get(wall.id)?.group;
    if (!mesh) return;

    this.wallSelectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    (this.wallSelectionHelper as any).userData = { id: wall.id };
    this.helpersGroup.add(this.wallSelectionHelper);
  }
  focusOnWall(wall: WallEntity): void { this.cameraFocus.focusOnWall(wall); }


  setFloorSelectionHighlight(room: RoomEntity | null): void {
    this.invalidate();
    if (this.floorSelectionHelper) {
      this.helpersGroup.remove(this.floorSelectionHelper);
      this.floorSelectionHelper.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.floorSelectionHelper = null;
    }

    if (!room || !room.polygon || room.polygon.length < 3) return;

    const highlightGroup = new THREE.Group();
    highlightGroup.name = 'floorSelectionHighlight';
    (highlightGroup as any).userData = { id: room.id };

    // 1. Subtle glowing semi-transparent fill shape over the room floor polygon
    const shape = new THREE.Shape();
    shape.moveTo(room.polygon[0].x, -room.polygon[0].y);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i].x, -room.polygon[i].y);
    }
    shape.closePath();

    const fillGeom = new THREE.ShapeGeometry(shape);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // sky blue
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fillMesh = new THREE.Mesh(fillGeom, fillMat);
    fillMesh.rotation.x = -Math.PI / 2;
    fillMesh.position.y = 0.004; // Sits above floor mesh (0.002)
    highlightGroup.add(fillMesh);

    // 2. Crisp bright cyan/blue perimeter outline loop
    const points: THREE.Vector3[] = [];
    for (const pt of room.polygon) {
      points.push(new THREE.Vector3(pt.x, 0.006, pt.y));
    }
    points.push(new THREE.Vector3(room.polygon[0].x, 0.006, room.polygon[0].y));

    const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7, // vibrant sky blue
      linewidth: 3,
      depthTest: true,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    highlightGroup.add(line);

    this.floorSelectionHelper = highlightGroup;
    this.helpersGroup.add(this.floorSelectionHelper);
  }

  showWallSplitPreview(wall: WallEntity, splitDistance: number): void {
    this.invalidate();
    this.hideWallSplitPreview();

    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) return;

    const t = Math.max(0, Math.min(1, splitDistance / len));
    const splitX = wall.p1.x + t * dx;
    const splitZ = wall.p1.y + t * dy;
    const angle = Math.atan2(dy, dx);
    const wallH = wall.height || this.currentPlan?.totalHeight || 2.7;
    const cutawayH = this.settings.wallCutaway ? 1.15 : undefined;
    const effectiveH = cutawayH !== undefined ? cutawayH : wallH;
    const thickness = (wall.thickness || 0.1) + 0.04;

    const group = new THREE.Group();
    group.name = 'splitPreviewHelper';

    // 1. Semi-transparent glowing slice plane across the wall cross-section
    const planeGeom = new THREE.BoxGeometry(0.02, effectiveH + 0.04, thickness);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    group.add(planeMesh);

    // 2. High-contrast outline edges
    const edgesGeom = new THREE.EdgesGeometry(planeGeom);
    const edgesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
    });
    const edgeLines = new THREE.LineSegments(edgesGeom, edgesMat);
    group.add(edgeLines);

    // 3. Prominent center vertical cut line
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -effectiveH / 2 - 0.05, 0),
      new THREE.Vector3(0, effectiveH / 2 + 0.05, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    const centerLine = new THREE.Line(lineGeom, lineMat);
    group.add(centerLine);

    // Position and rotate: perpendicular to wall direction
    group.position.set(splitX, effectiveH / 2, splitZ);
    group.rotation.y = -angle;

    this.helpersGroup.add(group);
    this.splitPreviewHelper = group;
  }

  hideWallSplitPreview(): void {
    this.invalidate();
    if (this.splitPreviewHelper) {
      this.helpersGroup.remove(this.splitPreviewHelper);
      this.splitPreviewHelper.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      this.splitPreviewHelper = null;
    }
  }

  toggleCeilings(): boolean {
    this.invalidate();
    this.settings.showCeiling = !this.settings.showCeiling;
    this.applyVisibilitySettings();
    return this.settings.showCeiling;
  }

  getShowCeilings(): boolean {
    return this.settings.showCeiling;
  }

  setViewMode(mode: ViewMode): void {
    this.invalidate();
    this.settings.viewMode = mode;

    if (mode === 'topDown') {
      this.activeCamera = this.orthographicCamera;
      this.orthographicCamera.position.set(
        this.controls ? this.controls.target.x : 0,
        25,
        this.controls ? this.controls.target.z : 0
      );
      this.orthographicCamera.lookAt(
        this.controls ? this.controls.target.x : 0,
        0,
        this.controls ? this.controls.target.z : 0
      );
      if (this.controls) {
        this.controls.object = this.orthographicCamera;
        this.controls.enableRotate = false; // Pure 2D pan and zoom
        this.controls.update();
      }

      // Enable crisp black cel outlines
      this.wallBuilder.materials.setCelShading(true);
      this.furnitureBuilder.setCelShading(true);
      this.wallBuilder.materials.setForegroundMode('off');
      this.openingBuilder.setForegroundMode('off');
      this.furnitureBuilder.setForegroundMode('off');
      this.finishService.setForegroundMode('off');
    } else {
      this.activeCamera = this.perspectiveCamera;
      if (this.controls) {
        this.controls.object = this.perspectiveCamera;
        this.controls.enableRotate = true;
        this.controls.update();
      }

      this.wallBuilder.materials.setCelShading(false);
      this.furnitureBuilder.setCelShading(false);
      this.wallBuilder.materials.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.openingBuilder.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.furnitureBuilder.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.finishService.setForegroundMode(this.settings.foregroundOcclusionMode);
    }

    this.applyLightingSettings();
    this.updateCameraAspect();
  }

  updateSettings(settings: Partial<ViewportSettings>): void {
    this.invalidate();
    const prevCutaway = this.settings.wallCutaway;
    this.settings = { ...this.settings, ...settings };

    if (settings.wallCutaway !== undefined && settings.wallCutaway !== prevCutaway) {
      // Rebuild walls with/without cutaway
      if (this.currentPlan) {
        this.graph.rebuildStructures();
        this.applyVisibilitySettings();
      }
    } else {
      this.applyVisibilitySettings();
    }

    this.applyLightingSettings();
  }

  getSettings(): ViewportSettings {
    return { ...this.settings };
  }

  private applyVisibilitySettings(): void {
    if (this.currentPlan) for (const node of this.graph.values()) node.group.visible = this.visibility.isVisible(node.model, this.currentPlan, this.settings);
    this.ceilingsGroup.visible = this.settings.showCeiling;
    for (const child of this.ceilingsGroup.children) {
      child.visible = true;
      for (const ceiling of child.children) ceiling.visible = this.settings.isolatedRoomIds.length === 0 || this.settings.isolatedRoomIds.includes(ceiling.userData.id);
    }

    const fgMode = this.settings.viewMode === 'topDown' ? 'off' : this.settings.foregroundOcclusionMode;
    this.wallBuilder.materials.setForegroundMode(fgMode);
    this.openingBuilder.setForegroundMode(fgMode);
    this.furnitureBuilder.setForegroundMode(fgMode);
    this.finishService.setForegroundMode(fgMode);
    this.wallBuilder.materials.setWallOpacity(this.settings.wallOpacity);
    this.finishService.setForegroundOpacity(this.settings.wallOpacity);
  }

  isolateRooms(roomIds: string[]): void {
    this.settings.isolatedRoomIds = roomIds;
    this.applyVisibilitySettings();

    if (roomIds.length === 1) {
      // Single room selected — focus camera on it
      this.focusOnRoom(roomIds[0]);
    } else if (roomIds.length === 0) {
      this.fitPlanInView();
    } else {
      // Multiple rooms — compute combined bounding box across all selected rooms
      if (!this.currentPlan || !this.controls) return;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const rid of roomIds) {
        const room = this.currentPlan.rooms.find((r) => r.id === rid);
        if (!room) continue;
        for (const p of room.polygon) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y);
        }
      }
      if (!isFinite(minX)) return;
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const maxSpan = Math.max(maxX - minX, maxZ - minZ, 2.8);
      this.controls.target.set(centerX, 0.8, centerZ);
      this.perspectiveCamera.position.set(centerX, maxSpan * 1.15, centerZ + maxSpan * 1.25);
      this.controls.update();
    }
  }
  focusOnRoom(roomId: string): void { this.cameraFocus.focusOnRoom(roomId); }

  focusOnObject(id: string, options?: {
    frameDistance?: number;
    viewDirection?: THREE.Vector3;
  }): void { this.cameraFocus.focusOnObject(id, options); }


  getWallInCameraView(): { wall: WallEntity; point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!this.currentPlan || !this.controls) return null;

    // Center crosshairs first, followed by a tight radial grid for slight off-center views
    const screenSamples: { x: number; y: number }[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0.15 },
      { x: 0, y: -0.15 },
      { x: 0.15, y: 0 },
      { x: -0.15, y: 0 },
      { x: 0, y: 0.35 },
      { x: 0, y: -0.35 },
      { x: 0.35, y: 0 },
      { x: -0.35, y: 0 },
    ];

    for (const sample of screenSamples) {
      const picked = this.picker.pick(new THREE.Vector2(sample.x, sample.y), this.activeCamera,
        hit => this.picking.resolve(hit.object)?.kind === 'wall' && !this.isPointForegroundOccluded(hit.point));
      if (picked) {
        const hit = picked.hit;
        const wall = this.currentPlan.get(picked.target.id);
        if (wall instanceof Wall) {
          let worldNormal = hit.face
            ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
            : new THREE.Vector3(0, 0, 1);
          worldNormal.y = 0;
          if (worldNormal.lengthSq() > 0.001) {
            worldNormal.normalize();
          } else {
            const dx = wall.p2.x - wall.p1.x;
            const dy = wall.p2.y - wall.p1.y;
            worldNormal.set(-dy, 0, dx).normalize();
          }

          // Ensure normal points outwards from wall face towards the active camera
          const toCam = new THREE.Vector3().subVectors(this.activeCamera.position, hit.point).normalize();
          if (worldNormal.dot(toCam) < 0) {
            worldNormal.negate();
          }

          return {
            wall,
            point: hit.point.clone(),
            normal: worldNormal,
          };
        }
      }
    }

    // 2. Fallback: Find closest wall segment to the current orbit target facing camera
    const orbitTarget = this.controls.target;
    let closestWall: WallEntity | null = null;
    let closestDistSq = Infinity;
    let closestPt = new THREE.Vector2();

    for (const w of this.currentPlan.walls) {
      const p1 = new THREE.Vector2(w.p1.x, w.p1.y);
      const p2 = new THREE.Vector2(w.p2.x, w.p2.y);
      const seg = new THREE.Vector2().subVectors(p2, p1);
      const segLenSq = seg.lengthSq();
      if (segLenSq < 0.0001) continue;

      const toTarget = new THREE.Vector2(orbitTarget.x - p1.x, orbitTarget.z - p1.y);
      const t = Math.max(0, Math.min(1, toTarget.dot(seg) / segLenSq));
      const proj = new THREE.Vector2().copy(p1).addScaledVector(seg, t);
      const distSq = proj.distanceToSquared(new THREE.Vector2(orbitTarget.x, orbitTarget.z));

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestWall = w;
        closestPt = proj;
      }
    }

    if (closestWall) {
      const dx = closestWall.p2.x - closestWall.p1.x;
      const dy = closestWall.p2.y - closestWall.p1.y;
      const worldNormal = new THREE.Vector3(-dy, 0, dx).normalize();
      const toCam = new THREE.Vector3(
        this.activeCamera.position.x - closestPt.x,
        0,
        this.activeCamera.position.z - closestPt.y
      ).normalize();
      if (worldNormal.dot(toCam) < 0) {
        worldNormal.negate();
      }

      return {
        wall: closestWall,
        point: new THREE.Vector3(closestPt.x, 1.35, closestPt.y),
        normal: worldNormal,
      };
    }

    return null;
  }

  resetCamera(): void {
    this.invalidate();
    if (!this.controls) return;
    this.controls.target.set(0, 0, 0);
    this.perspectiveCamera.position.set(0, 12, 16);
    this.controls.update();
  }
  private fitPlanInView(): void { this.cameraFocus.fitPlanInView(); }


  private updateCameraAspect(): void {
    this.invalidate();
    if (!this.container || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    const frustumHeight = (this.orthographicCamera.top - this.orthographicCamera.bottom);
    this.orthographicCamera.left = (-frustumHeight * aspect) / 2;
    this.orthographicCamera.right = (frustumHeight * aspect) / 2;
    this.orthographicCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  private renderFrame(dt: number): void {
    this.selectionHelper?.update(); this.wallSelectionHelper?.update(); this.openingSelectionHelper?.update();
    const tempDir = new THREE.Vector3();
    if (this.cameraNavController) {
      this.cameraNavController.update(dt);
    }

    if (this.controls && this.interactionEnabled) {
      this.controls.update();
      if (this.settings.viewMode === 'perspective') {
        // Dynamic camera-to-orbit transparency:
        // Vector from orbit center towards camera in horizontal plane (XZ):
        tempDir.subVectors(this.perspectiveCamera.position, this.controls.target);
        tempDir.y = 0;
        if (tempDir.lengthSq() > 0.0001) {
          tempDir.normalize();
        } else {
          tempDir.set(0, 0, 1);
        }
        this.wallBuilder.materials.updateOrbitPlane(this.controls.target, tempDir);
        this.openingBuilder.updateOrbitPlane(this.controls.target, tempDir);
        this.furnitureBuilder.updateOrbitPlane(this.controls.target, tempDir);
        this.finishService.updateOrbitPlane(this.controls.target, tempDir);
      }
    }
    if (this.renderer) {
      this.renderer.render(this.scene, this.activeCamera);
    }
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.Camera {
    return this.activeCamera;
  }

  getDomElement(): HTMLElement | null {
    return this.renderer ? this.renderer.domElement : null;
  }

  getControls(): OrbitControls | null {
    return this.controls;
  }

  getRenderObject(id: string): THREE.Group | undefined { return this.graph.get(id)?.group; }
  getTransformTarget(id: string): THREE.Object3D | undefined {
    const node = this.graph.get(id);
    if (!node) return undefined;
    return node.model instanceof Opening ? this.openingBuilder.interactionTarget(node.group.children[0]) : node.group;
  }

  pick(point: THREE.Vector2) {
    return this.picker.pick(point, this.activeCamera, hit => !this.isPointForegroundOccluded(hit.point));
  }

  isPointForegroundOccluded(worldPoint: THREE.Vector3): boolean {
    if (this.settings.viewMode !== 'perspective' || this.settings.foregroundOcclusionMode === 'off') {
      return false;
    }
    if (!this.controls) return false;
    const orbitCenter = this.controls.target;
    const cameraToOrbitDir = new THREE.Vector3()
      .subVectors(this.perspectiveCamera.position, orbitCenter);
    cameraToOrbitDir.y = 0;
    if (cameraToOrbitDir.lengthSq() > 0.0001) {
      cameraToOrbitDir.normalize();
    } else {
      cameraToOrbitDir.set(0, 0, 1);
    }
    const delta = worldPoint.clone().sub(orbitCenter);
    delta.y = 0;
    const dotDist = delta.dot(cameraToOrbitDir);
    return dotDist > (this.settings.foregroundOcclusionMode === 'clip' ? 0.1 : 0.35);
  }
}
