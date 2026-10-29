/** Match photographic RGB means without flattening the relative grain contrast.
 * Scaling each channel also keeps dark grain from clipping into flat black. */
export function matchWoodPhotoTone(pixels: Uint8ClampedArray, color: string): void {
  const mean = [0, 0, 0], count = pixels.length / 4;
  if (!count) return;
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += pixels[i + c] / count;
  const target = color.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) pixels[i + c] = mean[c] > 0 ? pixels[i + c] * target[c] / mean[c] : target[c];
}
