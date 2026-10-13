import * as THREE from 'three';
import { FurnitureObject } from './FurnitureObject';
import { SurfaceDescriptor, RenderContext } from '../SceneObject';
import { ensureLocalMetricBounds } from '../../../services/rendering/SurfaceFinishService';

export class BasinLowerFurniture extends FurnitureObject {
  constructor(id: string, name: string = 'Lower Basin Cabinet') {
    super(id, name, 'basin_cabinet_lower', 'bathroom');
    this.dimensions = { x: 0.80, y: 0.52, z: 0.42 };
  }

  getSurfaces(): SurfaceDescriptor[] {
    return [
      { key: 'cabinet_body', label: 'Cabinet Carcass', category: 'part' },
      { key: 'basin_top', label: 'Porcelain Basin Top', category: 'part' },
      { key: 'faucet', label: 'Mixer Faucet', category: 'part' },
      { key: 'handles', label: 'Drawer Handles', category: 'part' },
    ];
  }

  renderObject(context: RenderContext): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `furniture_${this.id}`;
    group.userData = { type: 'furniture', id: this.id, entity: this };

    const { finishService, materials = {} } = context;
    const cabW = Math.max(0.4, this.dimensions.x);
    const cabD = Math.max(0.3, this.dimensions.z);
    const totalH = Math.max(0.3, this.dimensions.y);
    const basinH = 0.08;
    const carcassH = totalH - basinH;

    // Resolve materials polymorphically from surface finishes
    const matCabinet = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('cabinet_body') || { type: 'wood', variant: 'oak_natural' }, { side: THREE.FrontSide })
      : (materials.woodOak || new THREE.MeshStandardMaterial({ color: 0xc8ad8d }));

    const matBasin = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('basin_top') || { type: 'porcelain', variant: 'porcelain_white' }, { side: THREE.FrontSide })
      : (materials.ceramicWhite || new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }));

    const matFaucet = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('faucet') || { type: 'metal', variant: 'matte_black_powder' }, { side: THREE.FrontSide })
      : (materials.metalBlack || new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.2 }));

    const matHandles = finishService
      ? finishService.getMaterial(this.getSurfaceFinish('handles') || { type: 'metal', variant: 'matte_black_powder' }, { side: THREE.FrontSide })
      : matFaucet;

    // 1. Integrated Porcelain Basin Top
    const basinTopW = cabW + 0.01;
    const basinTopD = cabD + 0.01;
    const basinRim = new THREE.Mesh(new THREE.BoxGeometry(basinTopW, basinH, basinTopD), matBasin);
    basinRim.userData.section = 'Basin Top';
    basinRim.position.set(0, totalH - basinH / 2, 0.005);
    basinRim.castShadow = true;
    basinRim.receiveShadow = true;
    group.add(basinRim);

    // 2. Sink bowl / inner cavity
    const sinkCavityW = Math.min(0.50, cabW * 0.65);
    const sinkCavityD = Math.min(0.28, cabD * 0.70);
    const sinkCavityH = 0.05;
    const sinkCavity = new THREE.Mesh(new THREE.BoxGeometry(sinkCavityW, sinkCavityH, sinkCavityD), matBasin);
    sinkCavity.userData.section = 'Basin Top';
    sinkCavity.position.set(0, totalH - basinH + sinkCavityH / 2 + 0.005, 0.02);
    group.add(sinkCavity);

    // Drain
    const drain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16),
      materials.metalChrome || new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 })
    );
    drain.userData.section = 'Basin Top';
    drain.position.set(0, totalH - basinH + 0.009, 0.02);
    group.add(drain);

    // 3. Mixer Faucet
    const tapZ = -cabD / 2 + 0.07;
    const tapBase = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 16), matFaucet);
    tapBase.userData.section = 'Faucet';
    tapBase.position.set(0, totalH + 0.06, tapZ);
    tapBase.castShadow = true;
    group.add(tapBase);

    const tapSpout = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.09), matFaucet);
    tapSpout.userData.section = 'Faucet';
    tapSpout.position.set(0, totalH + 0.11, tapZ + 0.045);
    tapSpout.castShadow = true;
    group.add(tapSpout);

    // 4. Cabinet Carcass
    const carcass = new THREE.Mesh(new THREE.BoxGeometry(cabW, carcassH, cabD), matCabinet);
    carcass.userData.section = 'Cabinet Body';
    carcass.position.set(0, carcassH / 2, 0);
    carcass.castShadow = true;
    carcass.receiveShadow = true;
    group.add(carcass);

    // Drawer Fronts & Handles
    const numDrawers = carcassH >= 0.45 ? 2 : 1;
    const drawerGap = 0.006;
    const drawerH = (carcassH - (numDrawers + 1) * drawerGap) / numDrawers;
    const drawerW = cabW - 0.012;

    for (let i = 0; i < numDrawers; i++) {
      const drawerY = drawerGap + i * (drawerH + drawerGap) + drawerH / 2;
      const front = new THREE.Mesh(new THREE.BoxGeometry(drawerW, drawerH, 0.018), matCabinet);
      front.userData.section = 'Cabinet Body';
      front.position.set(0, drawerY, cabD / 2 + 0.009);
      front.castShadow = true;
      group.add(front);

      // Handle
      const handleW = Math.min(0.24, drawerW * 0.4);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(handleW, 0.012, 0.024), matHandles);
      handle.userData.section = 'Handles';
      handle.position.set(0, drawerY + drawerH * 0.2, cabD / 2 + 0.022);
      handle.castShadow = true;
      group.add(handle);
    }

    // Metric bounds for UVs
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && !(child as any).isLineSegments) {
        ensureLocalMetricBounds(child);
      }
    });

    // Cel shading outline
    if (context.edgeMaterial || context.showCelOutlines !== false) {
      const lineMat = context.edgeMaterial || new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry && mesh.geometry.type !== 'SphereGeometry') {
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
