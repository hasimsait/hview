import * as THREE from 'three';

/** Planckian-locus approximation (Kang et al., 2002), not a measured LED spectrum.
 * Return linear sRGB at unit luminance, so changing CCT does not change nominal output.
 * sRGB's D65 white and a 6500 K Planckian source have slightly different chromaticities.
 */
export function whiteLightColor(kelvin: number): THREE.Color {
  const t = THREE.MathUtils.clamp(kelvin, 2700, 6500);
  const x = t <= 4000
    ? -.2661239e9 / t ** 3 - .2343580e6 / t ** 2 + .8776956e3 / t + .179910
    : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + .2226347e3 / t + .240390;
  const y = t <= 4000
    ? -.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - .16748867
    : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - .37001483;
  const X = x / y, Z = (1 - x - y) / y;
  return new THREE.Color().setRGB(
    3.2404542 * X - 1.5371385 - .4985314 * Z,
    -.969266 * X + 1.8760108 + .041556 * Z,
    .0556434 * X - .2040259 + 1.0572252 * Z,
    THREE.LinearSRGBColorSpace,
  );
}
