import { finite,immutable,positive } from './Immutable';
import type { SurfaceFinishConfig } from './PlanData';

export class SurfaceFinish {
  readonly config: Readonly<SurfaceFinishConfig>;

  constructor(config: SurfaceFinishConfig) {
    if (config.scale !== undefined) positive(config.scale, 'Texture scale');
    for (const field of ['roughness', 'metalness', 'rotation', 'groutWidth', 'layer'] as const) {
      if (config[field] !== undefined) finite(config[field], field);
    }
    if (config.roughness !== undefined && (config.roughness < 0 || config.roughness > 1)) throw new Error('Roughness must be between 0 and 1');
    if (config.metalness !== undefined && (config.metalness < 0 || config.metalness > 1)) throw new Error('Metalness must be between 0 and 1');
    this.config = immutable(config);
    Object.freeze(this);
  }

  static optional(config?: SurfaceFinishConfig): SurfaceFinishConfig | undefined {
    return config === undefined ? undefined : new SurfaceFinish(config).config;
  }
}
