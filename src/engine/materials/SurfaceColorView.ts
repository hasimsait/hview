import * as THREE from 'three';
import type { ViewportSettings } from '../../core/types/services';

export function configureColorView(renderer: Pick<THREE.WebGLRenderer, 'toneMapping' | 'toneMappingExposure'>, settings: Pick<ViewportSettings, 'surfaceColors' | 'toneMapping' | 'exposure'>): void {
  renderer.toneMapping = settings.surfaceColors ? THREE.NoToneMapping : settings.toneMapping === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
  renderer.toneMappingExposure = settings.surfaceColors ? 1 : THREE.MathUtils.clamp(settings.exposure ?? 1, 1 / 64, 4);
}

/** Compare the same decoded albedo on every surface, independently of room light.
 * Keep each material's metric UVs, textures, transparency and picking geometry.
 * One uniform switches back to its original lighting without rebuilding assets. */
export class SurfaceColorView {
  private readonly enabled = { value: 0 };
  private readonly originals = new Map<THREE.Material, { compile: THREE.Material['onBeforeCompile']; key: THREE.Material['customProgramCacheKey']; disposed: () => void }>();
  update(scene: THREE.Object3D, enabled: boolean): void {
    this.enabled.value = enabled ? 1 : 0;
    if (!enabled) return;
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.originals.has(material)) continue;
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey, programKey = key.call(material);
        const uniform = this.enabled;
        material.onBeforeCompile = function(shader, renderer) {
          compile.call(this, shader, renderer);
          shader.uniforms.uSurfaceColors = uniform;
          if (!shader.fragmentShader.includes('uniform float uSurfaceColors;')) {
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSurfaceColors;');
            shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'if (uSurfaceColors > 0.5) outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>');
          }
        };
        material.customProgramCacheKey = () => programKey.endsWith('_surface-colors-v1') ? programKey : `${programKey}_surface-colors-v1`;
        const disposed = () => { this.originals.delete(material); material.removeEventListener('dispose', disposed); };
        this.originals.set(material, { compile, key, disposed }); material.addEventListener('dispose', disposed);
        material.needsUpdate = true;
      }
    });
  }
  dispose(): void {
    this.enabled.value = 0;
    for (const [material, original] of this.originals) {
      material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key;
      material.removeEventListener('dispose', original.disposed); material.needsUpdate = true;
    }
    this.originals.clear();
  }
}
