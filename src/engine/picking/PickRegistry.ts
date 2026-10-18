import * as THREE from 'three';
import type { Selection } from '../../application/SelectionModel';
import { surfaceSection } from '../../domain/model/SurfaceSections';

export type PickTarget = NonNullable<Selection>;

export class PickRegistry {
  private readonly targets = new WeakMap<THREE.Object3D, PickTarget>();
  private readonly candidates = new Set<THREE.Object3D>();
  register(root: THREE.Object3D, target: PickTarget): () => void {
    const objects: THREE.Object3D[] = [];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      this.targets.set(object, Object.freeze({
        ...target,
        subtarget: typeof object.userData.section === 'string' ? surfaceSection(object.userData.section) : target.subtarget
      }));
      this.candidates.add(object); objects.push(object);
    });
    return () => { for (const object of objects) { this.targets.delete(object); this.candidates.delete(object); } };
  }
  resolve(object: THREE.Object3D): PickTarget | undefined { return this.targets.get(object); }
  getCandidates(): THREE.Object3D[] { return [...this.candidates]; }
}

export class PickingController {
  private readonly raycaster = new THREE.Raycaster();
  constructor(private readonly registry: PickRegistry) { }
  pick(point: THREE.Vector2, camera: THREE.Camera, visible: (hit: THREE.Intersection) => boolean = () => true): { target: PickTarget; hit: THREE.Intersection } | null {
    this.raycaster.setFromCamera(point, camera);
    for (const hit of this.raycaster.intersectObjects(this.registry.getCandidates(), false)) {
      let shown = true;
      for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) shown = false;
      if (!shown || !visible(hit)) continue;
      const mesh = hit.object as THREE.Mesh;
      const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
      if (material && (!material.visible || (material.transparent && material.opacity <= 0.01))) continue;
      const target = this.registry.resolve(hit.object);
      if (target) {
        if (target.kind === 'wall' && !target.subtarget) {
          const surfaces = ['A', 'B', 'edge_start', 'edge_end', 'edge_top', 'edges', 'sill'] as const;
          return { target: { ...target, subtarget: surfaces[hit.face?.materialIndex ?? 0] ?? 'edges' }, hit };
        }
        if (target.kind === 'column' && !target.subtarget) {
          const surfaces = ['front', 'back', 'left', 'right'] as const;
          return { target: { ...target, subtarget: surfaces[hit.face?.materialIndex ?? 0] ?? 'all' }, hit };
        }
        return { target, hit };
      }
    }
    return null;
  }
}
