import type { SurfaceFinishConfig } from './PlanData';
import { finite, positive } from './Immutable';
import { SurfaceFinish } from './SurfaceFinish';

export const CORNICE_PROFILES = { none: 'None', plain: 'Plain square', cove: 'Classic cove', stepped: 'Stepped', ogee: 'Ogee' } as const;
export interface WallCorniceConfig {
  profile: keyof typeof CORNICE_PROFILES;
  height: number;
  depth: number;
  offset: number;
  side: 'interior' | 'A' | 'B' | 'both';
  hidden?: boolean;
  finish?: SurfaceFinishConfig;
}
export function defaultWallCornice(inFrontOfCurtains = false): WallCorniceConfig {
  return { profile: 'cove', height: .12, depth: .12, offset: inFrontOfCurtains ? .17 : 0, side: 'interior' };
}
export function validateWallCornice(c: WallCorniceConfig): void {
  if (!c || !Object.hasOwn(CORNICE_PROFILES, c.profile) || !['interior', 'A', 'B', 'both'].includes(c.side)) throw new Error('Invalid wall cornice');
  if (positive(c.height, 'Cornice height') > 1 || positive(c.depth, 'Cornice depth') > 1 || finite(c.offset, 'Cornice offset') < 0 || c.offset > 2) throw new Error('Invalid cornice dimensions');
  if (c.hidden !== undefined && typeof c.hidden !== 'boolean') throw new Error('Invalid cornice visibility');
  if (c.finish) SurfaceFinish.optional(c.finish);
}
