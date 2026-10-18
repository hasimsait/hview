import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

/** Temporary, nonblocking feedback. Never mutates a finish or enables global collision checks. */
export class CollisionFeedback {
  private readonly material = new THREE.MeshStandardMaterial({ color: '#ff2424', emissive: '#991010', emissiveIntensity: .35, roughness: .7 });
  private readonly boxes = new WeakMap<THREE.BufferGeometry, { version: number; isBox: boolean }>();
  private readonly originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  clear(): void { for (const [mesh, material] of this.originals) { mesh.material = material; delete mesh.userData.collision; } this.originals.clear(); }
  mark(root: THREE.Object3D): void { root.traverse(o => { if (o instanceof THREE.Mesh) { if (!this.originals.has(o)) this.originals.set(o, o.material); o.material = this.material; o.userData.collision = true; } }); }
  dispose(): void { this.clear(); this.material.dispose(); }
  prepare(movingRoot: THREE.Object3D, candidates: readonly THREE.Object3D[]): CollisionQuery {
    return new CollisionQuery(this, movingRoot, candidates);
  }
  private obb(mesh: THREE.Mesh): OBB {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = new OBB().fromBox3(mesh.geometry.boundingBox!);
    const center = box.center.clone().applyMatrix4(mesh.matrixWorld);
    box.applyMatrix4(mesh.matrixWorld);
    // Three's OBB transforms the axes but only translates its centre. Imported
    // and extruded geometry often has an off-centre local bounding box.
    box.center.copy(center);
    box.halfSize.set(Math.abs(box.halfSize.x), Math.abs(box.halfSize.y), Math.abs(box.halfSize.z));
    return box;
  }
  private isBox(mesh: THREE.Mesh): boolean {
    if (mesh.geometry.type !== 'BoxGeometry') return false;
    const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const cached = this.boxes.get(mesh.geometry);
    if (cached?.version === positions.version) return cached.isBox;
    const bounds = mesh.geometry.boundingBox!;
    // A baked rotation preserves the geometry type, but its bounds are no
    // longer the box itself. Translations and axis-aligned scaling are safe.
    let isBox = true;
    for (let i = 0; i < positions.count && isBox; i++) for (const axis of ['x', 'y', 'z'] as const) {
      const value = axis === 'x' ? positions.getX(i) : axis === 'y' ? positions.getY(i) : positions.getZ(i);
      if (Math.min(Math.abs(value - bounds.min[axis]), Math.abs(value - bounds.max[axis])) > 1e-7) isBox = false;
    }
    this.boxes.set(mesh.geometry, { version: positions.version, isBox });
    return isBox;
  }
  private orthogonal(mesh: THREE.Mesh): boolean {
    const e = mesh.matrixWorld.elements;
    const x = new THREE.Vector3(e[0], e[1], e[2]).normalize();
    const y = new THREE.Vector3(e[4], e[5], e[6]).normalize();
    const z = new THREE.Vector3(e[8], e[9], e[10]).normalize();
    return Math.max(Math.abs(x.dot(y)), Math.abs(y.dot(z)), Math.abs(z.dot(x))) < 1e-8;
  }
  intersects(leaf: THREE.Mesh, obstacle: THREE.Mesh): boolean {
    if (leaf === obstacle || !leaf.geometry || !obstacle.geometry) return false;
    const a = this.obb(leaf), b = this.obb(obstacle);
    const orthogonal = this.orthogonal(leaf) && this.orthogonal(obstacle);
    if (orthogonal) {
      a.halfSize.subScalar(.0005).max(new THREE.Vector3());
      if (!a.intersectsOBB(b, 1e-10)) return false;
    } else {
      // Nested rotations under nonuniform scale can shear a mesh. Use a
      // conservative broad phase, then its exact local triangles below.
      const bounds = leaf.geometry.boundingBox!.clone().applyMatrix4(leaf.matrixWorld);
      if (!bounds.intersectsBox(obstacle.geometry.boundingBox!.clone().applyMatrix4(obstacle.matrixWorld))) return false;
    }
    const leafBox = this.isBox(leaf), obstacleBox = this.isBox(obstacle);
    if (orthogonal && leafBox && obstacleBox) return true;
    // Door leaves, handles and drawer panels are boxes. A bounding box alone
    // fills holes in walls, furniture and curved objects with imaginary solids.
    if (obstacleBox && !leafBox) return this.boxIntersectsMesh(obstacle, leaf);
    return this.boxIntersectsMesh(leaf, obstacle);
  }
  private boxIntersectsMesh(boxMesh: THREE.Mesh, surface: THREE.Mesh): boolean {
    const inverse = boxMesh.matrixWorld.clone().invert().multiply(surface.matrixWorld);
    const scale = new THREE.Vector3().setFromMatrixScale(boxMesh.matrixWorld);
    const box = boxMesh.geometry.boundingBox!.clone();
    box.min.add(new THREE.Vector3(.0005 / Math.abs(scale.x), .0005 / Math.abs(scale.y), .0005 / Math.abs(scale.z)));
    box.max.sub(new THREE.Vector3(.0005 / Math.abs(scale.x), .0005 / Math.abs(scale.y), .0005 / Math.abs(scale.z)));
    if (box.isEmpty()) return false;
    const positions = surface.geometry.attributes.position, index = surface.geometry.index;
    const count = index?.count ?? positions.count, triangle = new THREE.Triangle();
    const center = box.getCenter(new THREE.Vector3()), cross = new THREE.Vector3();
    let solidAngle = 0;
    for (let i = 0; i < count; i += 3) {
      triangle.a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(inverse);
      triangle.b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).applyMatrix4(inverse);
      triangle.c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).applyMatrix4(inverse);
      if (box.intersectsTriangle(triangle)) return true;
      // A leaf completely inside a closed solid need not cross a triangle.
      // The winding solid angle distinguishes that from a real opening.
      const u = triangle.a.sub(center), v = triangle.b.sub(center), w = triangle.c.sub(center);
      const lu = u.length(), lv = v.length(), lw = w.length();
      solidAngle += 2 * Math.atan2(u.dot(cross.crossVectors(v, w)), lu * lv * lw + u.dot(v) * lw + v.dot(w) * lu + w.dot(u) * lv);
    }
    return Math.abs(solidAngle) > 2 * Math.PI;
  }
}

/** Static obstacle bounds live only for one sampled motion, never across edits. */
export class CollisionQuery {
  private readonly obstacles: { mesh: THREE.Mesh; bounds: THREE.Box3 }[] = [];
  private readonly bounds = new THREE.Box3();
  constructor(private readonly feedback: CollisionFeedback, movingRoot: THREE.Object3D, candidates: readonly THREE.Object3D[]) {
    const moving = new Set<THREE.Object3D>(); movingRoot.traverse(object => moving.add(object));
    for (const mesh of candidates) {
      if (!(mesh instanceof THREE.Mesh) || !mesh.geometry || moving.has(mesh)) continue;
      let visible = true;
      for (let parent: THREE.Object3D | null = mesh; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      this.obstacles.push({ mesh, bounds: mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld) });
    }
  }
  intersects(moving: readonly THREE.Mesh[]): boolean {
    for (const mesh of moving) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      this.bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
      for (const obstacle of this.obstacles) {
        if (this.bounds.intersectsBox(obstacle.bounds) && this.feedback.intersects(mesh, obstacle.mesh)) return true;
      }
    }
    return false;
  }
}
