import * as THREE from 'three';
import type { FurnitureEntity,SurfaceFinishConfig,WallEntity } from '../../core/types/plan';
import type { ViewportSettings } from '../../core/types/services';
import { surfaceSection } from '../../domain/model/SurfaceSections';
import type { ResourcePool } from '../resources/ResourcePool';
import type { SurfaceMaterialFactory } from './SurfaceMaterialFactory';
export class FurnitureAppearance {
  private readonly glowMaterials = new WeakSet<THREE.Mesh>();
  constructor(private readonly finishService: SurfaceMaterialFactory, private readonly resources: ResourcePool, private readonly settings: () => ViewportSettings, private readonly findWallForRecess: (item: FurnitureEntity) => WallEntity | null) { }
  apply(root: THREE.Object3D, entity: FurnitureEntity): void { this.applyFinishes(root, entity); this.applyLighting(root, entity); }
  applyFinishes(mesh: THREE.Object3D, entity: FurnitureEntity): void {
    if (!this.finishService) return;

    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        // Tag section if not already tagged
        if (!child.userData.section) {
          const matSec = (child.material as any)?.__section as string | undefined;
          if (matSec) {
            child.userData.section = matSec.charAt(0).toUpperCase() + matSec.slice(1);
          }
        }
        // Remember original default material
        if (child.userData.isLightEmissive && !this.glowMaterials.has(child)) {
          child.material = (child.material as THREE.Material).clone();
          this.glowMaterials.add(child);
        }
        this.resources.rememberOriginal(child);

        const sec = child.userData.section as string | undefined;
        if (sec === 'Screen') return;

        const isRecess =
          entity.assetKey === 'wall_recess' ||
          entity.assetKey === 'recess' ||
          entity.assetKey === 'girinti';

        // Check for section finish override (case-insensitive)
        let secFinish: SurfaceFinishConfig | undefined;
        if (sec) secFinish = entity.sectionFinishes?.[surfaceSection(sec, entity.assetKey)];

        if (!secFinish && isRecess) {
          const wall = this.findWallForRecess(entity);
          if (wall) {
            if (sec === 'Back' || sec === 'back') {
              secFinish = wall.finishSideB || wall.finish;
            } else if (sec === 'Sides' || sec === 'Corners' || sec === 'sides' || sec === 'corners') {
              secFinish = wall.finishEdges || wall.finishSideA || wall.finish;
            } else if (sec === 'Recess Wall' || sec === 'recess_wall') {
              secFinish = wall.finishSideA || wall.finish;
            }
          }
        }

        if (secFinish) {
          if (secFinish.type === 'fabric') {
            const isLinen = secFinish.variant?.includes('linen');
            const isStretched = secFinish.mappingMode === 'stretched'
              ? true
              : secFinish.mappingMode === 'tiled'
                ? false
                : !isLinen;

            if (isStretched) {
              this.finishService!.ensureStretchedUvs?.(child);
            } else {
              this.finishService!.ensureLocalMetricBounds?.(child);
            }
          } else {
            this.finishService!.ensureLocalMetricBounds?.(child);
          }
          const mat = this.finishService!.getMaterial(secFinish, {
            projection: 'local',
            side: isRecess ? THREE.DoubleSide : undefined,
          });
          child.material = mat;
          child.visible = !(mat as any).isInvisible && (mat as any).visible !== false;
        } else if (entity.finish) {
          if (child.userData.isLightEmissive || sec === 'Diffuser' || sec === 'Lens' || sec === 'Bulb') {
            return;
          }
          if (entity.finish.type === 'fabric') {
            const isLinen = entity.finish.variant?.includes('linen');
            const isStretched = entity.finish.mappingMode === 'stretched'
              ? true
              : entity.finish.mappingMode === 'tiled'
                ? false
                : !isLinen;

            if (isStretched) {
              this.finishService!.ensureStretchedUvs?.(child);
            } else {
              this.finishService!.ensureLocalMetricBounds?.(child);
            }
          } else {
            this.finishService!.ensureLocalMetricBounds?.(child);
          }
          const mat = this.finishService!.getMaterial(entity.finish, {
            projection: 'local',
            side: isRecess ? THREE.DoubleSide : undefined,
          });
          child.material = mat;
          child.visible = !(mat as any).isInvisible && (mat as any).visible !== false;
        } else if (this.resources.original(child)) {
          child.material = this.resources.original(child)!;
          child.visible = true;
        }
      }
    });
  }

  applyLighting(mesh: THREE.Object3D, entity?: FurnitureEntity): void {
    const config = entity?.lightConfig;
    const isEnabled = config?.enabled !== false;
    const customIntensity = config?.intensity ?? 1.0;
    const customColor = config?.color;

    mesh.traverse((child) => {
      // 1. Fixture Point Lights
      if ((child as any).isPointLight && child.userData?.isFixtureLight) {
        const pointLight = child as THREE.PointLight;
        const fixtureType = child.userData.fixtureType as 'chandelier' | 'spot' | undefined;
        const typeMult = fixtureType === 'chandelier'
          ? (this.settings().chandelierIntensity ?? 1.0)
          : (this.settings().spotLightIntensity ?? 1.0);

        const baseInt = child.userData.baseIntensity ?? 0.8;
        const baseDist = child.userData.baseDistance ?? 5.0;
        const baseColor = child.userData.baseColor ?? 0xfff2dc;

        if (isEnabled && typeMult > 0 && customIntensity > 0) {
          const finalIntensity = baseInt * typeMult * customIntensity;
          pointLight.intensity = finalIntensity;
          pointLight.distance = baseDist * Math.sqrt(Math.max(0.2, typeMult * customIntensity));
          if (customColor) {
            pointLight.color.set(customColor);
          } else {
            pointLight.color.set(baseColor);
          }
          pointLight.visible = true;
        } else {
          pointLight.intensity = 0;
          pointLight.visible = false;
        }
      }

      // 2. Glowing Diffusers / Lenses / Bulbs (isLightEmissive)
      if (child instanceof THREE.Mesh && child.userData?.isLightEmissive) {
        const fixtureType = (mesh.userData?.prevAssetKey || entity?.assetKey || '').toLowerCase().includes('chandelier')
          ? 'chandelier'
          : 'spot';
        const typeMult = fixtureType === 'chandelier'
          ? (this.settings().chandelierIntensity ?? 1.0)
          : (this.settings().spotLightIntensity ?? 1.0);

        const isLit = isEnabled && typeMult > 0.05 && customIntensity > 0.05;
        if (child.material && 'color' in child.material) {
          const mat = child.material as THREE.MeshBasicMaterial;
          if (isLit) {
            if (customColor) {
              mat.color.set(customColor);
            } else {
              mat.color.set(0xfff6dd); // warm golden white glow
            }
          } else {
            mat.color.set(0x334155); // dark slate off-bulb
          }
        }
      }
    });
  }
}
