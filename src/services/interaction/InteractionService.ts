import { FurnitureEntity,OpeningEntity,RoomEntity,WallEntity } from '@core/types/plan';
import { IInteractionService,ISceneService,} from '@core/types/services';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { TransformFurniture } from '../../application/commands/FurnitureCommands';
import { OpenDoor } from '../../application/commands/StructuralCommands';
import type { EditorSession } from '../../application/EditorSession';
import { selectedFurniture,selectedOpening,selectedRoom,selectedWall } from '../../application/queries/SelectionQueries';
import { SceneEngine } from '../../engine/SceneEngine';

export class InteractionService implements IInteractionService {
  private cabinetPartPosition(): THREE.Vector3 {
    const position = this.selectedObject!.position.clone(), offset = this.selectedObject!.userData.cabinetClosedOffset;
    return offset ? position.add(new THREE.Vector3(offset.x, offset.y, offset.z)) : position;
  }

  private sceneService: SceneEngine | null = null;
  private editor: EditorSession | null = null;
  private transformControls: TransformControls | null = null;
  private mouse = new THREE.Vector2();
  private selectedObject: THREE.Object3D | null = null;
  private selectedTarget: { kind: 'furniture' | 'opening'; id: string } | null = null;
  private gizmoMode: 'translate' | 'rotate' = 'translate';
  private gizmoShowY = false;
  private enabled = true;
  private cabinetMode: { id: string; select: (part: string | null) => void; move: (part: string, position: THREE.Vector3, rotation: number) => void } | null = null;
  private cabinetPart: string | null = null;
  private cabinetAxes: 'x' | 'y' | 'xyz' = 'xyz';

  private subscriptions: (() => void)[] = [];
  private pointerDownPos = { x: 0, y: 0 };
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor() {
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
  }

  initialize(sceneService: ISceneService, editor: EditorSession): void {
    this.sceneService = sceneService as SceneEngine;
    this.editor = editor;

    const domElement = this.sceneService.getDomElement();
    if (!domElement) return;

    // Setup TransformControls
    this.transformControls = new TransformControls(
      this.sceneService.getCamera(),
      domElement
    );
    this.transformControls.addEventListener('change', () => {
      this.sceneService?.invalidate();
      if (!this.cabinetMode && this.transformControls?.dragging && this.selectedTarget?.kind === 'opening') this.sceneService?.checkDoorCollision(this.selectedTarget.id);
    });
    this.transformControls.addEventListener('objectChange', () => {
      if (this.cabinetMode && this.cabinetPart && this.selectedObject) this.sceneService?.previewCabinetPart(this.cabinetMode.id, this.cabinetPart, this.cabinetPartPosition(), this.selectedObject.rotation.y);
    });
    this.transformControls.setMode(this.gizmoMode);
    this.transformControls.showY = false; // Only translate in X and Z on the floor!
    this.transformControls.space = 'world'; // World coordinates for reliable floor translation
    this.transformControls.size = 0.9;

    const controls = this.sceneService.getControls();
    this.transformControls.addEventListener('dragging-changed', (event) => {
      if (event.value && !this.cabinetMode && this.selectedTarget?.kind === 'furniture') this.sceneService?.clearCollisionFeedback();
      if (controls) {
        controls.enabled = this.enabled && !event.value;
      }
      if (this.enabled && !event.value && this.cabinetMode && this.cabinetPart && this.selectedObject) {
        this.cabinetMode.move(this.cabinetPart, this.cabinetPartPosition(), this.selectedObject.rotation.y); return;
      }
      // When dragging finishes, ensure final coordinates are committed via SelectionModel / selectedTarget
      if (this.enabled && !event.value && this.selectedObject && this.editor) {
        if (this.selectedTarget?.kind === 'furniture') {
          this.editor.execute(new TransformFurniture(this.selectedTarget.id, {
            x: this.selectedObject.position.x,
            y: this.selectedObject.position.y,
            z: this.selectedObject.position.z,
          }, this.selectedObject.rotation.y, undefined));
        } else if (this.selectedTarget?.kind === 'opening') {
          const deg = Math.round((Math.abs(this.selectedObject.rotation.y) * 180) / Math.PI);
          this.editor.execute(new OpenDoor(this.selectedTarget.id, deg));
        }
      }
    });

    this.sceneService.getScene().add(this.transformControls.getHelper());

    domElement.addEventListener('pointerdown', this.boundPointerDown);
    domElement.addEventListener('pointerup', this.boundPointerUp);

    const updateSelection = () => {
      if (!this.editor || this.transformControls?.dragging || this.cabinetMode) return;
      this.handleExternalSelection(selectedFurniture(this.editor));
      this.handleExternalOpeningSelection(selectedOpening(this.editor));
      this.handleExternalWallSelection(selectedWall(this.editor));
      this.handleExternalRoomSelection(selectedRoom(this.editor));
    };
    this.subscriptions.push(this.editor.selection.subscribe(updateSelection));
    this.subscriptions.push(this.editor.subscribe(() => {
      // The renderer consumes this change first; defer gizmo attachment until it is reconciled.
      queueMicrotask(() => { if (this.editor) updateSelection(); });
    }));
  }

  setCabinetEditor(mode: typeof this.cabinetMode): void { this.cabinetMode = mode; this.clearGizmoAttachment(); }
  attachCabinetPart(id: string, part: string | null, axes: 'x' | 'y' | 'xyz' = 'xyz'): void {
    this.cabinetPart = part; this.cabinetAxes = axes;
    const target = part ? this.sceneService?.getCabinetPart(id, part) : undefined;
    if (!target || !this.transformControls) { this.clearGizmoAttachment(); return; }
    this.selectedObject = target; this.selectedTarget = { kind: 'furniture', id }; this.transformControls.attach(target); this.setGizmoMode(this.gizmoMode);
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.transformControls) {
      this.transformControls.enabled = enabled;
      this.transformControls.getHelper().visible = enabled;
      if (!enabled) {
        this.transformControls.dragging = false;
        this.transformControls.axis = null;
      }
    }
  }

  dispose(): void {
    for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe();
    this.editor = null;
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
      if (this.cabinetMode) {
        this.transformControls.setMode(this.cabinetAxes === 'xyz' ? mode : 'translate'); this.transformControls.space = 'local';
        this.transformControls.showX = this.cabinetAxes !== 'y'; this.transformControls.showY = mode === 'translate' || this.cabinetAxes === 'y'; this.transformControls.showZ = this.cabinetAxes === 'xyz' && mode === 'translate'; return;
      }
      if (this.selectedTarget?.kind === 'opening') {
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
      if (this.selectedTarget?.kind === 'opening') {
        return;
      }
      this.transformControls.showY = enabled;
    }
  }

  getGizmoShowY(): boolean {
    return this.gizmoShowY;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.enabled) return;
    // Only count as click if pointer didn't drag (tolerance up to 8px for trackpad/mouse clicks)
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 8) return;

    if (!this.sceneService || !this.editor) return;
    const domElement = this.sceneService.getDomElement();
    if (!domElement) return;

    // Do NOT select/deselect if interacting with the transform gizmo
    if (this.transformControls && (this.transformControls.axis !== null || this.transformControls.dragging)) {
      return;
    }

    const rect = domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const picked = this.sceneService.pick(this.mouse);
    if (this.cabinetMode) { this.cabinetMode.select(picked?.target.id === this.cabinetMode.id && typeof picked.hit.object.userData.cabinetPart === 'string' ? picked.hit.object.userData.cabinetPart : null); return; }
    this.editor.selection.set(picked?.target ?? null);
  }

  private clearGizmoAttachment(): void {
    this.selectedObject = null;
    this.selectedTarget = null;
    if (this.transformControls?.object) {
      this.transformControls.detach();
    }
  }

  private handleExternalSelection(selected: FurnitureEntity | null): void {
    if (!this.sceneService || !this.transformControls) return;

    if (!selected) {
      if (this.selectedTarget?.kind === 'furniture') {
        this.clearGizmoAttachment();
      }
      this.sceneService.setSelectionHighlight(null);
      return;
    }

    const target = this.sceneService.getTransformTarget(selected.id);
    if (target && target.parent) {
      this.selectedObject = target;
      this.selectedTarget = { kind: 'furniture', id: selected.id };
      this.transformControls.attach(target);
      this.setGizmoMode(this.gizmoMode);
      this.sceneService.setSelectionHighlight(selected);
    } else {
      this.clearGizmoAttachment();
      this.sceneService.setSelectionHighlight(null);
    }
  }

  private handleExternalOpeningSelection(selected: { opening: OpeningEntity; wall: WallEntity } | null): void {
    if (!this.sceneService || !this.transformControls) return;

    if (!selected) {
      if (this.selectedTarget?.kind === 'opening') {
        this.clearGizmoAttachment();
      }
      return;
    }

    // Sliding openings use their openness control, never a rotation gizmo.
    if (selected.opening.type === 'door_coupe') { this.clearGizmoAttachment(); return; }
    const pivot = this.sceneService.getTransformTarget(selected.opening.id);
    if (pivot?.parent) {
      this.selectedObject = pivot;
      this.selectedTarget = { kind: 'opening', id: selected.opening.id };
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
      this.clearGizmoAttachment();
    }
  }

  private handleExternalRoomSelection(selected: RoomEntity | null): void {
    if (!this.sceneService || !this.transformControls) return;
    if (selected) {
      this.clearGizmoAttachment();
    }
  }
}
