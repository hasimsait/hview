import * as THREE from 'three';
import type { WallEntity } from '../../core/types/plan';
import { applyBasicOcclusionShader,createOcclusionUniforms } from './OcclusionShader';
import { SurfaceMaterialFactory } from './SurfaceMaterialFactory';
export class WallSurfacePalette {
  register(mesh: THREE.Mesh, surface: 'body' | 'frame' | 'baseboard'): void { this.surfaces.set(mesh, surface); }
  baseboard(wall: WallEntity): THREE.Material { return this.finishService.getMaterial(wall.finishBaseboard ?? { type: 'wood', variant: 'natural_oak' }, { side: THREE.FrontSide }); }
  private readonly surfaces = new WeakMap<THREE.Mesh, 'body' | 'frame' | 'baseboard'>();

  private wallMaterial: THREE.MeshStandardMaterial;

  private edgeMaterial: THREE.LineBasicMaterial;

  private finishService: SurfaceMaterialFactory;

  private wallUniforms = createOcclusionUniforms();

  constructor(finishService: SurfaceMaterialFactory) {
    this.finishService = finishService;
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x0f172a,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xefede8, // Warm off-white architectural plaster
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: true,
    });

    applyBasicOcclusionShader(this.wallMaterial, this.wallUniforms, 0.5);
  }

  getMaterial(): THREE.MeshStandardMaterial {
    return this.wallMaterial;
  }

  getEdgeMaterial(): THREE.LineBasicMaterial {
    return this.edgeMaterial;
  }

  setWallOpacity(opacity: number): void {
    const op = opacity < 1.0 ? opacity : 0.15;
    this.wallUniforms.uForegroundOpacity.value = op;
    this.finishService.setForegroundOpacity(op);
  }

  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.wallUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.wallUniforms.uCameraDir.value.copy(cameraDir);
    this.finishService.updateOrbitPlane(orbitCenter, cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    const val = mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
    this.wallUniforms.uForegroundMode.value = val;
    this.finishService.setForegroundMode(mode);
  }

  setCelShading(enabled: boolean): void {
    this.edgeMaterial.color.set(enabled ? 0x000000 : 0x0f172a);
    this.edgeMaterial.opacity = enabled ? 1.0 : 0.6;
    this.edgeMaterial.needsUpdate = true;
  }

  getMaterialForSide(wall: WallEntity, side: 'A' | 'B'): THREE.Material {
    const sideFinish = side === 'A' ? wall.finishSideA : wall.finishSideB;
    if (sideFinish) {
      return this.finishService.getMaterial(sideFinish, { side: THREE.FrontSide });
    }
    if (wall.finish) {
      return this.finishService.getMaterial(wall.finish, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_glass' || wall.material === 'glass') {
      return this.finishService.getMaterial({ type: 'glass', variant: 'frosted_mica' }, { side: THREE.FrontSide });
    }
    if (wall.color) {
      return this.finishService.getMaterial({ type: 'paint', color: wall.color }, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_brick') {
      return this.finishService.getMaterial({ type: 'plaster', variant: 'brick', color: '#dfd3c3' }, { side: THREE.FrontSide });
    }
    return this.wallMaterial;
  }

  getMaterialForWall(wall: WallEntity): THREE.Material {
    return this.getMaterialForSide(wall, 'A');
  }

  getMaterialForEdges(wall: WallEntity): THREE.Material {
    if (wall.finishEdges) {
      return this.finishService.getMaterial(wall.finishEdges, { side: THREE.FrontSide });
    }
    if (wall.finish) {
      return this.finishService.getMaterial(wall.finish, { side: THREE.FrontSide });
    }
    if (wall.finishSideA && wall.finishSideB) {
      return this.finishService.getMaterial(wall.finishSideA, { side: THREE.FrontSide });
    }
    if (wall.finishSideA) {
      return this.finishService.getMaterial(wall.finishSideA, { side: THREE.FrontSide });
    }
    if (wall.finishSideB) {
      return this.finishService.getMaterial(wall.finishSideB, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_glass' || wall.material === 'glass') {
      return this.finishService.getMaterial({ type: 'glass', variant: 'frosted_mica' }, { side: THREE.FrontSide });
    }
    if (wall.color) {
      return this.finishService.getMaterial({ type: 'paint', color: wall.color }, { side: THREE.FrontSide });
    }
    if (wall.material === 'a_brick') {
      return this.finishService.getMaterial({ type: 'plaster', variant: 'brick', color: '#dfd3c3' }, { side: THREE.FrontSide });
    }
    return this.wallMaterial;
  }

  get palette(): readonly THREE.Material[] { return [this.wallMaterial, this.edgeMaterial]; }

  materialsFor(wall: WallEntity): THREE.Material[] {
    const matSideA = this.getMaterialForSide(wall, 'A');
    const matSideB = this.getMaterialForSide(wall, 'B');
    const matEdgeStart = wall.finishEdgeStart
      ? this.finishService.getMaterial(wall.finishEdgeStart, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matEdgeEnd = wall.finishEdgeEnd
      ? this.finishService.getMaterial(wall.finishEdgeEnd, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matEdgeTop = wall.finishEdgeTop
      ? this.finishService.getMaterial(wall.finishEdgeTop, { side: THREE.FrontSide })
      : this.getMaterialForEdges(wall);
    const matJambs = this.getMaterialForEdges(wall);

    return [
      matSideA,        // 0: Side A
      matSideB,        // 1: Side B
      matEdgeStart,    // 2: Edge Start (p1)
      matEdgeEnd,      // 3: Edge End (p2)
      matEdgeTop,      // 4: Edge Top (sill)
      matJambs,        // 5: Doorway/window jambs & bottom
    ];

  }

  applyMaterials(root: THREE.Object3D, wall: WallEntity): void {
    const body = this.materialsFor(wall);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const surface = this.surfaces.get(object);
      if (surface === 'body') object.material = body;
      else if (surface === 'frame') object.material = this.getFrameMaterial(wall.frameColor);
      else if (surface === 'baseboard') object.material = this.finishService.getMaterial(wall.finishBaseboard ?? { type: 'wood', variant: 'natural_oak' }, { side: THREE.FrontSide });
    });
  }

  getFrameMaterial(colorHex?: string): THREE.Material {
    const hex = (colorHex || '#18181b').toLowerCase();
    let variant = 'matte_black_powder';
    if (hex === '#ffffff' || hex === '#f8fafc' || hex === '#f1f5f9') {
      variant = 'matte_white_powder';
    } else if (
      hex === '#d4af37' ||
      hex === '#ebd48e' ||
      hex === '#d4b359' ||
      hex === '#ffd700' ||
      hex === '#b8860b'
    ) {
      variant = 'brass_brushed';
    } else if (
      hex === '#cbd5e1' ||
      hex === '#e2e8f0' ||
      hex === '#cccccc'
    ) {
      variant = 'chrome_satin';
    }
    return this.finishService.getMaterial(
      {
        type: 'metal',
        variant,
        color: hex,
      },
      { side: THREE.FrontSide }
    );
  }
}
