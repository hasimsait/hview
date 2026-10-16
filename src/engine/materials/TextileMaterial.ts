import * as THREE from 'three';

/** A neutral warp/weft texture generated locally, including in offline exports. */
export function createTextileMaterial(): THREE.MeshStandardMaterial {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = Math.sin(x * Math.PI / 2), weft = Math.sin(y * Math.PI / 2);
    const shade = Math.min(255, Math.round(235 + 10 * warp + 7 * weft + ((x * 13 + y * 7) % 5)));
    const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = shade; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(16, 16); texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  return new THREE.MeshStandardMaterial({ color: '#eee7d9', roughness: .95, metalness: 0, map: texture, bumpMap: texture, bumpScale: .001, side: THREE.DoubleSide });
}
