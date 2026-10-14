import * as THREE from 'three';
import { intersectVisibleObjects } from '@services/interaction/VisibleRaycast';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PlanDocument, FurnitureEntity, OpeningEntity, WallEntity, SurfaceFinishConfig, RoomEntity } from '@core/types/plan';
import { ISceneService, ViewMode, ViewportSettings, IAssetRegistryService, ISurfaceFinishService } from '@core/types/services';
import { WallGeometryService } from './WallGeometryService';
import { WallJunctionService } from './WallJunctionService';
import { OpeningGeometryService } from './OpeningGeometryService';
import { FloorGeometryService } from './FloorGeometryService';
import { CeilingGeometryService } from './CeilingGeometryService';
import { SurfaceFinishService } from './SurfaceFinishService';
import { CameraNavigationController } from './CameraNavigationController';

export class ThreeSceneService implements ISceneService {
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
  private furnitureMeshMap = new Map<string, THREE.Object3D>();
  private openingMeshMap = new Map<string, THREE.Group>();
  private wallMeshMap = new Map<string, THREE.Group>();
  private floorMeshMap = new Map<string, THREE.Group>();
  private currentPlan: PlanDocument | null = null;

  private finishService: SurfaceFinishService;
  private wallGeometryService: WallGeometryService;
  private openingGeometryService: OpeningGeometryService;
  private floorGeometryService: FloorGeometryService;
  private ceilingGeometryService: CeilingGeometryService;

  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private topLight!: THREE.DirectionalLight;

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

  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private assetRegistry: IAssetRegistryService,
    finishService?: ISurfaceFinishService
  ) {
    this.finishService = finishService as SurfaceFinishService;
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

    this.wallGeometryService = new WallGeometryService(this.finishService);
    this.openingGeometryService = new OpeningGeometryService(this.finishService);
    this.floorGeometryService = new FloorGeometryService(this.finishService);
    this.ceilingGeometryService = new CeilingGeometryService(this.finishService);

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

    this.setupLighting();
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
    this.controls.enableDamping = false; // Immediate stop on pointer release - zero momentum!
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't dip below floor
    this.controls.minDistance = 1;
    this.controls.maxDistance = 60;
    this.controls.target.set(0, 0, 0);

    this.cameraNavController = new CameraNavigationController(
      this.perspectiveCamera,
      this.orthographicCamera,
      () => this.controls,
      () => this.settings.viewMode
    );
    this.cameraNavController.attach();

    this.updateCameraAspect();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCameraAspect();
    });
    this.resizeObserver.observe(container);

    this.startAnimationLoop();
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    if (this.controls) this.controls.enabled = enabled;
    if (enabled) this.cameraNavController?.attach();
    else this.cameraNavController?.detach();
  }

  dispose(): void {
    if (this.cameraNavController) {
      this.cameraNavController.dispose();
      this.cameraNavController = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
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

  private setupLighting(): void {
    // Soft Ambient
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    // Hemisphere sky/ground
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.4);
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    // Directional Sun Light
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    this.sunLight.position.set(15, 25, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 70;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    // Flat overhead fill light for 2D plan mode
    this.topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.topLight.position.set(0, 30, 0);
    this.topLight.visible = false;
    this.scene.add(this.topLight);

    // Architectural HDR RoomEnvironment for realistic PBR metal & vitreous china reflections
    if (this.renderer) {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
    }

    this.applyLightingSettings();
  }

  private setupGroundGrid(): void {
    // Subtle floor grid
    const grid = new THREE.GridHelper(50, 50, 0x475569, 0x1e293b);
    grid.position.y = -0.01;
    this.helpersGroup.add(grid);
  }

  rebuildWalls(plan: PlanDocument): void {
    this.currentPlan = plan;

    // Clear existing wall and opening meshes
    while (this.wallsGroup.children.length > 0) {
      this.wallsGroup.remove(this.wallsGroup.children[0]);
    }
    while (this.openingsGroup.children.length > 0) {
      this.openingsGroup.remove(this.openingsGroup.children[0]);
    }
    this.wallMeshMap.clear();
    this.openingMeshMap.clear();

    if (this.wallSelectionHelper) {
      this.helpersGroup.remove(this.wallSelectionHelper);
      this.wallSelectionHelper.dispose();
      this.wallSelectionHelper = null;
    }

    if (this.openingSelectionHelper) {
      this.helpersGroup.remove(this.openingSelectionHelper);
      this.openingSelectionHelper = null;
    }

    this.hideWallSplitPreview();

    const cutawayH = this.settings.wallCutaway ? 1.15 : undefined;

    // Columns are ordinary thick walls; include them in junctions and selection.
    WallJunctionService.computeJunctionOffsets(plan.walls);

    for (const wall of plan.walls) {
      const wallCutouts = undefined;
      const recessHoles = this.getRecessHolesForWall(wall);
      const wallMeshGroup = this.wallGeometryService.buildWall(wall, cutawayH, wallCutouts, recessHoles);
      this.wallsGroup.add(wallMeshGroup);
      this.wallMeshMap.set(wall.id, wallMeshGroup);

      for (const op of wall.openings) {
        // If cutaway is active, only render opening if it starts below cutaway
        if (cutawayH !== undefined && op.floorHeight >= cutawayH) continue;
        const opMesh = this.openingGeometryService.buildOpening(op, wall);
        this.openingsGroup.add(opMesh);
        this.openingMeshMap.set(op.id, opMesh);
      }
    }

    this.applyVisibilitySettings();
  }

  renderPlan(plan: PlanDocument): void {
    this.currentPlan = plan;
    this.clearPlanMeshes();
    this.rebuildWalls(plan);

    // Build Floors (only for walkable rooms with area >= 0.5 m²)
    this.floorMeshMap.clear();
    for (const room of plan.rooms) {
      if (room.area >= 0.5) {
        const floorMesh = this.floorGeometryService.buildFloor(room, this.settings.showRoomLabels);
        this.floorsGroup.add(floorMesh);
        this.floorMeshMap.set(room.id, floorMesh);
      }
    }

    // Build Ceilings (default hidden, toggleable via Header button)
    const ceilingsGroup = this.ceilingGeometryService.buildCeilings(plan, this.settings.isolatedRoomIds);
    this.ceilingsGroup.add(ceilingsGroup);

    // Build Furniture
    for (const item of plan.furniture) {
      this.addOrUpdateFurnitureMesh(item);
    }

    this.applyVisibilitySettings();
    this.applyLightingSettings();
    this.fitPlanInView();
  }

  private clearPlanMeshes(): void {
    while (this.wallsGroup.children.length > 0) {
      this.wallsGroup.remove(this.wallsGroup.children[0]);
    }
    while (this.ceilingsGroup.children.length > 0) {
      this.ceilingsGroup.remove(this.ceilingsGroup.children[0]);
    }
    while (this.openingsGroup.children.length > 0) {
      this.openingsGroup.remove(this.openingsGroup.children[0]);
    }
    while (this.floorsGroup.children.length > 0) {
      this.floorsGroup.remove(this.floorsGroup.children[0]);
    }
    while (this.furnitureGroup.children.length > 0) {
      this.furnitureGroup.remove(this.furnitureGroup.children[0]);
    }
    while (this.fixturesGroup.children.length > 0) {
      this.fixturesGroup.remove(this.fixturesGroup.children[0]);
    }
    this.wallMeshMap.clear();
    this.floorMeshMap.clear();
    this.furnitureMeshMap.clear();
    this.openingMeshMap.clear();
    if (this.selectionHelper) {
      this.helpersGroup.remove(this.selectionHelper);
      this.selectionHelper = null;
    }
    if (this.openingSelectionHelper) {
      this.helpersGroup.remove(this.openingSelectionHelper);
      this.openingSelectionHelper = null;
    }
    if (this.wallSelectionHelper) {
      this.helpersGroup.remove(this.wallSelectionHelper);
      this.wallSelectionHelper.dispose();
      this.wallSelectionHelper = null;
    }

    if (this.floorSelectionHelper) {
      this.helpersGroup.remove(this.floorSelectionHelper);
      this.floorSelectionHelper.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry?.dispose();
        }
      });
      this.floorSelectionHelper = null;
    }
  }

  private applyFurnitureFinishes(mesh: THREE.Object3D, entity: FurnitureEntity): void {
    if (!this.finishService) return;

    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        // Tag section if not already tagged
        if (!child.userData.section) {
          const matSec = (child.material as any)?.__section as string | undefined;
          if (matSec) {
            child.userData.section = matSec.charAt(0).toUpperCase() + matSec.slice(1);
          }
        }
        // Remember original default material
        if (!child.userData.defaultMaterial) {
          child.userData.defaultMaterial = child.material;
        }

        const sec = child.userData.section as string | undefined;
        if (sec === 'Screen') return;

        const isRecess =
          entity.assetKey === 'wall_recess' ||
          entity.assetKey === 'recess' ||
          entity.assetKey === 'girinti';

        // Check for section finish override (case-insensitive)
        let secFinish: SurfaceFinishConfig | undefined;
        if (sec && entity.sectionFinishes) {
          secFinish =
            entity.sectionFinishes[sec] ||
            entity.sectionFinishes[sec.toLowerCase()] ||
            (sec === 'Recess Wall' || sec === 'recess_wall'
              ? entity.sectionFinishes['recess_wall'] ||
                entity.sectionFinishes['girinti_wall'] ||
                entity.sectionFinishes['Girinti Wall']
              : undefined) ||
            (sec === 'Sides' || sec === 'sides' || sec === 'Corners' || sec === 'corners'
              ? entity.sectionFinishes['sides'] ||
                entity.sectionFinishes['Sides'] ||
                entity.sectionFinishes['corners'] ||
                entity.sectionFinishes['Corners'] ||
                entity.sectionFinishes['recess_sides'] ||
                entity.sectionFinishes['Recess Sides']
              : undefined) ||
            Object.entries(entity.sectionFinishes).find(
              ([k]) => k.toLowerCase() === sec.toLowerCase()
            )?.[1];
        }

        if (!secFinish && isRecess) {
          const wall = this.findWallForRecess(entity);
          if (wall) {
            if (sec === 'Back' || sec === 'back') {
              secFinish = wall.finishSideB || wall.finish;
            } else if (sec === 'Sides' || sec === 'Corners' || sec === 'sides' || sec === 'corners') {
              secFinish = wall.finishEdges || wall.finishSideA || wall.finish;
            } else if (sec === 'Recess Wall' || sec === 'recess_wall') {
              secFinish = wall.finishSideA || wall.finish;
            }
          }
        }

        if (secFinish) {
          if (secFinish.type === 'fabric') {
            const isLinen = secFinish.variant?.includes('linen');
            const isStretched = secFinish.mappingMode === 'stretched'
              ? true
              : secFinish.mappingMode === 'tiled'
                ? false
                : !isLinen;

            if (isStretched) {
              this.finishService!.ensureStretchedUvs?.(child);
            } else {
              this.finishService!.ensureLocalMetricBounds?.(child);
            }
          } else {
            this.finishService!.ensureLocalMetricBounds?.(child);
          }
          const mat = this.finishService!.getMaterial(secFinish, {
            projection: 'local',
            side: isRecess ? THREE.DoubleSide : undefined,
          });
          child.material = mat;
          child.visible = !(mat as any).isInvisible && (mat as any).visible !== false;
        } else if (entity.finish) {
          if (child.userData.isLightEmissive || sec === 'Diffuser' || sec === 'Lens' || sec === 'Bulb') {
            return;
          }
          if (entity.finish.type === 'fabric') {
            const isLinen = entity.finish.variant?.includes('linen');
            const isStretched = entity.finish.mappingMode === 'stretched'
              ? true
              : entity.finish.mappingMode === 'tiled'
                ? false
                : !isLinen;

            if (isStretched) {
              this.finishService!.ensureStretchedUvs?.(child);
            } else {
              this.finishService!.ensureLocalMetricBounds?.(child);
            }
          } else {
            this.finishService!.ensureLocalMetricBounds?.(child);
          }
          const mat = this.finishService!.getMaterial(entity.finish, {
            projection: 'local',
            side: isRecess ? THREE.DoubleSide : undefined,
          });
          child.material = mat;
          child.visible = !(mat as any).isInvisible && (mat as any).visible !== false;
        } else if (child.userData.defaultMaterial) {
          child.material = child.userData.defaultMaterial;
          child.visible = true;
        }
      }
    });
  }

  private addOrUpdateFurnitureMesh(item: FurnitureEntity): void {
    const existing = this.furnitureMeshMap.get(item.id);
    if (existing) {
      this.furnitureGroup.remove(existing);
      this.fixturesGroup.remove(existing);
      this.furnitureMeshMap.delete(item.id);
    }

    // Ensure wall recess has parent wall thickness metadata for non-protruding flush alignment
    const isRecess =
      item.assetKey === 'wall_recess' ||
      item.assetKey === 'recess' ||
      item.assetKey === 'girinti';
    if (isRecess) {
      const wall = this.findWallForRecess(item);
      if (wall) {
        if (!item.rawItem) item.rawItem = {};
        item.rawItem.wallThickness = wall.thickness;
        item.rawItem.wallId = wall.id;
        if (item.dimensions.z < 0.05) {
          item.dimensions.z = Math.max(0.08, wall.thickness || 0.10);
        }
        // Snap recess position to wall centerline to ensure perfect alignment with wall cutout
        const dx = wall.p2.x - wall.p1.x;
        const dz = wall.p2.y - wall.p1.y;
        const lenSq = dx * dx + dz * dz;
        if (lenSq > 0.001) {
          const t = Math.max(0.02, Math.min(0.98, ((item.position.x - wall.p1.x) * dx + (item.position.z - wall.p1.y) * dz) / lenSq));
          item.position.x = wall.p1.x + t * dx;
          item.position.z = wall.p1.y + t * dz;
        }
      }
    }

    const mesh = this.assetRegistry.createMesh(item);

    // Apply finishes directly to the mesh
    this.applyFurnitureFinishes(mesh, item);

    mesh.position.set(item.position.x, item.position.y, item.position.z);
    mesh.rotation.y = item.rotationY;

    // Save dimension & assetKey snapshot for future change detection
    mesh.userData.prevDimensions = { ...item.dimensions };
    mesh.userData.prevAssetKey = item.assetKey;
    mesh.userData.prevHasLids = item.hasLids;
    mesh.userData.entity = item;

    // Apply lighting directly to the mesh
    this.applyFurnitureLighting(mesh, item);

    this.furnitureMeshMap.set(item.id, mesh);

    if (item.category === 'fixture') {
      this.fixturesGroup.add(mesh);
    } else {
      this.furnitureGroup.add(mesh);
    }
  }

  private applyFurnitureLighting(mesh: THREE.Object3D, entity?: FurnitureEntity): void {
    const config = entity?.lightConfig;
    const isEnabled = config?.enabled !== false;
    const customIntensity = config?.intensity ?? 1.0;
    const customColor = config?.color;

    mesh.traverse((child) => {
      // 1. Fixture Point Lights
      if ((child as any).isPointLight && child.userData?.isFixtureLight) {
        const pointLight = child as THREE.PointLight;
        const fixtureType = child.userData.fixtureType as 'chandelier' | 'spot' | undefined;
        const typeMult = fixtureType === 'chandelier'
          ? (this.settings.chandelierIntensity ?? 1.0)
          : (this.settings.spotLightIntensity ?? 1.0);

        const baseInt = child.userData.baseIntensity ?? 0.8;
        const baseDist = child.userData.baseDistance ?? 5.0;
        const baseColor = child.userData.baseColor ?? 0xfff2dc;

        if (isEnabled && typeMult > 0 && customIntensity > 0) {
          const finalIntensity = baseInt * typeMult * customIntensity;
          pointLight.intensity = finalIntensity;
          pointLight.distance = baseDist * Math.sqrt(Math.max(0.2, typeMult * customIntensity));
          if (customColor) {
            pointLight.color.set(customColor);
          } else {
            pointLight.color.set(baseColor);
          }
          pointLight.visible = true;
        } else {
          pointLight.intensity = 0;
          pointLight.visible = false;
        }
      }

      // 2. Glowing Diffusers / Lenses / Bulbs (isLightEmissive)
      if (child instanceof THREE.Mesh && child.userData?.isLightEmissive) {
        const fixtureType = (mesh.userData?.prevAssetKey || entity?.assetKey || '').toLowerCase().includes('chandelier')
          ? 'chandelier'
          : 'spot';
        const typeMult = fixtureType === 'chandelier'
          ? (this.settings.chandelierIntensity ?? 1.0)
          : (this.settings.spotLightIntensity ?? 1.0);

        const isLit = isEnabled && typeMult > 0.05 && customIntensity > 0.05;
        if (child.material && 'color' in child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          if (isLit) {
            if (customColor) {
              mat.color.set(customColor);
            } else {
              mat.color.set(0xfff6dd); // warm golden white glow
            }
          } else {
            mat.color.set(0x334155); // dark slate off-bulb
          }
        }
      }
    });
  }

  private applyLightingSettings(): void {
    if (!this.ambientLight || !this.sunLight || !this.hemiLight || !this.topLight) return;

    const isTopDown = this.settings.viewMode === 'topDown';
    const globalOn = this.settings.globalLighting;
    const globalMultiplier = this.settings.globalLightIntensity ?? 1.0;

    if (!globalOn || globalMultiplier <= 0.001) {
      // Global lighting turned OFF (Night Interior Mode):
      this.sunLight.intensity = 0.0;
      this.sunLight.castShadow = false;
      this.hemiLight.intensity = 0.0;
      this.topLight.visible = false;
      // Soft dark night ambient baseline so unlit corners have subtle visual depth
      this.ambientLight.intensity = 0.02 * Math.max(0.1, globalMultiplier);
      if ('environmentIntensity' in this.scene) {
        (this.scene as any).environmentIntensity = 0.03;
      }
    } else {
      // Global lighting ON:
      if (isTopDown) {
        this.sunLight.castShadow = false;
        this.sunLight.intensity = 0.0;
        this.ambientLight.intensity = 1.6 * globalMultiplier;
        this.hemiLight.intensity = 0.8 * globalMultiplier;
        this.topLight.visible = true;
        this.topLight.intensity = 0.8 * globalMultiplier;
      } else {
        this.sunLight.castShadow = true;
        this.sunLight.intensity = 1.4 * globalMultiplier;
        this.ambientLight.intensity = 0.7 * globalMultiplier;
        this.hemiLight.intensity = 0.4 * globalMultiplier;
        this.topLight.visible = false;
      }
      if ('environmentIntensity' in this.scene) {
        (this.scene as any).environmentIntensity = 0.8 * globalMultiplier;
      }
    }

    // Update all fixture lights across the scene
    this.furnitureMeshMap.forEach((mesh) => {
      const entity = mesh.userData.entity as FurnitureEntity | undefined;
      this.applyFurnitureLighting(mesh, entity);
    });
  }

  getFurnitureSections(id: string): string[] {
    const mesh = this.furnitureMeshMap.get(id);
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
        if (sec && sec !== 'Screen') sections.add(sec);
      }
    });
    return Array.from(sections);
  }

  updateFurnitureObject(entity: FurnitureEntity): void {
    const mesh = this.furnitureMeshMap.get(entity.id);
    if (mesh) {
      const isRecess =
        entity.assetKey === 'wall_recess' ||
        entity.assetKey === 'recess' ||
        entity.assetKey === 'girinti';
      if (isRecess) {
        const wall = this.findWallForRecess(entity);
        if (wall) {
          const dx = wall.p2.x - wall.p1.x;
          const dz = wall.p2.y - wall.p1.y;
          const lenSq = dx * dx + dz * dz;
          if (lenSq > 0.001) {
            const t = Math.max(0.02, Math.min(0.98, ((entity.position.x - wall.p1.x) * dx + (entity.position.z - wall.p1.y) * dz) / lenSq));
            entity.position.x = wall.p1.x + t * dx;
            entity.position.z = wall.p1.y + t * dz;
          }
        }
      }
      mesh.position.set(entity.position.x, entity.position.y, entity.position.z);
      mesh.rotation.y = entity.rotationY;
      mesh.userData.entity = entity;

      // Rebuild mesh ONLY if assetKey or dimensions changed
      const prevDims = mesh.userData.prevDimensions;
      const dimsChanged =
        !prevDims ||
        prevDims.x !== entity.dimensions.x ||
        prevDims.y !== entity.dimensions.y ||
        prevDims.z !== entity.dimensions.z;
      const assetKeyChanged = mesh.userData.prevAssetKey !== entity.assetKey;
      const lidsChanged = mesh.userData.prevHasLids !== entity.hasLids;

      if (assetKeyChanged || dimsChanged || lidsChanged) {
        this.addOrUpdateFurnitureMesh(entity);
      } else {
        // Instantly update finishes and lighting on the existing mesh in-place!
        this.applyFurnitureFinishes(mesh, entity);
        this.applyFurnitureLighting(mesh, entity);
      }
    } else {
      this.addOrUpdateFurnitureMesh(entity);
    }

    // If entity is a wall recess, keep the wall cutout cavity synchronized!
    const isRecess =
      entity.assetKey === 'wall_recess' ||
      entity.assetKey === 'recess' ||
      entity.assetKey === 'girinti';
    if (isRecess) {
      const wall = this.findWallForRecess(entity);
      if (wall) {
        this.updateWallFinish(wall);
      }
    }

    if (this.selectionHelper && this.selectionHelper.userData.id === entity.id) {
      const currentMesh = this.furnitureMeshMap.get(entity.id);
      if (currentMesh) {
        this.selectionHelper.update();
      }
    }
  }

  findWallForRecess(rec: FurnitureEntity): WallEntity | null {
    if (!this.currentPlan) return null;
    let closestWall: WallEntity | null = null;
    let closestDist = Infinity;

    for (const wall of this.currentPlan.walls) {
      const p1x = wall.p1.x;
      const p1z = wall.p1.y;
      const p2x = wall.p2.x;
      const p2z = wall.p2.y;
      const dx = p2x - p1x;
      const dz = p2z - p1z;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 0.002) continue;

      const t = ((rec.position.x - p1x) * dx + (rec.position.z - p1z) * dz) / lenSq;
      if (t < -0.15 || t > 1.15) continue;

      const projX = p1x + t * dx;
      const projZ = p1z + t * dz;
      const dist = Math.hypot(rec.position.x - projX, rec.position.z - projZ);
      const maxDist = (wall.thickness || 0.1) / 2 + 0.35;
      if (dist < maxDist && dist < closestDist) {
        closestDist = dist;
        closestWall = wall;
      }
    }
    return closestWall;
  }

  getRecessHolesForWall(
    wall: WallEntity
  ): { start: number; end: number; floorHeight: number; topHeight: number }[] {
    const holes: { start: number; end: number; floorHeight: number; topHeight: number }[] = [];

    // 1. Native pinned wall cavities
    if (wall.cavities && wall.cavities.length > 0) {
      for (const cav of wall.cavities) {
        holes.push({
          start: cav.distanceAlongWall - cav.width / 2,
          end: cav.distanceAlongWall + cav.width / 2,
          floorHeight: cav.floorElevation,
          topHeight: cav.floorElevation + cav.height,
        });
      }
    }

    if (!this.currentPlan) return holes;
    const recesses = this.currentPlan.furniture.filter(
      (f) =>
        f.visible !== false &&
        (f.assetKey === 'wall_recess' ||
          f.assetKey === 'recess' ||
          f.assetKey === 'girinti')
    );
    if (recesses.length === 0) return holes;

    const p1x = wall.p1.x;
    const p1z = wall.p1.y;
    const p2x = wall.p2.x;
    const p2z = wall.p2.y;
    const dx = p2x - p1x;
    const dz = p2z - p1z;
    const lenSq = dx * dx + dz * dz;
    const len = Math.sqrt(lenSq);
    if (len < 0.05) return holes;

    const maxDist = (wall.thickness || 0.1) / 2 + 0.25;

    for (const rec of recesses) {
      const rx = rec.position.x;
      const rz = rec.position.z;

      const t = ((rx - p1x) * dx + (rz - p1z) * dz) / lenSq;
      if (t < -0.1 || t > 1.1) continue;

      const projX = p1x + t * dx;
      const projZ = p1z + t * dz;
      const perpDist = Math.hypot(rx - projX, rz - projZ);
      if (perpDist > maxDist) continue;

      const distAlong = t * len;
      const halfW = (rec.dimensions?.x || 1.2) / 2;
      const floorH = rec.position.y;
      const topH = floorH + (rec.dimensions?.y || 1.7);

      holes.push({
        start: distAlong - halfW,
        end: distAlong + halfW,
        floorHeight: floorH,
        topHeight: topH,
      });
    }

    return holes;
  }

  removeFurnitureObject(id: string): void {
    const mesh = this.furnitureMeshMap.get(id);
    const entity = mesh?.userData?.entity as FurnitureEntity | undefined;
    const isRecess =
      entity &&
      (entity.assetKey === 'wall_recess' ||
        entity.assetKey === 'recess' ||
        entity.assetKey === 'girinti');
    const wall = isRecess ? this.findWallForRecess(entity) : null;

    if (mesh) {
      this.furnitureGroup.remove(mesh);
      this.fixturesGroup.remove(mesh);
      this.furnitureMeshMap.delete(id);
    }
    if (this.selectionHelper?.userData.id === id) {
      this.helpersGroup.remove(this.selectionHelper);
      this.selectionHelper = null;
    }

    if (wall) {
      this.updateWallFinish(wall);
    }
  }

  setSelectionHighlight(entity: FurnitureEntity | null): void {
    if (this.selectionHelper) {
      this.helpersGroup.remove(this.selectionHelper);
      this.selectionHelper = null;
    }

    if (!entity) return;

    const mesh = this.furnitureMeshMap.get(entity.id);
    if (!mesh) return;

    this.selectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    this.selectionHelper.userData = { id: entity.id };
    this.helpersGroup.add(this.selectionHelper);
  }

  updateOpening(opening: OpeningEntity, wall: WallEntity): void {
    const existingMesh = this.openingMeshMap.get(opening.id);
    if (existingMesh) {
      this.openingsGroup.remove(existingMesh);
      existingMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
        }
      });
      this.openingMeshMap.delete(opening.id);
    }

    const cutawayH = this.settings.wallCutaway ? 1.15 : undefined;
    if (cutawayH !== undefined && opening.floorHeight >= cutawayH) return;

    const newMesh = this.openingGeometryService.buildOpening(opening, wall);
    this.openingsGroup.add(newMesh);
    this.openingMeshMap.set(opening.id, newMesh);

    if (this.openingSelectionHelper && this.openingSelectionHelper.userData.id === opening.id) {
      this.setOpeningSelectionHighlight({ opening, wall });
    }
  }

  setOpeningSelectionHighlight(selected: { opening: OpeningEntity; wall: WallEntity } | null): void {
    if (this.openingSelectionHelper) {
      this.helpersGroup.remove(this.openingSelectionHelper);
      this.openingSelectionHelper = null;
    }

    if (!selected) return;

    const mesh = this.openingMeshMap.get(selected.opening.id);
    if (!mesh) return;

    this.openingSelectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    this.openingSelectionHelper.userData = { id: selected.opening.id };
    this.helpersGroup.add(this.openingSelectionHelper);
  }

  focusOnOpening(opening: OpeningEntity, _wall: WallEntity): void {
    if (!this.controls) return;
    const mesh = this.openingMeshMap.get(opening.id);
    if (!mesh) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);
    this.controls.update();
  }

  updateWallFinish(wall: WallEntity): void {
    const existingMesh = this.wallMeshMap.get(wall.id);
    if (existingMesh) {
      this.wallsGroup.remove(existingMesh);
      existingMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
        }
      });
      this.wallMeshMap.delete(wall.id);
    }

    const cutawayH = this.settings.wallCutaway ? 1.15 : undefined;
    const recessHoles = this.getRecessHolesForWall(wall);
    const newMesh = this.wallGeometryService.buildWall(wall, cutawayH, undefined, recessHoles);
    this.wallsGroup.add(newMesh);
    this.wallMeshMap.set(wall.id, newMesh);

    if (this.wallSelectionHelper && (this.wallSelectionHelper as any).userData?.id === wall.id) {
      this.setWallSelectionHighlight(wall);
    }
  }

  setWallSelectionHighlight(wall: WallEntity | null): void {
    if (this.wallSelectionHelper) {
      this.helpersGroup.remove(this.wallSelectionHelper);
      this.wallSelectionHelper.dispose();
      this.wallSelectionHelper = null;
    }

    if (!wall) return;

    const mesh = this.wallMeshMap.get(wall.id);
    if (!mesh) return;

    this.wallSelectionHelper = new THREE.BoxHelper(mesh, 0x38bdf8); // sky blue highlight
    (this.wallSelectionHelper as any).userData = { id: wall.id };
    this.helpersGroup.add(this.wallSelectionHelper);
  }

  focusOnWall(wall: WallEntity): void {
    if (!this.controls) return;
    const mesh = this.wallMeshMap.get(wall.id);
    if (!mesh) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);
    this.controls.update();
  }

  updateRoomFloorFinish(room: RoomEntity): void {
    const existing = this.floorMeshMap.get(room.id);
    if (existing) {
      this.floorsGroup.remove(existing);
      existing.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
        }
      });
      this.floorMeshMap.delete(room.id);
    }

    if (room.area >= 0.5) {
      const newMesh = this.floorGeometryService.buildFloor(room, this.settings.showRoomLabels);
      this.floorsGroup.add(newMesh);
      this.floorMeshMap.set(room.id, newMesh);
    }

    if (this.floorSelectionHelper && (this.floorSelectionHelper as any).userData?.id === room.id) {
      this.setFloorSelectionHighlight(room);
    }
  }

  setFloorSelectionHighlight(room: RoomEntity | null): void {
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
    this.settings.showCeiling = !this.settings.showCeiling;
    this.applyVisibilitySettings();
    return this.settings.showCeiling;
  }

  getShowCeilings(): boolean {
    return this.settings.showCeiling;
  }

  setViewMode(mode: ViewMode): void {
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

      // 2D Plan Cel-Shading Mode:
      // Disable harsh diagonal sun shadows, enable bright architectural cel lighting
      if (this.sunLight) this.sunLight.castShadow = false;
      if (this.ambientLight) this.ambientLight.intensity = 1.6;
      if (this.hemiLight) this.hemiLight.intensity = 0.8;
      if (this.topLight) this.topLight.visible = true;

      // Enable crisp black cel outlines
      this.wallGeometryService.setCelShading(true);
      this.assetRegistry.setCelShading(true);
      this.wallGeometryService.setForegroundMode('off');
      this.openingGeometryService.setForegroundMode('off');
      this.assetRegistry.setForegroundMode('off');
      this.finishService.setForegroundMode('off');
    } else {
      this.activeCamera = this.perspectiveCamera;
      if (this.controls) {
        this.controls.object = this.perspectiveCamera;
        this.controls.enableRotate = true;
        this.controls.update();
      }

      this.wallGeometryService.setCelShading(false);
      this.assetRegistry.setCelShading(false);
      this.wallGeometryService.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.openingGeometryService.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.assetRegistry.setForegroundMode(this.settings.foregroundOcclusionMode);
      this.finishService.setForegroundMode(this.settings.foregroundOcclusionMode);
    }

    this.applyLightingSettings();
    this.updateCameraAspect();
  }

  updateSettings(settings: Partial<ViewportSettings>): void {
    const prevCutaway = this.settings.wallCutaway;
    this.settings = { ...this.settings, ...settings };

    if (settings.wallCutaway !== undefined && settings.wallCutaway !== prevCutaway) {
      // Rebuild walls with/without cutaway
      if (this.currentPlan) {
        this.renderPlan(this.currentPlan);
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
    const isoIds = this.settings.isolatedRoomIds;
    const isIso = isoIds.length > 0;

    // Floors: show only selected rooms' floors
    this.floorsGroup.visible = this.settings.showFloor;
    for (const child of this.floorsGroup.children) {
      if (isIso) {
        child.visible = isoIds.includes(child.userData?.id);
      } else {
        child.visible = true;
      }
    }

    // Ceilings: show only when showCeiling is true; if isolated, show only selected rooms' ceilings
    this.ceilingsGroup.visible = this.settings.showCeiling;
    if (this.ceilingsGroup.visible) {
      for (const child of this.ceilingsGroup.children) {
        if (isIso) {
          child.visible = isoIds.includes(child.userData?.id);
        } else {
          child.visible = true;
        }
      }
    }

    // Furniture: show only furniture belonging to any selected room
    this.furnitureGroup.visible = this.settings.showFurniture;
    for (const child of this.furnitureGroup.children) {
      const ent = child.userData?.entity as FurnitureEntity | undefined;
      if (isIso) {
        child.visible = ent?.roomId ? isoIds.includes(ent.roomId) : false;
      } else {
        child.visible = true;
      }
    }

    // Fixtures: same as furniture
    this.fixturesGroup.visible = this.settings.showFixtures;
    for (const child of this.fixturesGroup.children) {
      const ent = child.userData?.entity as FurnitureEntity | undefined;
      if (isIso) {
        child.visible = ent?.roomId ? isoIds.includes(ent.roomId) : false;
      } else {
        child.visible = true;
      }
    }

    // Walls & Openings: show walls that border ANY selected room
    this.wallsGroup.visible = this.settings.showWalls;
    this.openingsGroup.visible = this.settings.showWalls;

    const visibleWallIds = new Set<string>();
    if (this.currentPlan) {
      for (const w of this.currentPlan.walls) {
        if (!isIso || (w.roomIds && w.roomIds.some((rid) => isoIds.includes(rid)))) {
          visibleWallIds.add(w.id);
        }
      }
    }

    for (const child of this.wallsGroup.children) {
      child.visible = visibleWallIds.has(child.userData?.id);
    }

    for (const child of this.openingsGroup.children) {
      const opId = child.name.replace('opening_', '');
      const op = this.currentPlan?.walls.flatMap((w) => w.openings).find((o) => o.id === opId);
      child.visible = op ? visibleWallIds.has(op.wallId) : true;
    }

    const fgMode = this.settings.viewMode === 'topDown' ? 'off' : this.settings.foregroundOcclusionMode;
    this.wallGeometryService.setForegroundMode(fgMode);
    this.openingGeometryService.setForegroundMode(fgMode);
    this.assetRegistry.setForegroundMode(fgMode);
    this.finishService.setForegroundMode(fgMode);
    this.wallGeometryService.setWallOpacity(this.settings.wallOpacity);
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

  focusOnRoom(roomId: string): void {
    if (!this.currentPlan || !this.controls) return;
    const room = this.currentPlan.rooms.find((r) => r.id === roomId);
    if (!room || room.polygon.length < 3) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of room.polygon) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.y);
      maxZ = Math.max(maxZ, p.y);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanZ, 2.8);

    this.controls.target.set(centerX, 0.8, centerZ);
    this.perspectiveCamera.position.set(centerX, maxSpan * 1.15, centerZ + maxSpan * 1.25);
    this.controls.update();
  }

  focusOnObject(
    id: string,
    options?: {
      frameDistance?: number;
      viewDirection?: THREE.Vector3;
    }
  ): void {
    const mesh = this.furnitureMeshMap.get(id);
    if (!mesh || !this.controls) return;

    this.controls.target.copy(mesh.position);

    if (options?.frameDistance) {
      const dist = options.frameDistance;
      let dir: THREE.Vector3;
      if (options.viewDirection && options.viewDirection.lengthSq() > 0.001) {
        dir = options.viewDirection.clone();
        dir.y = 0;
        dir.normalize();
      } else {
        dir = new THREE.Vector3().subVectors(this.perspectiveCamera.position, mesh.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) {
          dir.normalize();
        } else {
          dir.set(0, 0, 1);
        }
      }

      this.perspectiveCamera.position
        .copy(mesh.position)
        .addScaledVector(dir, dist)
        .add(new THREE.Vector3(0, 0.25, 0));
    }

    this.controls.update();
  }

  getWallInCameraView(): { wall: WallEntity; point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!this.currentPlan || !this.controls) return null;

    // 1. Raycast from camera center (crosshairs) into wallsGroup
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.02;

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
      raycaster.setFromCamera(new THREE.Vector2(sample.x, sample.y), this.activeCamera);
      const intersects = intersectVisibleObjects(raycaster, this.wallsGroup.children);

      for (const hit of intersects) {
        if (hit.object instanceof THREE.LineSegments) continue;
        if (this.isPointForegroundOccluded(hit.point)) continue;

        let curr: THREE.Object3D | null = hit.object;
        let wall: WallEntity | null = null;
        while (curr && curr !== this.wallsGroup && curr !== this.scene) {
          if (curr.userData?.wall) {
            wall = curr.userData.wall as WallEntity;
            break;
          }
          curr = curr.parent;
        }

        if (wall) {
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
    if (!this.controls) return;
    this.controls.target.set(0, 0, 0);
    this.perspectiveCamera.position.set(0, 12, 16);
    this.controls.update();
  }

  private fitPlanInView(): void {
    if (!this.currentPlan || !this.controls) return;

    // Compute bounding box
    const box = new THREE.Box3();
    for (const w of this.currentPlan.walls) {
      box.expandByPoint(new THREE.Vector3(w.p1.x, 0, w.p1.y));
      box.expandByPoint(new THREE.Vector3(w.p2.x, 0, w.p2.y));
    }

    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    this.controls.target.copy(center);

    const maxDim = Math.max(size.x, size.z);
    this.perspectiveCamera.position.set(center.x, maxDim * 0.9, center.z + maxDim * 1.05);

    // Update orthographic camera frustum
    const aspect = this.container ? this.container.clientWidth / this.container.clientHeight : 1;
    const frustum = maxDim * 1.2;
    this.orthographicCamera.left = (-frustum * aspect) / 2;
    this.orthographicCamera.right = (frustum * aspect) / 2;
    this.orthographicCamera.top = frustum / 2;
    this.orthographicCamera.bottom = -frustum / 2;
    this.orthographicCamera.updateProjectionMatrix();

    this.controls.update();
  }

  private updateCameraAspect(): void {
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

  private startAnimationLoop(): void {
    const tempDir = new THREE.Vector3();
    const clock = new THREE.Clock();

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

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
          this.wallGeometryService.updateOrbitPlane(this.controls.target, tempDir);
          this.openingGeometryService.updateOrbitPlane(this.controls.target, tempDir);
          this.assetRegistry.updateOrbitPlane(this.controls.target, tempDir);
          this.finishService.updateOrbitPlane(this.controls.target, tempDir);
        }
      }
      if (this.renderer) {
        this.renderer.render(this.scene, this.activeCamera);
      }
    };
    animate();
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
    return dotDist > 0.35;
  }
}
