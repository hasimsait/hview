import * as THREE from 'three';
import { FurnitureObject } from './FurnitureObject';
import { SurfaceDescriptor, PropertyDescriptor, RenderContext } from '../SceneObject';
import { ensureLocalMetricBounds } from '../../../services/rendering/SurfaceFinishService';

export class ShelvingFurniture extends FurnitureObject {
  shelfCount: number = 4;

  constructor(id: string, name: string = 'Open Shelving') {
    super(id, name, 'open_shelving', 'storage');
    this.dimensions = { x: 1.0, y: 1.8, z: 0.35 };
  }

  getSurfaces(): SurfaceDescriptor[] {
    return [
      { key: 'frame', label: 'Uprights & Outer Frame', category: 'part' },
      { key: 'shelves', label: 'Shelf Tiers & Back Panel', category: 'part' },
    ];
  }

  getInspectableProperties(): PropertyDescriptor[] {
    return [
      ...super.getInspectableProperties(),
      {
        key: 'shelfCount',
        label: 'Number of Shelves',
        type: 'number',
        value: this.shelfCount,
        min: 2,
        max: 8,
        step: 1,
      },
    ];
  }

  setPropertyValue(propertyKey: string, value: any): void {
    if (propertyKey === 'shelfCount') {
      this.shelfCount = Math.max(2, Math.min(8, Math.round(Number(value))));
    } else {
      super.setPropertyValue(propertyKey, value);
    }
  }

  renderObject(context: RenderContext): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `furniture_${this.id}`;
    group.userData = { type: 'furniture', id: this.id, entity: this };

    const { finishService, materials = {} } = context;
    const shelfW = Math.max(0.2, this.dimensions.x);
    const shelfH = Math.max(0.4, this.dimensions.y);
    const shelfD = Math.max(0.15, this.dimensions.z);

    const matFrame = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('frame') || { type: 'wood', variant: 'oak_dark' }, { side: THREE.FrontSide })
      : (materials.woodDark || new THREE.MeshStandardMaterial({ color: 0x4a3728 }));

    const matShelves = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('shelves') || { type: 'wood', variant: 'oak_dark' }, { side: THREE.FrontSide })
      : matFrame;

    const uprightThick = 0.025;
    const shelfThick = 0.022;

    // Left upright panel
    const leftUpright = new THREE.Mesh(new THREE.BoxGeometry(uprightThick, shelfH, shelfD), matFrame);
    leftUpright.userData.section = 'Frame';
    leftUpright.position.set(-shelfW / 2 + uprightThick / 2, shelfH / 2, 0);
    leftUpright.castShadow = true;
    leftUpright.receiveShadow = true;
    group.add(leftUpright);

    // Right upright panel
    const rightUpright = new THREE.Mesh(new THREE.BoxGeometry(uprightThick, shelfH, shelfD), matFrame);
    rightUpright.userData.section = 'Frame';
    rightUpright.position.set(shelfW / 2 - uprightThick / 2, shelfH / 2, 0);
    rightUpright.castShadow = true;
    rightUpright.receiveShadow = true;
    group.add(rightUpright);

    // Back panel
    const backW = Math.max(0.05, shelfW - uprightThick * 2);
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(backW, shelfH, 0.008), matShelves);
    backPanel.userData.section = 'Shelves';
    backPanel.position.set(0, shelfH / 2, -shelfD / 2 + 0.004);
    backPanel.castShadow = true;
    backPanel.receiveShadow = true;
    group.add(backPanel);

    // Horizontal shelves (bottom, intermediate tiers, and top)
    const innerW = shelfW - uprightThick * 2;
    const innerD = shelfD - 0.01;
    const count = this.shelfCount;
    const tierSpacing = (shelfH - count * shelfThick) / (count - 1);

    for (let i = 0; i < count; i++) {
      const y = shelfThick / 2 + i * (tierSpacing + shelfThick);
      const tier = new THREE.Mesh(new THREE.BoxGeometry(innerW, shelfThick, innerD), matShelves);
      tier.userData.section = 'Shelves';
      tier.position.set(0, y, 0.004);
      tier.castShadow = true;
      tier.receiveShadow = true;
      group.add(tier);
    }

    // Ensure local metric bounds for UV textures
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        ensureLocalMetricBounds(child);
      }
    });

    // Cel shading contour lines
    if (context.edgeMaterial || context.showCelOutlines !== false) {
      const lineMat = context.edgeMaterial || new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
          const line = new THREE.LineSegments(edges, lineMat);
          line.name = 'celOutline';
          mesh.add(line);
        }
      });
    }

    return group;
  }
}
