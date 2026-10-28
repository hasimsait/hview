import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneLighting } from '../../src/engine/lighting/SceneLighting';
import { INDOOR_EXPOSURE, lightingExposure } from '../../src/engine/lighting/Exposure';
import { fixtureBlockers, blockerTexture } from '../../src/engine/lighting/FixtureBlockers';
import { FixtureOcclusion } from '../../src/engine/lighting/FixtureOcclusion';
import { SurfaceColorView } from '../../src/engine/materials/SurfaceColorView';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { Wall } from '../../src/domain/elements/Wall';
import { WindowOpening } from '../../src/domain/elements/Opening';
import type { ViewportSettings } from '../../src/core/types/services';

describe('night lighting', () => {
  it('removes every global fill source at night and restores daylight', () => {
    const scene = new THREE.Scene(), lighting = new SceneLighting(scene);
    const settings = { globalLighting: false, globalLightIntensity: 2, viewMode: 'perspective' } as ViewportSettings;
    lighting.update(settings);
    for (const light of scene.children) if (light instanceof THREE.Light && light.visible) expect(light.intensity).toBe(0);
    expect(scene.environmentIntensity).toBe(0);
    lighting.update({ ...settings, globalLighting: true });
    expect(scene.children.some(child => child instanceof THREE.Light && child.intensity > 0)).toBe(true);
    expect(scene.environmentIntensity).toBeGreaterThan(0); lighting.dispose();
  });
  it('uses a fixed 100 lux indoor exposure and retains explicit user exposure', () => {
    expect(100 * .18 / Math.PI * INDOOR_EXPOSURE).toBeCloseTo(.18, 10);
    expect(lightingExposure({ globalLighting: false })).toBe(INDOOR_EXPOSURE);
    expect(lightingExposure({ globalLighting: true, globalLightIntensity: 0 })).toBe(INDOOR_EXPOSURE);
    expect(lightingExposure({ globalLighting: true })).toBe(1);
    expect(lightingExposure({ globalLighting: false, exposure: .25 })).toBe(.25);
  });
  it('retains solid window headers, sills and piers, with an actual aperture', () => {
    const opening = new WindowOpening({ id: 'window', type: 'window', wallId: 'wall', position: { x: 2, y: 0 }, distanceAlongWall: 2, width: 1, floorHeight: .8, height: 1.2 });
    const wall = new Wall({ id: 'wall', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: .2, height: 2.7, material: 'brick', openings: [] }, [opening]);
    const boxes = fixtureBlockers(new PlanDocument([wall]), new THREE.Scene());
    expect(boxes).toHaveLength(4);
    const centre = boxes.filter(box => box.x === 2);
    expect(centre.map(box => [box.bottom, box.top])).toEqual([[0, .8], [2, 2.7]]);
    const texture = blockerTexture(boxes);
    expect(texture.image.height).toBe(4); expect(texture.colorSpace).toBe(THREE.NoColorSpace); texture.dispose();
  });
  it('preserves material shaders and composes with colour comparison and cloned textiles', () => {
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
    const original = material.onBeforeCompile, occlusion = new FixtureOcclusion(), comparison = new SurfaceColorView();
    occlusion.update(scene); comparison.update(scene, true);
    const clone = material.clone(); clone.onBeforeCompile = material.onBeforeCompile; clone.customProgramCacheKey = material.customProgramCacheKey;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), clone)); occlusion.update(scene); comparison.update(scene, true);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <common>\n#include <lights_fragment_begin>\n#include <opaque_fragment>' };
    clone.onBeforeCompile(shader as Parameters<typeof clone.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader.match(/uniform sampler2D uFixtureBlockers;/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/uniform float uSurfaceColors;/g)).toHaveLength(1);
    expect(shader.fragmentShader).toContain('fixtureVisibility(geometryPosition, pointLight.position)');
    expect(shader.fragmentShader).toContain('fixtureVisibility(geometryPosition, spotLight.position)');
    expect(shader.fragmentShader).toContain('fixtureVisibility(geometryPosition, rectAreaLight.position)');
    comparison.dispose(); occlusion.dispose(); expect(material.onBeforeCompile).toBe(original); material.dispose(); clone.dispose();
  });
});
