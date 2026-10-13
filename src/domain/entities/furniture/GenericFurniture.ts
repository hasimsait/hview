import * as THREE from 'three';
import { FurnitureObject } from './FurnitureObject';
import { SurfaceDescriptor, RenderContext } from '../SceneObject';
import { FurnitureCategory } from '../../../core/types/plan';

export class GenericFurniture extends FurnitureObject {
  constructor(id: string, name: string, assetKey: string, category: FurnitureCategory = 'storage') {
    super(id, name, assetKey, category);
  }

  getSurfaces(): SurfaceDescriptor[] {
    const declared = Object.keys(this.sectionFinishes).map((k) => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      category: 'part' as const,
    }));
    if (declared.length > 0) return declared;

    // Standard fallback surfaces
    return [
      { key: 'all', label: 'Entire Asset Finish', category: 'part' },
    ];
  }

  renderObject(context: RenderContext): THREE.Object3D {
    if (context.proceduralAssetFactory) {
      return context.proceduralAssetFactory.createMesh(this.toJSON());
    }

    const group = new THREE.Group();
    group.name = `furniture_${this.id}`;
    group.userData = { type: 'furniture', id: this.id, entity: this };

    const geom = new THREE.BoxGeometry(this.dimensions.x, this.dimensions.y, this.dimensions.z);
    const mat = context.finishService
      ? context.finishService.getMaterial(this.finish || { type: 'wood' }, { side: THREE.FrontSide })
      : new THREE.MeshStandardMaterial({ color: 0xcccccc });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, this.dimensions.y / 2, 0);
    group.add(mesh);

    return group;
  }
}
