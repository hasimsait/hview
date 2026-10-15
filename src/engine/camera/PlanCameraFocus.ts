import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { OpeningEntity,PlanDocument,WallEntity } from '../../core/types/plan';
export class PlanCameraFocus {
  constructor(private readonly perspectiveCamera: THREE.PerspectiveCamera, private readonly orthographicCamera: THREE.OrthographicCamera, private readonly getControls: () => OrbitControls | null, private readonly getContainer: () => HTMLElement | null, private readonly getDocument: () => PlanDocument | null, private readonly renderObject: (id: string) => THREE.Object3D | undefined, private readonly invalidate: () => void) { }
  private get controls() { return this.getControls(); }
  private get container() { return this.getContainer(); }
  private get currentPlan() { return this.getDocument(); }
  focusOnOpening(opening: OpeningEntity, _wall: WallEntity): void {
    this.invalidate();
    if (!this.controls) return;
    const mesh = this.renderObject(opening.id);
    if (!mesh) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);
    this.controls.update();
  }

  focusOnWall(wall: WallEntity): void {
    this.invalidate();
    if (!this.controls) return;
    const mesh = this.renderObject(wall.id);
    if (!mesh) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());

    this.controls.target.copy(center);
    this.controls.update();
  }

  focusOnRoom(roomId: string): void {
    this.invalidate();
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
    this.invalidate();
    const mesh = this.renderObject(id);
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

  fitPlanInView(): void {
    if (!this.currentPlan || !this.controls) return;

    // Compute bounding box
    const box = new THREE.Box3();
    for (const w of [...this.currentPlan.walls, ...this.currentPlan.columns.map(column => column.wallShape(this.currentPlan!.totalHeight))]) {
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
}
