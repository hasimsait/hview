import * as THREE from 'three';
import { FurnitureObject } from './FurnitureObject';
import { SurfaceDescriptor, PropertyDescriptor, RenderContext, ILightEmitter } from '../SceneObject';
import { ensureLocalMetricBounds } from '../../../services/rendering/SurfaceFinishService';

export class LightFixtureFurniture extends FurnitureObject implements ILightEmitter {
  enabled: boolean = true;
  intensity: number = 1.0;
  color: string = '#fff5ea';
  temperature: number = 3000;

  constructor(id: string, name: string = 'Wall Spot / Sconce', assetKey: string = 'wall_spot') {
    super(id, name, assetKey, 'fixture');
    this.dimensions = { x: 0.12, y: 0.16, z: 0.14 };
  }

  getSurfaces(): SurfaceDescriptor[] {
    return [
      { key: 'fixture_body', label: 'Metal Fixture Body', category: 'part' },
      { key: 'emissive_lens', label: 'Diffuser Lens (Light Source)', category: 'part' },
    ];
  }

  getInspectableProperties(): PropertyDescriptor[] {
    return [
      ...super.getInspectableProperties(),
      {
        key: 'lightEnabled',
        label: 'Light Emitting',
        type: 'boolean',
        value: this.enabled,
      },
      {
        key: 'lightIntensity',
        label: 'Light Intensity',
        type: 'number',
        value: this.intensity,
        min: 0,
        max: 3,
        step: 0.1,
      },
      {
        key: 'lightColor',
        label: 'Light Color',
        type: 'color',
        value: this.color,
      },
    ];
  }

  setPropertyValue(propertyKey: string, value: any): void {
    switch (propertyKey) {
      case 'lightEnabled':
        this.enabled = Boolean(value);
        break;
      case 'lightIntensity':
        this.intensity = Number(value);
        break;
      case 'lightColor':
        this.color = String(value);
        break;
      default:
        super.setPropertyValue(propertyKey, value);
    }
  }

  renderObject(context: RenderContext): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `furniture_${this.id}`;
    group.userData = { type: 'furniture', id: this.id, entity: this };

    const { finishService, materials = {} } = context;

    const matBody = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('fixture_body') || { type: 'metal', variant: 'matte_black_powder' }, { side: THREE.FrontSide })
      : (materials.metalBlack || new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8 }));

    const emissiveColor = new THREE.Color(this.color);
    const matLens = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: emissiveColor,
      emissiveIntensity: this.enabled ? this.intensity * 2.5 : 0.05,
      roughness: 0.3,
    });

    // 1. Wall mounting plate
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24), matBody);
    basePlate.rotation.x = Math.PI / 2;
    basePlate.position.set(0, 0, -this.dimensions.z / 2 + 0.006);
    basePlate.castShadow = true;
    group.add(basePlate);

    // 2. Swivel arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 12), matBody);
    arm.position.set(0, 0, -this.dimensions.z / 2 + 0.035);
    arm.rotation.x = Math.PI / 2;
    group.add(arm);

    // 3. Spotlight canister
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.08, 24), matBody);
    can.rotation.x = Math.PI / 4; // Angled down
    can.position.set(0, -0.01, 0.01);
    can.castShadow = true;
    group.add(can);

    // 4. Emissive lens
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), matLens);
    lens.position.set(0, -0.038, 0.038);
    lens.rotation.x = Math.PI / 4 + Math.PI;
    group.add(lens);

    // 5. Emitted light source (PointLight / SpotLight)
    if (this.enabled) {
      const spot = new THREE.SpotLight(emissiveColor, this.intensity * 8, 4.5, Math.PI / 4, 0.4, 1);
      spot.position.set(0, -0.04, 0.04);
      const targetObj = new THREE.Object3D();
      targetObj.position.set(0, -1.0, 0.5);
      group.add(targetObj);
      spot.target = targetObj;
      group.add(spot);
    }

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        ensureLocalMetricBounds(child);
      }
    });

    if (context.edgeMaterial || context.showCelOutlines !== false) {
      const lineMat = context.edgeMaterial || new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry && mesh.geometry.type !== 'CircleGeometry') {
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
