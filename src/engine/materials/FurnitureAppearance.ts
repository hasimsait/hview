import * as THREE from 'three';
import type { FurnitureEntity,SurfaceFinishConfig } from '../../core/types/plan';
import { WallRecess, type RecessHost } from '../../domain/elements/WallRecess';
import type { ViewportSettings } from '../../core/types/services';
import { surfaceSection } from '../../domain/model/SurfaceSections';
import type { ResourcePool } from '../resources/ResourcePool';
import { isFabricStretched,type SurfaceMaterialFactory } from './SurfaceMaterialFactory';
import { isFixtureLight } from '../lighting/FixtureLight';
export class FurnitureAppearance {
  private readonly glowMaterials = new WeakSet<THREE.Mesh>();
  constructor(private readonly finishService: SurfaceMaterialFactory, private readonly resources: ResourcePool, private readonly settings: () => ViewportSettings, private readonly recessHost: (item: WallRecess) => RecessHost | undefined) { }
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

        const isRecess = entity instanceof WallRecess;
        const section = sec ? surfaceSection(sec, entity.assetKey) : undefined;
        let secFinish: SurfaceFinishConfig | undefined = section ? entity.sectionFinishes?.[section] : undefined;
        if (!secFinish && isRecess && section) secFinish = entity.inheritedFinish(section, this.recessHost(entity));

        const content = child.userData.cabinetContent as import('../../domain/cabinet/CabinetLayout').CabinetContent | undefined;
        const panel = child.userData.cabinetPanel as import('../../domain/cabinet/CabinetLayout').CabinetPanel | undefined;
        const activeFinish = content ? (section ? content.sectionFinishes?.[section] : undefined) ?? content.finish : panel?.finish ?? secFinish ?? (
          child.userData.isLightEmissive || sec === 'Diffuser' || sec === 'Lens' || sec === 'Bulb'
            ? undefined
            : entity.finish
        );

        if (activeFinish) {
          if (activeFinish.type === 'fabric' && isFabricStretched(activeFinish)) {
            this.finishService.ensureStretchedUvs?.(child);
          } else {
            this.finishService.ensureLocalMetricBounds?.(child);
          }
          const mat = this.finishService.getMaterial(activeFinish, {
            projection: 'local',
            side: isRecess ? THREE.DoubleSide : undefined,
          });
          if (child.userData.isTextile && !(mat as THREE.Material & { isInvisible?: boolean }).isInvisible) {
            const textile = mat.clone(); textile.side = THREE.DoubleSide;
            if ('defines' in mat) (textile as THREE.ShaderMaterial).defines = { ...(mat as THREE.ShaderMaterial).defines };
            textile.onBeforeCompile = mat.onBeforeCompile; textile.customProgramCacheKey = mat.customProgramCacheKey;
            if (child.userData.isSheer) { textile.opacity = .28; textile.transparent = true; textile.depthWrite = false; }
            child.material = textile;
          } else child.material = mat;
          child.visible = !(mat as any).isInvisible && mat.visible !== false;
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
    let fixtureType = (entity?.assetKey ?? '').includes('chandelier') ? 'chandelier' : 'spot';
    mesh.traverse(child => { if (isFixtureLight(child)) fixtureType = child.userData.fixtureType ?? fixtureType; });

    mesh.traverse((child) => {
      // 1. Actual room lights, including directional spotlight beams.
      if (isFixtureLight(child)) {
        const pointLight = child;
        const typeMult = child.userData.fixtureType === 'chandelier'
          ? (this.settings().chandelierIntensity ?? 1.0)
          : (this.settings().spotLightIntensity ?? 1.0);

        const baseInt = child.userData.baseIntensity ?? 0.8;
        const baseDist = child.userData.baseDistance ?? 5.0;
        const baseColor = child.userData.baseColor ?? 0xfff2dc;

        if (isEnabled && typeMult > 0 && customIntensity > 0) {
          const finalIntensity = baseInt * typeMult * customIntensity;
          pointLight.intensity = finalIntensity;
          if ('distance' in pointLight) pointLight.distance = baseDist * Math.sqrt(Math.max(0.2, typeMult * customIntensity));
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
