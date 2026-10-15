import * as THREE from 'three';
import type { TileLayoutPattern } from '../../domain/model/PlanData';
const TILE_PATTERN_ENUM: Record<TileLayoutPattern, number> = {
  grid: 0,
  running_bond: 1,
  diagonal_herringbone: 2,
  herringbone: 3,
  french_pattern: 4,
  vertical_stack: 5,
};
export interface OcclusionUniforms {
  uOrbitCenter: { value: THREE.Vector3 };
  uCameraDir: { value: THREE.Vector3 };
  uForegroundMode: { value: number };
  uForegroundOpacity: { value: number };
}

export function createOcclusionUniforms(): OcclusionUniforms {
  return {
    uOrbitCenter: { value: new THREE.Vector3(0, 0, 0) },
    uCameraDir: { value: new THREE.Vector3(0, 0, 1) },
    uForegroundMode: { value: 1 }, // 0 = off, 1 = transparent, 2 = clip
    uForegroundOpacity: { value: 0.15 },
  };
}

export function applyBasicOcclusionShader(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  uniforms: OcclusionUniforms,
  fadeDistance = 0.5
): void {
  const fadeEdge = fadeDistance.toFixed(2);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOrbitCenter = uniforms.uOrbitCenter;
    shader.uniforms.uCameraDir = uniforms.uCameraDir;
    shader.uniforms.uForegroundMode = uniforms.uForegroundMode;
    shader.uniforms.uForegroundOpacity = uniforms.uForegroundOpacity;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\nvarying vec3 vCustomWorldPos;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vec4 customWPos = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        customWPos = instanceMatrix * customWPos;
      #endif
      vCustomWorldPos = (modelMatrix * customWPos).xyz;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform vec3  uOrbitCenter;
      uniform vec3  uCameraDir;
      uniform int   uForegroundMode;
      uniform float uForegroundOpacity;
      varying vec3  vCustomWorldPos;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (uForegroundMode > 0) {
        float dist = dot(vCustomWorldPos - uOrbitCenter, uCameraDir);
        if (dist > 0.0) {
          if (uForegroundMode == 1) {
            float fade = smoothstep(0.0, ${fadeEdge}, dist);
            gl_FragColor.a *= mix(1.0, uForegroundOpacity, fade);
          } else if (uForegroundMode == 2) {
            if (dist > 0.1) discard;
          }
        }
      }`
    );
  };
}

export class OcclusionShader {
  private occlusionUniforms = createOcclusionUniforms();
  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.occlusionUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.occlusionUniforms.uCameraDir.value.copy(cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    this.occlusionUniforms.uForegroundMode.value =
      mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
  }

  setForegroundOpacity(opacity: number): void {
    this.occlusionUniforms.uForegroundOpacity.value = opacity < 1.0 ? opacity : 0.15;
  }

  apply(
    mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
    tilingScale: THREE.Vector2 = new THREE.Vector2(1.0, 1.0),
    projection: 'world' | 'local' = 'world',
    rotation: number = 0,
    groutWidth: number = 0,
    groutColor: string = '#d1d5db',
    numVariants: number = 1,
    pattern: TileLayoutPattern = 'grid',
    tileDimsCm: THREE.Vector2 = new THREE.Vector2(60, 60),
    isStretched: boolean = false
  ): void {
    const u = this.occlusionUniforms;
    const isLocal = projection === 'local' ? 1 : 0;
    mat.defines = {
      ...(mat.defines || {}),
      PROJECTION_LOCAL: isLocal,
      IS_STRETCHED: isStretched ? 1 : 0,
    };

    mat.customProgramCacheKey = () => {
      return `metric_${projection}_${isStretched ? 'stretched' : 'tiled'}_${tilingScale.x.toFixed(4)}_${tilingScale.y.toFixed(4)}_${rotation}_${pattern}_${groutWidth}_${groutColor}_v${numVariants}_${mat.map ? 'map' : 'nomap'}`;
    };

    mat.onBeforeCompile = (shader) => {
      const rad = (rotation * Math.PI) / 180.0;
      const uTileRot = new THREE.Vector2(Math.cos(rad), Math.sin(rad));
      const groutMeters = Math.max(0, groutWidth) * 0.001;
      const uGroutColor = new THREE.Color(groutColor);

      shader.uniforms.uOrbitCenter = u.uOrbitCenter;
      shader.uniforms.uCameraDir = u.uCameraDir;
      shader.uniforms.uForegroundMode = u.uForegroundMode;
      shader.uniforms.uForegroundOpacity = u.uForegroundOpacity;
      shader.uniforms.uTilingScale = { value: tilingScale };
      shader.uniforms.uTileRot = { value: uTileRot };
      shader.uniforms.uGroutWidth = { value: groutMeters };
      shader.uniforms.uGroutColor = { value: uGroutColor };
      shader.uniforms.uTileAtlasVariants = { value: numVariants };
      shader.uniforms.uTilePattern = { value: TILE_PATTERN_ENUM[pattern] ?? 0 };
      shader.uniforms.uTileDims = { value: new THREE.Vector2(tileDimsCm.x * 0.01, tileDimsCm.y * 0.01) };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        attribute vec3 localMetricOffset;
        varying vec3 vCustomWorldPos;
        varying vec3 vMetricPos;
        varying vec3 vMetricNormal;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 customWPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          customWPos = instanceMatrix * customWPos;
        #endif
        vCustomWorldPos = (modelMatrix * customWPos).xyz;
        #if (PROJECTION_LOCAL == 1)
          vMetricPos = transformed - localMetricOffset;
          vMetricNormal = normal;
        #else
          vMetricPos = vCustomWorldPos;
          vec4 norm4 = vec4(normal, 0.0);
          #ifdef USE_INSTANCING
            norm4 = instanceMatrix * norm4;
          #endif
          vMetricNormal = normalize((modelMatrix * norm4).xyz);
        #endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3  uOrbitCenter;
        uniform vec3  uCameraDir;
        uniform int   uForegroundMode;
        uniform float uForegroundOpacity;
        uniform vec2  uTilingScale;
        uniform vec2  uTileRot;
        uniform float uGroutWidth;
        uniform vec3  uGroutColor;
        uniform float uTileAtlasVariants;
        uniform int   uTilePattern;
        uniform vec2  uTileDims;
        varying vec3  vCustomWorldPos;
        varying vec3  vMetricPos;
        varying vec3  vMetricNormal;

        float hashTile(vec2 p) {
          vec2 s = sin((p + vec2(17.13, 31.41)) * vec2(127.1, 311.7)) * 43758.5453;
          return fract(sin(s.x + s.y) * 43758.5453);
        }`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          #if (IS_STRETCHED == 1)
            vec2 tileUv = clamp(vMapUv, 0.0005, 0.9995);
            vec4 sampledDiffuseColor = texture2D(map, tileUv);
            diffuseColor *= sampledDiffuseColor;
          #else
            vec2 metricUv = vMapUv;

          // If mesh lacks precomputed metric UVs, fall back to triplanar projection
          float dUvLen = length(vec2(dFdx(vMapUv.x), dFdy(vMapUv.x))) + length(vec2(dFdx(vMapUv.y), dFdy(vMapUv.y)));
          if (dUvLen <= 0.000001) {
            vec3 mNorm = normalize(vMetricNormal);
            if (abs(mNorm.y) >= 0.707) {
              metricUv = vMetricPos.xz;
            } else {
              float hLen = length(mNorm.xz);
              if (hLen > 0.001) {
                metricUv.x = (-vMetricPos.x * mNorm.z + vMetricPos.z * mNorm.x) / hLen;
              } else {
                metricUv.x = vMetricPos.x;
              }
              metricUv.y = vMetricPos.y;
            }
          }

          vec2 mPos = metricUv;
          float sRot = abs(uTileRot.y);
          if (sRot > 0.707) {
            mPos = vec2(metricUv.y, metricUv.x);
          }

          vec2 tileUv;
          vec2 hashCell;
          float distToEdge = 1000.0;

          float tileW = min(uTileDims.x, uTileDims.y);
          float tileL = max(uTileDims.x, uTileDims.y);
          if (tileW < 0.001) tileW = 1.0 / max(uTilingScale.x, uTilingScale.y);
          if (tileL < 0.001) tileL = 1.0 / min(uTilingScale.x, uTilingScale.y);
          if (tileL / tileW < 1.05 && (uTilePattern == 2 || uTilePattern == 3)) {
            tileL = tileW * 2.0;
          }

          if (uTilePattern == 1) {
            // ── 1. RUNNING BOND (Staggered 50% Brick) ──────────────────────
            vec2 uv = mPos * uTilingScale;
            float row = floor(uv.y);
            float colShift = step(0.5, mod(abs(row), 2.0)) * 0.5;
            uv.x += colShift;
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
            distToEdge = min(ed.x, ed.y);
          } else if (uTilePattern == 5) {
            // ── 5. VERTICAL STACK (Upright Columns) ────────────────────────
            vec2 uv = vec2(mPos.x * uTilingScale.y, mPos.y * uTilingScale.x);
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / vec2(uTilingScale.y, uTilingScale.x);
            distToEdge = min(ed.x, ed.y);
          } else if (uTilePattern == 2 || uTilePattern == 3) {
            // ── 2 & 3. HERRINGBONE (Diagonal 45° or 90°) ───────────────────
            vec2 hp = mPos;
            if (uTilePattern == 2) {
              hp = vec2((mPos.x + mPos.y) * 0.70710678, (mPos.y - mPos.x) * 0.70710678);
            }
            float uH = (hp.x - hp.y) / (2.0 * tileL);
            float vH = (hp.x + hp.y) / (2.0 * tileW);
            float kEst = floor(uH + 0.5);
            float tEst = floor(vH - uH + 0.5);
            bool found = false;
            for (int dk = -1; dk <= 1; dk++) {
              for (int dt = -2; dt <= 2; dt++) {
                if (found) break;
                float k = kEst + float(dk);
                float t = tEst + float(dt);
                float hx = t * tileW + k * (tileL + tileW);
                float hy = t * tileW + k * (tileW - tileL);
                if (hp.x >= hx && hp.x < hx + tileL && hp.y >= hy && hp.y < hy + tileW) {
                  tileUv = vec2((hp.x - hx) / tileL, (hp.y - hy) / tileW);
                  hashCell = vec2(k, t * 2.0);
                  vec2 ed = min(vec2(hp.x - hx, hp.y - hy), vec2(hx + tileL - hp.x, hy + tileW - hp.y));
                  distToEdge = min(ed.x, ed.y);
                  found = true;
                  break;
                }
                float vx = hx + tileL;
                float vy = hy + tileW - tileL;
                if (hp.x >= vx && hp.x < vx + tileW && hp.y >= vy && hp.y < vy + tileL) {
                  tileUv = vec2((hp.x - vx) / tileW, (hp.y - vy) / tileL);
                  hashCell = vec2(k, t * 2.0 + 1.0);
                  vec2 ed = min(vec2(hp.x - vx, hp.y - vy), vec2(vx + tileW - hp.x, vy + tileL - hp.y));
                  distToEdge = min(ed.x, ed.y);
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              vec2 uv = hp * uTilingScale;
              tileUv = fract(uv);
              hashCell = floor(uv);
              vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
              distToEdge = min(ed.x, ed.y);
            }
          } else if (uTilePattern == 4) {
            // ── 4. FRENCH PATTERN (Versailles Non-Aligned Modular) ──────────
            float modM = tileW;
            if (modM < 0.08 || modM > 0.45) modM = 0.20;
            float period = 6.0 * modM;
            float blockRow = floor(mPos.y / period);
            vec2 fp = mPos;
            if (mod(abs(blockRow), 2.0) >= 0.5) {
              fp.x += 3.0 * modM;
            }
            vec2 blockId = floor(fp / period);
            vec2 lp = mod(fp, vec2(period, period));
            if (lp.x < 0.0) lp.x += period;
            if (lp.y < 0.0) lp.y += period;

            vec4 fRects[12];
            fRects[0]  = vec4(0.0, 0.0, 3.0, 2.0);
            fRects[1]  = vec4(3.0, 0.0, 3.0, 2.0);
            fRects[2]  = vec4(0.0, 2.0, 2.0, 2.0);
            fRects[3]  = vec4(2.0, 2.0, 2.0, 2.0);
            fRects[4]  = vec4(4.0, 2.0, 2.0, 2.0);
            fRects[5]  = vec4(0.0, 4.0, 2.0, 2.0);
            fRects[6]  = vec4(2.0, 4.0, 2.0, 1.0);
            fRects[7]  = vec4(4.0, 4.0, 1.0, 2.0);
            fRects[8]  = vec4(5.0, 4.0, 1.0, 1.0);
            fRects[9]  = vec4(2.0, 5.0, 1.0, 1.0);
            fRects[10] = vec4(3.0, 5.0, 1.0, 1.0);
            fRects[11] = vec4(5.0, 5.0, 1.0, 1.0);

            bool found = false;
            for (int i = 0; i < 12; i++) {
              vec4 r = fRects[i];
              float rx = r.x * modM;
              float ry = r.y * modM;
              float rw = r.z * modM;
              float rh = r.w * modM;
              if (lp.x >= rx && lp.x < rx + rw && lp.y >= ry && lp.y < ry + rh) {
                tileUv = vec2((lp.x - rx) / rw, (lp.y - ry) / rh);
                hashCell = blockId * 12.0 + vec2(float(i), float(i));
                vec2 ed = min(vec2(lp.x - rx, lp.y - ry), vec2(rx + rw - lp.x, ry + rh - lp.y));
                distToEdge = min(ed.x, ed.y);
                found = true;
                break;
              }
            }
            if (!found) {
              vec2 uv = mPos * uTilingScale;
              tileUv = fract(uv);
              hashCell = floor(uv);
              vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
              distToEdge = min(ed.x, ed.y);
            }
          } else {
            // ── 0. GRID (Stack Bond Default) ───────────────────────────────
            vec2 uv = mPos * uTilingScale;
            hashCell = floor(uv);
            tileUv = fract(uv);
            vec2 ed = min(tileUv, 1.0 - tileUv) / uTilingScale;
            distToEdge = min(ed.x, ed.y);
          }

          vec4 sampledDiffuseColor;
          if (uTileAtlasVariants > 1.5) {
            #if (PROJECTION_LOCAL == 1)
              hashCell += floor(vCustomWorldPos.xz * uTilingScale);
            #endif
            float h = hashTile(hashCell);
            float variantIndex = floor(h * uTileAtlasVariants);
            variantIndex = clamp(variantIndex, 0.0, uTileAtlasVariants - 1.0);
            float localX = clamp(tileUv.x, 0.001, 0.999);
            float localY = clamp(tileUv.y, 0.001, 0.999);
            vec2 atlasUv = vec2((variantIndex + localX) / uTileAtlasVariants, localY);
            sampledDiffuseColor = texture2D(map, atlasUv);
          } else {
            sampledDiffuseColor = texture2D(map, tileUv);
          }

          if (uGroutWidth > 0.00005) {
            float halfGrout = uGroutWidth * 0.5;
            float fw = max(fwidth(distToEdge), 0.00015);
            float groutFactor = 1.0 - smoothstep(halfGrout - fw, halfGrout + fw, distToEdge);
            if (groutFactor > 0.0) {
              sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uGroutColor, groutFactor);
            }
          }

          diffuseColor *= sampledDiffuseColor;
          #endif
        #endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uForegroundMode > 0) {
          float dist = dot(vCustomWorldPos - uOrbitCenter, uCameraDir);
          if (dist > 0.0) {
            if (uForegroundMode == 1) {
              float fade = smoothstep(0.0, 0.5, dist);
              gl_FragColor.a *= mix(1.0, uForegroundOpacity, fade);
            } else if (uForegroundMode == 2) {
              if (dist > 0.1) discard;
            }
          }
        }`
      );
    };
  }
}
