import type { ViewportSettings } from '../../core/types/services';

/** At 100 lux, Lambertian 18% grey emits 100 * .18 / pi cd/m².
 * pi/100 maps it back to 18% linear display grey. This is a fixed indoor
 * reference, not auto-exposure that brightens a room when its lamps go out.
 * The legacy daylight fill uses relative rather than photometric units.
 */
export const INDOOR_EXPOSURE = Math.PI / 100;
export function lightingExposure(settings: Pick<ViewportSettings, 'exposure'> & Partial<Pick<ViewportSettings, 'globalLighting' | 'globalLightIntensity'>>): number {
  return settings.exposure ?? (settings.globalLighting === false || (settings.globalLightIntensity ?? 1) <= .001 ? INDOOR_EXPOSURE : 1);
}
