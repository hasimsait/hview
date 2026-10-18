import { ViewMode } from '@core/types/services';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const MAX_CAMERA_PITCH = Math.PI / 2 - .04;

export interface CameraNavigationOptions {
  onInput?: () => void;
  moveSpeed?: number;      // Walking speed in meters/second (default: 2.8)
  boostMultiplier?: number;// Speed multiplier when Shift is held (default: 2.5)
  rotateSpeed?: number;    // Rotation speed in radians/second (default: 1.6)
  verticalSpeed?: number;  // Elevation speed in meters/second (default: 2.0)
}

export class CameraNavigationController {
  private readonly onInput: () => void;
  get hasActiveInput(): boolean { return this.active && Object.values(this.keys).some(Boolean); }
  private keys: Record<string, boolean> = {};
  private active = false;
  private moveSpeed: number;
  private boostMultiplier: number;
  private rotateSpeed: number;
  private verticalSpeed: number;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  private pointerElement: HTMLElement | SVGElement | null = null;
  private mouseDrag: { id: number; x: number; y: number; controls: OrbitControls; enableRotate: boolean } | null = null;

  private handlePointerDown = (event: Event): void => {
    const e = event as PointerEvent;
    const controls = this.getControls();
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey ||
        this.getViewMode() === 'topDown' || !controls?.enabled || !controls.enableRotate) return;
    this.mouseDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, controls, enableRotate: controls.enableRotate };
    // Let OrbitControls continue handling pan/zoom and pointer capture, but replace orbit rotation.
    controls.enableRotate = false;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const drag = this.mouseDrag;
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.controls.enabled || this.getViewMode() === 'topDown') return;
    const scale = 2 * Math.PI * drag.controls.rotateSpeed / Math.max(1, this.pointerElement?.clientHeight ?? 1);
    this.rotatePerspective(drag.controls, -dx * scale, dy * scale);
    this.onInput();
  };

  private handlePointerEnd = (e?: PointerEvent): void => {
    if (!this.mouseDrag || (e && e.pointerId !== this.mouseDrag.id)) return;
    this.mouseDrag.controls.enableRotate = this.getViewMode() !== 'topDown' && this.mouseDrag.enableRotate;
    this.mouseDrag = null;
  };

  private forwardVector = new THREE.Vector3();
  private rightVector = new THREE.Vector3();
  private tempOffset = new THREE.Vector3();
  private moveDelta = new THREE.Vector3();
  private panDelta = new THREE.Vector3();

  constructor(
    private perspectiveCamera: THREE.PerspectiveCamera,
    private orthographicCamera: THREE.OrthographicCamera,
    private getControls: () => OrbitControls | null,
    private getViewMode: () => ViewMode,
    options: CameraNavigationOptions = {}
  ) {
    this.onInput = options.onInput ?? (() => { });
    this.moveSpeed = options.moveSpeed ?? 2.8;
    this.boostMultiplier = options.boostMultiplier ?? 2.5;
    this.rotateSpeed = options.rotateSpeed ?? 1.6;
    this.verticalSpeed = options.verticalSpeed ?? 2.0;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundBlur = this.handleBlur.bind(this);
  }

  attach(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener('keydown', this.boundKeyDown, { passive: false });
    window.addEventListener('keyup', this.boundKeyUp, { passive: true });
    window.addEventListener('blur', this.boundBlur);
    this.pointerElement = this.getControls()?.domElement ?? null;
    this.pointerElement?.addEventListener('pointerdown', this.handlePointerDown, true);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerEnd);
    window.addEventListener('pointercancel', this.handlePointerEnd);
  }

  detach(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
    this.pointerElement?.removeEventListener('pointerdown', this.handlePointerDown, true);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerEnd);
    window.removeEventListener('pointercancel', this.handlePointerEnd);
    this.handlePointerEnd();
    this.pointerElement = null;
    this.keys = {};
  }

  dispose(): void {
    this.detach();
  }

  private isTypingInInput(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (target.isContentEditable) return true;
    return false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.isTypingInInput(e.target)) return;

    const code = e.code;
    const key = e.key;

    // Track relevant navigation keys
    const isNavKey =
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'KeyQ' ||
      code === 'KeyE' ||
      code === 'KeyC' ||
      code === 'Space' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'Shift' ||
      key === 'Control';

    if (isNavKey) {
      this.keys[code] = true;
      this.keys[key] = true;
      this.onInput();

      // Prevent default page scroll on Arrow keys and Space
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    delete this.keys[e.code];
    delete this.keys[e.key];
  }

  private handleBlur(): void {
    this.handlePointerEnd();
    this.keys = {};
  }

  /**
   * Update camera position and orientation based on active keys.
   * Called every animation frame.
   * @param dt Elapsed time in seconds
   */
  update(dt: number): void {
    if (!this.active || dt <= 0) return;
    const controls = this.getControls();
    if (!controls) return;

    // Clamp dt to avoid huge jumps on frame drops / tab pauses
    const safeDt = Math.min(dt, 0.1);
    const viewMode = this.getViewMode();

    if (viewMode === 'topDown') {
      this.updateTopDown(safeDt, controls);
    } else {
      this.updatePerspective(safeDt, controls);
    }
  }

  private updatePerspective(dt: number, controls: OrbitControls): void {
    const isShift = this.keys['Shift'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const isCtrl = this.keys['Control'] || this.keys['ControlLeft'] || this.keys['ControlRight'];
    const currentSpeed = (isShift ? this.moveSpeed * this.boostMultiplier : this.moveSpeed) * dt;
    const currentRotSpeed = (isShift ? this.rotateSpeed * 1.5 : this.rotateSpeed) * dt;

    const camera = this.perspectiveCamera;

    const turn = Number(Boolean(this.keys['ArrowLeft'])) - Number(Boolean(this.keys['ArrowRight']));
    const tilt = Number(Boolean(this.keys['ArrowUp'])) - Number(Boolean(this.keys['ArrowDown']));
    if (!isCtrl) this.rotatePerspective(controls, turn * currentRotSpeed, tilt * currentRotSpeed);
    const offset = this.tempOffset.subVectors(controls.target, camera.position);

    // --- 2. TRANSLATION (WASD + Vertical Q/E/Space/C + Ctrl+Arrows) ---
    // Compute horizontal forward & right vectors based on current facing direction
    this.forwardVector.set(offset.x, 0, offset.z);
    if (this.forwardVector.lengthSq() > 0.0001) {
      this.forwardVector.normalize();
    } else {
      this.forwardVector.set(0, 0, -1);
    }

    this.rightVector.set(-this.forwardVector.z, 0, this.forwardVector.x);

    const moveDelta = this.moveDelta.set(0, 0, 0);

    // Forward / Backward
    if (this.keys['KeyW'] || (isCtrl && this.keys['ArrowUp'])) {
      moveDelta.addScaledVector(this.forwardVector, currentSpeed);
    }
    if (this.keys['KeyS'] || (isCtrl && this.keys['ArrowDown'])) {
      moveDelta.addScaledVector(this.forwardVector, -currentSpeed);
    }

    // Strafe Left / Right
    if (this.keys['KeyA'] || (isCtrl && this.keys['ArrowLeft'])) {
      moveDelta.addScaledVector(this.rightVector, -currentSpeed);
    }
    if (this.keys['KeyD'] || (isCtrl && this.keys['ArrowRight'])) {
      moveDelta.addScaledVector(this.rightVector, currentSpeed);
    }

    // Elevation (Up / Down)
    const vertSpeed = (isShift ? this.verticalSpeed * this.boostMultiplier : this.verticalSpeed) * dt;
    if (this.keys['KeyE'] || this.keys['Space']) {
      moveDelta.y += vertSpeed;
    }
    if (this.keys['KeyQ'] || this.keys['KeyC']) {
      moveDelta.y -= vertSpeed;
    }

    if (moveDelta.lengthSq() > 0) {
      camera.position.add(moveDelta);
      controls.target.add(moveDelta);

      // Floor collision prevention: keep eye level above floor (min 0.15m)
      if (camera.position.y < 0.15) {
        const floorAdj = 0.15 - camera.position.y;
        camera.position.y += floorAdj;
        controls.target.y += floorAdj;
      }
    }
  }

  // Shared by mouse dragging and arrow keys: turn at the current eye position.
  private rotatePerspective(controls: OrbitControls, turn: number, tilt: number): void {
    if (!turn && !tilt) return;
    const camera = this.perspectiveCamera;
    const offset = this.tempOffset.subVectors(controls.target, camera.position);
    let distance = offset.length();
    if (distance < 0.2) {
      distance = 2.0;
      camera.getWorldDirection(offset).multiplyScalar(distance);
    }
    const yaw = Math.atan2(offset.x, offset.z) + turn;
    const pitch = THREE.MathUtils.clamp(
      Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) + tilt,
      -MAX_CAMERA_PITCH, MAX_CAMERA_PITCH
    );
    const horizontal = Math.cos(pitch) * distance;
    offset.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * distance, Math.cos(yaw) * horizontal);
    controls.target.copy(camera.position).add(offset);
  }

  private updateTopDown(dt: number, controls: OrbitControls): void {
    const isShift = this.keys['Shift'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const zoom = this.orthographicCamera.zoom || 50;
    // Speed scaled inversely by zoom so pan feels natural at any zoom level
    const panSpeed = ((isShift ? 30 : 12) / zoom) * 50 * dt;

    const panDelta = this.panDelta.set(0, 0, 0);

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      panDelta.z -= panSpeed;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      panDelta.z += panSpeed;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      panDelta.x -= panSpeed;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      panDelta.x += panSpeed;
    }

    if (panDelta.lengthSq() > 0) {
      this.orthographicCamera.position.add(panDelta);
      controls.target.add(panDelta);
    }

    // Zoom in/out via E/Q
    if (this.keys['KeyE']) {
      this.orthographicCamera.zoom = Math.min(250, this.orthographicCamera.zoom * (1 + 1.8 * dt));
      this.orthographicCamera.updateProjectionMatrix();
    }
    if (this.keys['KeyQ']) {
      this.orthographicCamera.zoom = Math.max(10, this.orthographicCamera.zoom * (1 - 1.8 * dt));
      this.orthographicCamera.updateProjectionMatrix();
    }
  }
}
