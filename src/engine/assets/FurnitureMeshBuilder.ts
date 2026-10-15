import * as THREE from 'three';
import { AssetCatalog } from "../../domain/catalog/AssetCatalog";
import type { Furniture } from '../../domain/elements/Furniture';
import { ensureLocalMetricBounds,ensureStretchedUvs } from "../materials/SurfaceMaterialFactory";
import { TextureSource } from '../materials/TextureSource';
import { AssetBuildContext,ProceduralMaterials } from "./builders/AssetBuildContext";
import { FURNITURE_GEOMETRY } from "./FurnitureGeometryLibrary";

export class FurnitureMeshBuilder {
  // Shared occlusion uniforms — same pattern as WallMeshBuilder.
  // Driven each frame by SceneEngine via updateOrbitPlane().
  private occlusionUniforms = {
    uOrbitCenter: { value: new THREE.Vector3(0, 0, 0) },
    uCameraDir: { value: new THREE.Vector3(0, 0, 1) },
    uForegroundMode: { value: 1 }, // 0=solid, 1=transparent, 2=clip
    uForegroundOpacity: { value: 0.15 },
  };

  // Shared materials for architectural rendering
  private materials: ProceduralMaterials = {
    woodLight: new THREE.MeshStandardMaterial({ color: 0xdfcbaf, roughness: 0.5 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.6 }),
    fabricLight: new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.85 }),
    fabricBlue: new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.8 }),
    fabricDark: new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.9 }),
    fabricBeige: new THREE.MeshStandardMaterial({ color: 0xc8b8a6, roughness: 0.85 }),
    metalChrome: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.96, roughness: 0.06 }),
    metalBlack: new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.15, roughness: 0.70 }),
    metalBrass: new THREE.MeshStandardMaterial({ color: 0xebd48e, metalness: 0.92, roughness: 0.08 }),
    ceramicWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.02 }),
    graniteCounter: new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      transmission: 0.7,
      ior: 1.5,
    }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.05 }),
    mirrorNonReflective: new THREE.MeshStandardMaterial({ color: 0xdce5ed, roughness: 0.25, metalness: 0.15 }),
    cabinetSage: new THREE.MeshStandardMaterial({ color: 0x3a4843, roughness: 0.55 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    ledGlow: new THREE.MeshBasicMaterial({ color: 0xfffaed }),
    warmLightGlow: new THREE.MeshBasicMaterial({ color: 0xfff6dd }),
  };



  get palette(): readonly THREE.Material[] { return Object.values(this.materials); }

  constructor(readonly catalog = new AssetCatalog(), textures = new TextureSource()) {
    // Inject orbit-fade shader into every opaque MeshStandardMaterial.
    // MeshBasicMaterial and MeshPhysicalMaterial (glass) are excluded —
    // basics have no lighting pipeline, glass is already transparent.
    const opaqueMats: THREE.MeshStandardMaterial[] = [
      this.materials.woodLight, this.materials.woodDark,
      this.materials.fabricLight, this.materials.fabricBlue,
      this.materials.fabricDark, this.materials.fabricBeige,
      this.materials.metalChrome, this.materials.metalBlack, this.materials.metalBrass,
      this.materials.ceramicWhite, this.materials.graniteCounter,
      this.materials.mirror, this.materials.mirrorNonReflective,
      this.materials.cabinetSage,
    ];
    for (const mat of opaqueMats) {
      mat.transparent = true;
      this.applyOcclusionShader(mat);
    }

    // Load photographic wood veneers for default architectural furniture
    if (typeof document !== 'undefined' && typeof (document as any).createElementNS === 'function') {
      const loader = textures.textureLoader();
      loader.load('/textures/wood/wood_natural_oak.jpg', (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.materials.woodLight.map = tex;
        this.materials.woodLight.color.setHex(0xffffff);
        this.materials.woodLight.roughness = 0.45;
        this.materials.woodLight.needsUpdate = true;
      });
      loader.load('/textures/wood/wood_american_walnut.jpg', (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.materials.woodDark.map = tex;
        this.materials.woodDark.color.setHex(0xffffff);
        this.materials.woodDark.roughness = 0.50;
        this.materials.woodDark.needsUpdate = true;
      });
    }

    // Tag each material with its paintable section name so the Inspector can
    // enumerate distinct sections from the live mesh without per-mesh naming.
    (this.materials.woodLight as any).__section = 'wood';
    (this.materials.woodDark as any).__section = 'wood';
    (this.materials.cabinetSage as any).__section = 'wood';
    (this.materials.fabricLight as any).__section = 'fabric';
    (this.materials.fabricBlue as any).__section = 'fabric';
    (this.materials.fabricDark as any).__section = 'fabric';
    (this.materials.fabricBeige as any).__section = 'fabric';
    (this.materials.metalChrome as any).__section = 'metal';
    (this.materials.metalBlack as any).__section = 'metal';
    (this.materials.metalBrass as any).__section = 'metal';
    (this.materials.ceramicWhite as any).__section = 'ceramic';
    (this.materials.graniteCounter as any).__section = 'stone';
    (this.materials.glass as any).__section = 'glass';
    (this.materials.mirror as any).__section = 'glass';
    (this.materials.mirrorNonReflective as any).__section = 'glass';
  }


  /** Inject the same orbit-occlusion GLSL used by walls into a material. */
  private applyOcclusionShader(mat: THREE.MeshStandardMaterial): void {
    const u = this.occlusionUniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOrbitCenter = u.uOrbitCenter;
      shader.uniforms.uCameraDir = u.uCameraDir;
      shader.uniforms.uForegroundMode = u.uForegroundMode;
      shader.uniforms.uForegroundOpacity = u.uForegroundOpacity;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vCustomWorldPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 _cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          _cwp = instanceMatrix * _cwp;
        #endif
        vCustomWorldPos = (modelMatrix * _cwp).xyz;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3  uOrbitCenter;
        uniform vec3  uCameraDir;
        uniform int   uForegroundMode;
        uniform float uForegroundOpacity;
        varying vec3  vCustomWorldPos;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uForegroundMode > 0) {
          float dist = dot(vCustomWorldPos - uOrbitCenter, uCameraDir);
          if (dist > 0.0) {
            if (uForegroundMode == 1) {
              float fade = smoothstep(0.0, 0.6, dist);
              gl_FragColor.a *= mix(1.0, uForegroundOpacity, fade);
            } else if (uForegroundMode == 2) {
              if (dist > 0.1) discard;
            }
          }
        }`
      );
    };
  }

  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.occlusionUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.occlusionUniforms.uCameraDir.value.copy(cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    this.occlusionUniforms.uForegroundMode.value =
      mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
  }

  build(entity: Furniture): THREE.Object3D {
    const key = entity.assetKey;
    const w = entity.dimensions.x;
    const h = entity.dimensions.y;
    const d = entity.dimensions.z;

    const group = new THREE.Group();
    group.name = `furniture_${entity.id}`;
    group.userData = { type: 'furniture', id: entity.id, entity };

    const context: AssetBuildContext = {
      parent: group,
      entity,
      w,
      h,
      d,
      materials: this.materials,
    };

    // Strategy Pattern: dispatch directly to the registered builder
    FURNITURE_GEOMETRY[this.catalog.recipe(key)](context);

    // Universal fallback: ensure every paintable mesh has a readable section name and local metric bounds
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        if (!child.userData.section) {
          const matSec = (child.material as any)?.__section as string | undefined;
          if (matSec) {
            child.userData.section = matSec.charAt(0).toUpperCase() + matSec.slice(1);
          }
        }
        const isFabric =
          child.userData.section === 'Fabric' ||
          child.userData.section === 'Seat' ||
          child.userData.section === 'Backrest' ||
          child.userData.section === 'Armrests' ||
          child.userData.section === 'Cushion' ||
          child.userData.section === 'Cushions' ||
          child.userData.section === 'Pillow' ||
          child.userData.section === 'Pillows' ||
          child.userData.section === 'Mattress' ||
          child.userData.section === 'Duvet' ||
          child.userData.section === 'Headboard' ||
          (child.material as any)?.__section === 'fabric';

        if (isFabric) {
          ensureStretchedUvs(child);
        } else {
          ensureLocalMetricBounds(child);
        }
      }

    });

    // Add crisp architectural cel-shading contour outlines
    this.addCelOutlines(group);

    return group;
  }

  private celOutlineMaterial = new THREE.LineBasicMaterial({
    color: 0x0f172a,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.7,
  });

  private addCelOutlines(parent: THREE.Object3D): void {
    parent.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        // Skip small light bulbs / spheres and smooth curved hoses
        if (mesh.geometry.type === 'SphereGeometry' || mesh.geometry.type === 'TubeGeometry') return;
        const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
        const line = new THREE.LineSegments(edges, this.celOutlineMaterial);
        line.name = 'celOutline';
        mesh.add(line);
      }
    });
  }

  setCelShading(enabled: boolean): void {
    this.celOutlineMaterial.color.set(enabled ? 0x000000 : 0x0f172a);
    this.celOutlineMaterial.opacity = enabled ? 1.0 : 0.6;
    this.celOutlineMaterial.needsUpdate = true;
  }
}
