import * as THREE from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';

/** Temporary, nonblocking feedback. Never mutates a finish or enables global collision checks. */
export class CollisionFeedback {
  private readonly material = new THREE.MeshStandardMaterial({ color: '#ff2424', emissive: '#991010', emissiveIntensity: .35, roughness: .7 });
  private readonly originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  clear(): void { for (const [mesh, material] of this.originals) { mesh.material = material; delete mesh.userData.collision; } this.originals.clear(); }
  mark(root: THREE.Object3D): void { root.traverse(o => { if (o instanceof THREE.Mesh) { if (!this.originals.has(o)) this.originals.set(o, o.material); o.material = this.material; o.userData.collision = true; } }); }
  dispose(): void { this.clear(); this.material.dispose(); }
  private obb(mesh: THREE.Mesh): OBB {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); return new OBB().fromBox3(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  }
  intersects(leaf: THREE.Mesh, obstacle: THREE.Mesh, wall = false): boolean {
    if (leaf === obstacle || !leaf.geometry || !obstacle.geometry) return false;
    const a = this.obb(leaf), b = this.obb(obstacle); a.halfSize.subScalar(.0005).max(new THREE.Vector3());
    if (!a.intersectsOBB(b, 1e-10)) return false;
    // Wall meshes contain real openings. Their bounding box would incorrectly
    // flag a closed leaf sitting harmlessly inside its own doorway.
    if (!wall && !obstacle.userData.isWall && !obstacle.userData.wallId) return true;
    const inverse = leaf.matrixWorld.clone().invert().multiply(obstacle.matrixWorld), box = leaf.geometry.boundingBox!.clone().expandByScalar(-.0005);
    const positions = obstacle.geometry.attributes.position, index = obstacle.geometry.index, count = index?.count ?? positions.count, triangle = new THREE.Triangle();
    for (let i = 0; i < count; i += 3) {
      triangle.a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(inverse);
      triangle.b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).applyMatrix4(inverse);
      triangle.c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).applyMatrix4(inverse);
      if (box.intersectsTriangle(triangle)) return true;
    }
    return false;
  }
}
