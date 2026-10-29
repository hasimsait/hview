import type { SurfaceFinishConfig } from '../model/PlanData';

export interface BillyFinish {
  id: string; name: string; color: string; grain?: 'walnut' | 'oak'; finish: SurfaceFinishConfig;
}
/** Photo-reference planning tones; distinct from generic hardwood finishes. */
export const BILLY_FINISHES: readonly BillyFinish[] = [
  { id: 'billy_white', name: 'BILLY White', color: '#f3f1eb', finish: { type: 'paint', variant: 'billy_white', color: '#f3f1eb', roughness: .65 } },
  { id: 'billy_walnut_effect', name: 'BILLY Walnut Effect', color: '#9d7b5b', grain: 'walnut', finish: { type: 'wood', variant: 'billy_walnut_effect', color: '#9d7b5b', roughness: .65, metalness: 0 } },
  { id: 'billy_oak_effect', name: 'BILLY Oak Effect', color: '#c0b099', grain: 'oak', finish: { type: 'wood', variant: 'billy_oak_effect', color: '#c0b099', roughness: .65, metalness: 0 } },
];
export const billyFinish = (variant?: string): BillyFinish | undefined => BILLY_FINISHES.find(finish => finish.id === variant);
export function billyAssetFinish(key: string): BillyFinish {
  return BILLY_FINISHES[key.includes('walnut') ? 1 : key.includes('oak') ? 2 : 0];
}
