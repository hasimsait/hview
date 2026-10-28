import * as THREE from 'three';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import { blockerTexture, fixtureBlockers } from './FixtureBlockers';

const declarations = `
uniform sampler2D uFixtureBlockers;
uniform int uFixtureBlockerCount;
uniform float uFixtureBlockerRows;
float fixtureVisibility(vec3 surfaceView, vec3 sourceView) {
  vec3 surface = ((vec4(surfaceView, 1.0) - viewMatrix[3]) * viewMatrix).xyz;
  vec3 source = ((vec4(sourceView, 1.0) - viewMatrix[3]) * viewMatrix).xyz;
  vec3 ray = source - surface;
  vec2 low = min(surface.xz, source.xz), high = max(surface.xz, source.xz);
  float epsilon = min(.01, .002 / max(length(ray), .002));
  for (int b = 0; b < uFixtureBlockerCount; b++) {
    float row = (float(b) + .5) / uFixtureBlockerRows;
    vec4 footprint = texture2D(uFixtureBlockers, vec2(1.0 / 6.0, row));
    if (any(lessThan(high, footprint.xy)) || any(greaterThan(low, footprint.zw))) continue;
    vec4 frame = texture2D(uFixtureBlockers, vec2(.5, row));
    vec4 bounds = texture2D(uFixtureBlockers, vec2(5.0 / 6.0, row));
    if (min(surface.y, source.y) > bounds.w || max(surface.y, source.y) < bounds.z) continue;
    vec2 offset = surface.xz - frame.xy;
    vec2 normal = vec2(-frame.w, frame.z);
    vec3 origin = vec3(dot(offset, frame.zw), surface.y, dot(offset, normal));
    vec3 direction = vec3(dot(ray.xz, frame.zw), ray.y, dot(ray.xz, normal));
    vec3 reciprocal = (step(vec3(0.0), direction) * 2.0 - 1.0) / max(abs(direction), vec3(.000001));
    vec3 a = (vec3(-bounds.x, bounds.z, -bounds.y) - origin) * reciprocal;
    vec3 c = (vec3(bounds.x, bounds.w, bounds.y) - origin) * reciprocal;
    vec3 nearSide = min(a, c), farSide = max(a, c);
    float enter = max(max(nearSide.x, nearSide.y), max(nearSide.z, epsilon));
    float leave = min(min(farSide.x, farSide.y), min(farSide.z, 1.0 - epsilon));
    if (leave > enter + .000001) return 0.0;
  }
  return 1.0;
}`;

const lightChunk = THREE.ShaderChunk.lights_fragment_begin
  .replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\nif (directLight.visible && dot(geometryNormal, directLight.direction) > 0.0) directLight.color *= fixtureVisibility(geometryPosition, pointLight.position);')
  .replace('getSpotLightInfo( spotLight, geometryPosition, directLight );', 'getSpotLightInfo( spotLight, geometryPosition, directLight );\nif (directLight.visible && dot(geometryNormal, directLight.direction) > 0.0) directLight.color *= fixtureVisibility(geometryPosition, spotLight.position);')
  .replace('rectAreaLight = rectAreaLights[ i ];', 'rectAreaLight = rectAreaLights[ i ];\nrectAreaLight.color *= fixtureVisibility(geometryPosition, rectAreaLight.position);');

/** Structural light blocking without one shadow map per fixture. Works on touch
 * devices and RectAreaLights too. Area sources use their centre for visibility;
 * this does not simulate furniture shadows or indirect light transport. */
export class FixtureOcclusion {
  private readonly uniforms = { uFixtureBlockers: { value: blockerTexture([]) }, uFixtureBlockerCount: { value: 0 }, uFixtureBlockerRows: { value: 1 } };
  private readonly originals = new Map<THREE.Material, { compile: THREE.Material['onBeforeCompile']; key: THREE.Material['customProgramCacheKey']; disposed: () => void }>();

  rebuild(plan: PlanDocument, scene: THREE.Object3D): void {
    const boxes = fixtureBlockers(plan, scene), texture = blockerTexture(boxes);
    this.uniforms.uFixtureBlockers.value.dispose(); this.uniforms.uFixtureBlockers.value = texture;
    this.uniforms.uFixtureBlockerCount.value = boxes.length; this.uniforms.uFixtureBlockerRows.value = Math.max(1, boxes.length);
  }

  update(scene: THREE.Object3D): void {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.originals.has(material)) continue;
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey, programKey = key.call(material), uniforms = this.uniforms;
        material.onBeforeCompile = function(shader, renderer) {
          compile.call(this, shader, renderer); Object.assign(shader.uniforms, uniforms);
          if (shader.fragmentShader.includes('uniform sampler2D uFixtureBlockers;')) return;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + declarations)
            .replace('#include <lights_fragment_begin>', lightChunk);
        };
        material.customProgramCacheKey = () => programKey.includes('_fixture-occlusion-v1') ? programKey : `${programKey}_fixture-occlusion-v1`;
        const disposed = () => { this.originals.delete(material); material.removeEventListener('dispose', disposed); };
        this.originals.set(material, { compile, key, disposed }); material.addEventListener('dispose', disposed); material.needsUpdate = true;
      }
    });
  }

  dispose(): void {
    this.uniforms.uFixtureBlockerCount.value = 0; this.uniforms.uFixtureBlockers.value.dispose();
    for (const [material, original] of this.originals) {
      material.onBeforeCompile = original.compile; material.customProgramCacheKey = original.key;
      material.removeEventListener('dispose', original.disposed); material.needsUpdate = true;
    }
    this.originals.clear();
  }
}
