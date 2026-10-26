import * as THREE from 'three';

type Resource = THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh;

/** Shared resource lifetime; a node releases only its own lease. */
export class ResourcePool {
  private readonly references = new Map<Resource, number>();
  private readonly originals = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
  rememberOriginal(mesh: THREE.Mesh): void { if (!this.originals.has(mesh)) this.originals.set(mesh, mesh.material); }
  original(mesh: THREE.Mesh): THREE.Material | THREE.Material[] | undefined { return this.originals.get(mesh); }
  retain(resource: Resource): void { this.references.set(resource, (this.references.get(resource) ?? 0) + 1); }
  release(resource: Resource): void {
    const count = this.references.get(resource);
    if (count === undefined) throw new Error('Cannot release an unowned GPU resource');
    if (count > 1) this.references.set(resource, count - 1);
    else { this.references.delete(resource); resource.dispose(); }
  }
  get size(): number { return this.references.size; }
  count(resource: Resource): number { return this.references.get(resource) ?? 0; }
  ownTree(root: THREE.Object3D): ResourceLease { return new ResourceLease(this, root); }
}

export class ResourceLease {
  private resources = new Set<Resource>();
  private closed = false;
  constructor(private readonly pool: ResourcePool, private readonly root: THREE.Object3D) { this.refresh(); }
  refresh(): void {
    if (this.closed) throw new Error('Resource lease is closed');
    const next = new Set<Resource>();
    const addMaterial = (material: THREE.Material) => {
      next.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) next.add(value);
    };
    this.root.traverse(object => {
      // Instanced meshes own GPU instance buffers in addition to shared geometry.
      if (object instanceof THREE.InstancedMesh) next.add(object);
      const renderable = object as THREE.Mesh;
      if (renderable.geometry instanceof THREE.BufferGeometry) next.add(renderable.geometry);
      if (renderable.material) for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) addMaterial(material);
      const original = this.pool.original(renderable);
      if (original) for (const material of Array.isArray(original) ? original : [original]) addMaterial(material);
    });
    // Acquire before releasing: a replacement material may share the old map.
    for (const resource of next) if (!this.resources.has(resource)) this.pool.retain(resource);
    for (const resource of this.resources) if (!next.has(resource)) this.pool.release(resource);
    this.resources = next;
  }
  dispose(): void {
    if (this.closed) return;
    for (const resource of this.resources) this.pool.release(resource);
    this.resources.clear(); this.closed = true;
  }
}
