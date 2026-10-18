import type { OpeningEntity,WallEntity } from '@core/types/plan';
import * as THREE from 'three';
import { buildWindowDressing } from './WindowDressingGeometry';
import { windowDressingDefaults } from '../../domain/model/WindowDressing';
import { pleatedCurtainGeometry } from './PleatedCurtainGeometry';

export interface CurtainMount {
  ceilingHeight?: number;
  interiorSide?: 1 | -1;
}

/** A ceiling track and two open, pleated panels, owned by their window. */
export class CurtainMeshBuilder {
  constructor(private readonly fabric: THREE.Material, private readonly track: THREE.Material,
    private readonly textile?: (color: string, sheer: boolean) => THREE.Material) { }

  build(window: OpeningEntity, wall: WallEntity, mount: CurtainMount = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = `curtains_${window.id}`;
    group.visible = window.curtainState !== 'hidden';
    const ceiling = mount.ceilingHeight ?? wall.height;
    const side = mount.interiorSide ?? (wall.roomSideA || !wall.roomSideB ? 1 : -1);
    if (window.windowDressing && this.textile) {
      const config = window.windowDressing, defaults = windowDressingDefaults(config.style);
      const blind = ['roller', 'roman', 'venetian'].includes(config.style);
      const bottom = blind ? Math.max(0, window.floorHeight - .04) : .025;
      const height = blind ? Math.min(window.height + .08, Math.max(.01, ceiling - bottom)) : Math.max(.01, ceiling - bottom);
      const fabric = this.textile(config.color ?? defaults.color, false);
      const sheer = this.textile(config.style === 'sheer' ? config.color ?? defaults.color : config.liningColor ?? defaults.liningColor, true);
      buildWindowDressing(group, window.width + (blind ? .06 : .3), height, config.style === 'layered' ? .22 : .12,
        config.style, config.openness ?? defaults.openness, fabric, sheer, this.track);
      group.position.set(0, bottom, side * (wall.thickness / 2 + .12)); group.scale.z = side;
      return group;
    }
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
      const folds = Math.max(4, Math.min(12, Math.round(panelWidth / .09)));
      const geometry = pleatedCurtainGeometry(panelWidth, drop, .06, folds);
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
