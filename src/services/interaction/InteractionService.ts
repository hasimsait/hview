import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { IInteractionService, ISceneService, IPlanManagerService } from '@core/types/services';
import { FurnitureEntity, OpeningEntity, WallEntity, WallSide, RoomEntity } from '@core/types/plan';
import { intersectVisibleObjects } from '@services/interaction/VisibleRaycast';
import { ThreeSceneService } from '@services/rendering/ThreeSceneService';

export class InteractionService implements IInteractionService {
  private sceneService: ThreeSceneService | null = null;
  private planManager: IPlanManagerService | null = null;
  private transformControls: TransformControls | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private selectedObject: THREE.Object3D | null = null;
  private gizmoMode: 'translate' | 'rotate' = 'translate';
  private gizmoShowY = false;

  private pointerDownPos = { x: 0, y: 0 };
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor() {
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
  }

  initialize(sceneService: ISceneService, planManager: IPlanManagerService): void {
    this.sceneService = sceneService as ThreeSceneService;
    this.planManager = planManager;

    const domElement = this.sceneService.getDomElement();
    if (!domElement) return;

    // Setup TransformControls
    this.transformControls = new TransformControls(
      this.sceneService.getCamera(),
      domElement
    );
    this.transformControls.setMode(this.gizmoMode);
    this.transformControls.showY = false; // Only translate in X and Z on the floor!
    this.transformControls.space = 'world'; // World coordinates for reliable floor translation
    this.transformControls.size = 0.9;

    const controls = this.sceneService.getControls();
    this.transformControls.addEventListener('dragging-changed', (event) => {
      if (controls) {
        controls.enabled = !event.value;
      }
      // When dragging finishes, ensure final coordinates are committed
      if (!event.value && this.selectedObject && this.planManager) {
        const entity = this.selectedObject.userData.entity as FurnitureEntity | undefined;
        if (entity) {
          this.planManager.updateFurniture(entity.id, {
            position: {
              x: this.selectedObject.position.x,
              y: this.selectedObject.position.y,
              z: this.selectedObject.position.z,
            },
            rotationY: this.selectedObject.rotation.y,
          });
        } else if (this.selectedObject.name.startsWith('doorPivot_') || this.selectedObject.userData?.isDoor) {
          const selectedOp = this.planManager.getSelectedOpening();
          if (selectedOp) {
            const deg = Math.round((Math.abs(this.selectedObject.rotation.y) * 180) / Math.PI);
            this.planManager.setDoorAngle(selectedOp.opening.id, deg);
          }
        }
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (!this.selectedObject || !this.planManager) return;
      const entity = this.selectedObject.userData.entity as FurnitureEntity | undefined;
      if (!entity) return;

      if (this.gizmoMode === 'translate') {
        this.planManager.updateFurniture(entity.id, {
          position: {
            x: this.selectedObject.position.x,
            y: this.selectedObject.position.y,
            z: this.selectedObject.position.z,
          },
        });
      } else if (this.gizmoMode === 'rotate') {
        this.planManager.updateFurniture(entity.id, {
          rotationY: this.selectedObject.rotation.y,
        });
      }
    });

    this.sceneService.getScene().add(this.transformControls.getHelper());

    domElement.addEventListener('pointerdown', this.boundPointerDown);
    domElement.addEventListener('pointerup', this.boundPointerUp);

    // Listen to selection changes from plan manager
    this.planManager.onSelectionChange((selected) => {
      this.handleExternalSelection(selected);
    });

    this.planManager.onOpeningSelectionChange((selected) => {
      this.handleExternalOpeningSelection(selected);
    });

    this.planManager.onWallSelectionChange((selected) => {
      this.handleExternalWallSelection(selected);
    });

    this.planManager.onRoomSelectionChange((selected) => {
      this.handleExternalRoomSelection(selected);
    });

    // Listen to furniture updates (e.g. asset replacement or dimension resize creating a new mesh).
    // Always detach immediately to avoid "not part of scene graph" error when the mesh is rebuilt
    // before this listener fires. Re-attach on the next animation frame so the scene service has
    // had time to replace the old mesh with the new one regardless of listener registration order.
    // EXCEPTION: skip all of this while dragging — the objectChange event fires updateFurniture
    // during a drag, but the mesh is never rebuilt mid-drag, so detaching would break the gizmo.
    this.planManager.onFurnitureUpdated((entity) => {
      if (!this.selectedObject || this.selectedObject.userData?.id !== entity.id) return;

      // Don't interfere while gizmo is being dragged — only position/rotation update, no mesh rebuild
      if (this.transformControls?.dragging) return;

      // Detach immediately — old mesh may already be removed from scene
      if (this.transformControls) {
        this.transformControls.detach();
      }
      this.selectedObject = null;

      const entityId = entity.id;
      requestAnimationFrame(() => {
        if (!this.sceneService || !this.transformControls) return;
        const scene = this.sceneService.getScene();
        const furnitureGroup = scene.getObjectByName('furnitureGroup');
        const fixturesGroup = scene.getObjectByName('fixturesGroup');
        const newTarget =
          furnitureGroup?.children.find((c) => c.userData?.id === entityId) ||
          fixturesGroup?.children.find((c) => c.userData?.id === entityId);
        if (newTarget && newTarget.parent) {
          this.selectedObject = newTarget;
          this.transformControls.attach(newTarget);
          this.sceneService.setSelectionHighlight(entity);
        }
      });
    });
  }

  dispose(): void {
    const domElement = this.sceneService?.getDomElement();
    if (domElement) {
      domElement.removeEventListener('pointerdown', this.boundPointerDown);
      domElement.removeEventListener('pointerup', this.boundPointerUp);
    }
    if (this.transformControls) {
      this.transformControls.detach();
      this.transformControls.dispose();
    }
  }

  setGizmoMode(mode: 'translate' | 'rotate'): void {
    this.gizmoMode = mode;
    if (this.transformControls) {
      if (this.selectedObject && (this.selectedObject.name.startsWith('doorPivot_') || this.selectedObject.userData?.isDoor)) {
        this.transformControls.setMode('rotate');
        this.transformControls.space = 'local';
        this.transformControls.showX = false;
        this.transformControls.showY = true;
        this.transformControls.showZ = false;
        return;
      }
      this.transformControls.setMode(mode);
      if (mode === 'translate') {
        this.transformControls.space = 'world';
        this.transformControls.showX = true;
        this.transformControls.showY = this.gizmoShowY;
        this.transformControls.showZ = true;
      } else {
        this.transformControls.space = 'local';
        this.transformControls.showX = false;
        this.transformControls.showY = true;
        this.transformControls.showZ = false;
      }
    }
  }

  getGizmoMode(): 'translate' | 'rotate' {
    return this.gizmoMode;
  }

  setGizmoShowY(enabled: boolean): void {
    this.gizmoShowY = enabled;
    if (this.transformControls && this.gizmoMode === 'translate') {
      // Don't override door pivot Y handle
      if (this.selectedObject && (this.selectedObject.name.startsWith('doorPivot_') || this.selectedObject.userData?.isDoor)) {
        return;
      }
      this.transformControls.showY = enabled;
    }
  }

  getGizmoShowY(): boolean {
    return this.gizmoShowY;
  }

  private onPointerDown(e: PointerEvent): void {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    // Only count as click if pointer didn't drag (tolerance up to 8px for trackpad/mouse clicks)
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 8) return;

    if (!this.sceneService || !this.planManager) return;
    const domElement = this.sceneService.getDomElement();
    if (!domElement) return;

    // Do NOT select/deselect if interacting with the transform gizmo
    if (this.transformControls && (this.transformControls.axis !== null || this.transformControls.dragging)) {
      return;
    }

    const rect = domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.params.Line.threshold = 0.02; // Prevent 1m edge line capture
    this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());

    const scene = this.sceneService.getScene();
    const openingsGroup = scene.getObjectByName('openingsGroup');
    const furnitureGroup = scene.getObjectByName('furnitureGroup');
    const fixturesGroup = scene.getObjectByName('fixturesGroup');
    const wallsGroup = scene.getObjectByName('wallsGroup');
    const floorsGroup = scene.getObjectByName('floorsGroup');

    // Collect all candidate target objects across openings, furniture, fixtures, walls, and floors into a single raycast
    const candidateRoots: THREE.Object3D[] = [];
    if (openingsGroup && openingsGroup.visible) candidateRoots.push(...openingsGroup.children);
    if (furnitureGroup && furnitureGroup.visible) candidateRoots.push(...furnitureGroup.children);
    if (fixturesGroup && fixturesGroup.visible) candidateRoots.push(...fixturesGroup.children);
    if (wallsGroup && wallsGroup.visible) candidateRoots.push(...wallsGroup.children);
    if (floorsGroup && floorsGroup.visible) candidateRoots.push(...floorsGroup.children);

    const intersects = intersectVisibleObjects(this.raycaster, candidateRoots);

    for (const intersect of intersects) {
      // 1. Skip edge outlines (LineSegments) so they don't block clicking actual surfaces
      if (intersect.object instanceof THREE.LineSegments) continue;

      // 2. Skip foreground surfaces that are transparent/clipped by foreground occlusion
      if (this.sceneService.isPointForegroundOccluded(intersect.point)) {
        continue;
      }

      const hitPoint = intersect.point;
      const obj = intersect.object;

      // Check if it's a door / opening
      let foundDoorOpening: { opening: OpeningEntity; wall: WallEntity } | null = null;
      let curr: THREE.Object3D | null = obj;
      while (curr && curr !== openingsGroup && curr !== scene) {
        if (curr.userData?.isDoor && curr.userData?.opening && curr.userData?.wall) {
          foundDoorOpening = {
            opening: curr.userData.opening,
            wall: curr.userData.wall,
          };
          break;
        }
        curr = curr.parent;
      }
      if (foundDoorOpening) {
        this.planManager.setSelectedFurniture(null);
        this.planManager.setSelectedWall(null);
        this.planManager.setSelectedOpening(foundDoorOpening);
        return;
      }

      // Check if it's furniture or fixture
      let foundEntity: FurnitureEntity | null = null;
      let clickedSection = 'all';
      curr = obj;
      while (curr && curr !== furnitureGroup && curr !== fixturesGroup && curr !== scene) {
        if (curr.userData?.section && clickedSection === 'all') {
          clickedSection = curr.userData.section;
        }
        if (curr.userData?.entity) {
          foundEntity = curr.userData.entity as FurnitureEntity;
          break;
        }
        curr = curr.parent;
      }
      if (foundEntity) {
        if (obj.userData?.section) {
          clickedSection = obj.userData.section;
        }
        this.planManager.setSelectedOpening(null);
        this.planManager.setSelectedWall(null);
        this.planManager.setSelectedFurniture(foundEntity, clickedSection);
        return;
      }

      // Check if it's a wall or opening attached to a wall (e.g. window frame/mullion)
      let foundWall: WallEntity | null = null;
      let wallMesh: THREE.Object3D | null = null;
      curr = obj;
      while (curr && curr !== wallsGroup && curr !== openingsGroup && curr !== scene) {
        if (curr.userData?.wall) {
          foundWall = curr.userData.wall as WallEntity;
          wallMesh = curr;
          break;
        }
        curr = curr.parent;
      }
      if (foundWall && wallMesh) {
        if (obj.userData?.section === 'baseboard' || wallMesh.userData?.section === 'baseboard') {
          this.planManager.setSelectedFurniture(null);
          this.planManager.setSelectedOpening(null);
          this.planManager.setSelectedRoom(null);
          this.planManager.setSelectedWall(foundWall, 'baseboard');
          return;
        }

        const face = intersect.face;
        let clickedSide: WallSide = 'A';
        if (obj.userData?.type === 'wall_frame') {
          clickedSide = 'edges';
        } else if (face) {
          // Wall geometry groups distinguish all four vertical faces. Normal
          // tests used to collapse both end caps into a single edges selection.
          const surfaces: WallSide[] = ['A', 'B', 'edge_start', 'edge_end', 'edge_top', 'edges'];
          clickedSide = surfaces[face.materialIndex ?? 0] || 'edges';
        } else {
          const localPoint = wallMesh.worldToLocal(hitPoint.clone());
          clickedSide = localPoint.z >= 0 ? 'A' : 'B';
        }

        this.planManager.setSelectedFurniture(null);
        this.planManager.setSelectedOpening(null);
        this.planManager.setSelectedRoom(null);
        this.planManager.setSelectedWall(foundWall, clickedSide);
        return;
      }

      // Check if it's a room floor
      let foundRoomId: string | null = null;
      curr = obj;
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
        const plan = this.planManager.getPlan();
        const room = plan?.rooms?.find((r) => r.id === foundRoomId);
        if (room) {
          this.planManager.setSelectedFurniture(null);
          this.planManager.setSelectedOpening(null);
          this.planManager.setSelectedWall(null);
          this.planManager.setSelectedRoom(room);
          return;
        }
      }
    }

    // Clicked empty space: deselect all
    this.planManager.setSelectedFurniture(null);
    this.planManager.setSelectedOpening(null);
    this.planManager.setSelectedWall(null);
    this.planManager.setSelectedRoom(null);
  }

  private handleExternalSelection(selected: FurnitureEntity | null): void {
    if (!this.sceneService || !this.transformControls) return;

    if (!selected) {
      this.selectedObject = null;
      if (this.transformControls.object) {
        this.transformControls.detach();
      }
      this.sceneService.setSelectionHighlight(null);
      return;
    }

    const scene = this.sceneService.getScene();
    const furnitureGroup = scene.getObjectByName('furnitureGroup');
    const fixturesGroup = scene.getObjectByName('fixturesGroup');
    if (!furnitureGroup && !fixturesGroup) return;

    const target =
      furnitureGroup?.children.find((c) => c.userData?.id === selected.id) ||
      fixturesGroup?.children.find((c) => c.userData?.id === selected.id);
    if (target && target.parent) {
      this.selectedObject = target;
      this.transformControls.attach(target);
      this.sceneService.setSelectionHighlight(selected);
    } else {
      this.selectedObject = null;
      if (this.transformControls.object) {
        this.transformControls.detach();
      }
      this.sceneService.setSelectionHighlight(null);
    }
  }

  private handleExternalOpeningSelection(selected: { opening: OpeningEntity; wall: WallEntity } | null): void {
    if (!this.sceneService || !this.transformControls) return;

    if (!selected) {
      if (this.selectedObject && (this.selectedObject.name.startsWith('doorPivot_') || this.selectedObject.userData?.isDoor)) {
        this.selectedObject = null;
        if (this.transformControls.object) {
          this.transformControls.detach();
        }
      }
      return;
    }

    const scene = this.sceneService.getScene();
    const openingsGroup = scene.getObjectByName('openingsGroup');
    if (!openingsGroup) return;

    const opMesh = openingsGroup.children.find((c) => c.userData?.openingId === selected.opening.id);
    if (opMesh && opMesh.parent) {
      const pivot = opMesh.getObjectByName(`doorPivot_${selected.opening.id}`) || opMesh;
      this.selectedObject = pivot;
      this.transformControls.attach(pivot);
      this.transformControls.setMode('rotate');
      this.transformControls.space = 'local';
      this.transformControls.showX = false;
      this.transformControls.showY = true;
      this.transformControls.showZ = false;
    }
  }

  private handleExternalWallSelection(selected: WallEntity | null): void {
    if (!this.sceneService || !this.transformControls) return;
    if (selected) {
      if (this.selectedObject) {
        this.selectedObject = null;
        if (this.transformControls.object) {
          this.transformControls.detach();
        }
      }
    }
  }

  private handleExternalRoomSelection(selected: RoomEntity | null): void {
    if (!this.sceneService || !this.transformControls) return;
    if (selected) {
      if (this.selectedObject) {
        this.selectedObject = null;
        if (this.transformControls.object) {
          this.transformControls.detach();
        }
      }
    }
  }
}
