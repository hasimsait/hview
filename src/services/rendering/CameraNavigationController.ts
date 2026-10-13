import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewMode } from '@core/types/services';

export interface CameraNavigationOptions {
  moveSpeed?: number;      // Walking speed in meters/second (default: 2.8)
  boostMultiplier?: number;// Speed multiplier when Shift is held (default: 2.5)
  rotateSpeed?: number;    // Rotation speed in radians/second (default: 1.6)
  verticalSpeed?: number;  // Elevation speed in meters/second (default: 2.0)
}

export class CameraNavigationController {
  private keys: Record<string, boolean> = {};
  private active = false;
  private moveSpeed: number;
  private boostMultiplier: number;
  private rotateSpeed: number;
  private verticalSpeed: number;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  private forwardVector = new THREE.Vector3();
  private rightVector = new THREE.Vector3();
  private tempOffset = new THREE.Vector3();
  private worldUp = new THREE.Vector3(0, 1, 0);

  constructor(
    private perspectiveCamera: THREE.PerspectiveCamera,
    private orthographicCamera: THREE.OrthographicCamera,
    private getControls: () => OrbitControls | null,
    private getViewMode: () => ViewMode,
    options: CameraNavigationOptions = {}
  ) {
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
  }

  detach(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
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
      key === 'Shift';

    if (isNavKey) {
      this.keys[code] = true;
      this.keys[key] = true;

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

    // --- 1. ROTATION (Arrow Keys) ---
    // In-place rotation: rotate view direction (controls.target) around camera.position
    const offset = this.tempOffset.subVectors(controls.target, camera.position);
    let distance = offset.length();
    if (distance < 0.2) {
      distance = 2.0;
      offset.normalize().multiplyScalar(distance);
    }

    let hasRotated = false;

    // A. Yaw (Turn Left / Right)
    if (!isCtrl) {
      if (this.keys['ArrowLeft']) {
        offset.applyAxisAngle(this.worldUp, currentRotSpeed);
        hasRotated = true;
      }
      if (this.keys['ArrowRight']) {
        offset.applyAxisAngle(this.worldUp, -currentRotSpeed);
        hasRotated = true;
      }

      // B. Pitch (Tilt Up / Down)
      const lookUp = this.keys['ArrowUp'];
      const lookDown = this.keys['ArrowDown'];
      if (lookUp || lookDown) {
        // Calculate camera's horizontal right axis
        const camRight = new THREE.Vector3().crossVectors(offset, this.worldUp).normalize();
        if (camRight.lengthSq() > 0.001) {
          const currentPitch = Math.asin(THREE.MathUtils.clamp(offset.y / distance, -0.999, 0.999));
          const pitchDelta = (lookUp ? 1 : -1) * currentRotSpeed;
          const maxPitch = Math.PI / 2 - 0.04;  // ~87 degrees (avoid gimbal flipping)
          const minPitch = -Math.PI / 2 + 0.04;
          const newPitch = THREE.MathUtils.clamp(currentPitch + pitchDelta, minPitch, maxPitch);
          const actualDelta = newPitch - currentPitch;
          offset.applyAxisAngle(camRight, actualDelta);
          hasRotated = true;
        }
      }
    }

    if (hasRotated) {
      offset.normalize().multiplyScalar(distance);
      controls.target.copy(camera.position).add(offset);
    }

    // --- 2. TRANSLATION (WASD + Vertical Q/E/Space/C + Ctrl+Arrows) ---
    // Compute horizontal forward & right vectors based on current facing direction
    this.forwardVector.set(offset.x, 0, offset.z);
    if (this.forwardVector.lengthSq() > 0.0001) {
      this.forwardVector.normalize();
    } else {
      this.forwardVector.set(0, 0, -1);
    }

    this.rightVector.set(-this.forwardVector.z, 0, this.forwardVector.x);

    const moveDelta = new THREE.Vector3(0, 0, 0);

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

  private updateTopDown(dt: number, controls: OrbitControls): void {
    const isShift = this.keys['Shift'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const zoom = this.orthographicCamera.zoom || 50;
    // Speed scaled inversely by zoom so pan feels natural at any zoom level
    const panSpeed = ((isShift ? 30 : 12) / zoom) * 50 * dt;

    const panDelta = new THREE.Vector3(0, 0, 0);

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
