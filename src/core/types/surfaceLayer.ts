import { SurfaceFinishConfig } from './plan';

export const MIN_SURFACE_LAYER = -1000;
export const MAX_SURFACE_LAYER = 1000;

export function normalizeSurfaceLayer(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(MIN_SURFACE_LAYER, Math.min(MAX_SURFACE_LAYER, Math.trunc(value)));
}

export function preserveSurfaceLayer(finish: SurfaceFinishConfig, current?: SurfaceFinishConfig): SurfaceFinishConfig {
  return { ...finish, layer: normalizeSurfaceLayer(finish.layer ?? current?.layer) };
}
