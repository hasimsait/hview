import type { OpeningEntity,WallEntity } from '@core/types/plan';
import * as THREE from 'three';

export interface CurtainMount {
  ceilingHeight?: number;
  interiorSide?: 1 | -1;
}

/** A ceiling track and two open, pleated panels, owned by their window. */
export class CurtainMeshBuilder {
  constructor(private readonly fabric: THREE.Material, private readonly track: THREE.Material) { }

  build(window: OpeningEntity, wall: WallEntity, mount: CurtainMount = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = `curtains_${window.id}`;
    group.visible = window.curtainState !== 'hidden';
    const ceiling = mount.ceilingHeight ?? wall.height;
    const side = mount.interiorSide ?? (wall.roomSideA || !wall.roomSideB ? 1 : -1);
    const width = window.width + 0.3;
    const top = ceiling - 0.035;
    const bottom = 0.025;
    const drop = Math.max(0.01, top - bottom);
    const z = side * (wall.thickness / 2 + 0.12);

    const track = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, 0.045), this.track);
    track.name = `curtain_track_${window.id}`;
    track.position.set(0, ceiling - 0.0125, z);
    group.add(track);

    const panelWidth = width * 0.28;
    for (const [name, direction] of [['left', -1], ['right', 1]] as const) {
      const geometry = new THREE.PlaneGeometry(panelWidth, drop, 40, 12);
      const positions = geometry.attributes.position;
      // Real geometry gives the cloth folds depth and natural light/shadow.
      for (let i = 0; i < positions.count; i++) {
        const across = positions.getX(i) / panelWidth + 0.5;
        const down = 0.5 - positions.getY(i) / drop;
        positions.setZ(i, side * Math.sin(across * Math.PI * 12 + down * 0.12) * (0.025 + down * 0.01));
      }
      geometry.computeVertexNormals();
      const panel = new THREE.Mesh(geometry, this.fabric);
      panel.name = `curtain_${name}_${window.id}`;
      panel.position.set(direction * (width - panelWidth) / 2, (top + bottom) / 2, z);
      panel.castShadow = true;
      panel.receiveShadow = true;
      group.add(panel);
    }
    return group;
  }
}
