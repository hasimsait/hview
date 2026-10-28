import * as THREE from 'three';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';

/** CSS/hex colours and photographic/canvas RGB are sRGB. Three decodes them once.
 * A texture that already contains its finish colour must have a white material
 * multiplier; solid coatings carry their colour in the material instead. */
export function surfaceColor(config: SurfaceFinishConfig, fallback: THREE.ColorRepresentation, hasColorMap: boolean): THREE.Color {
  const baked = hasColorMap && ['lambri', 'wood', 'ceiling'].includes(config.type);
  return new THREE.Color(baked ? 0xffffff : config.color ?? fallback);
}
export function colorCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
