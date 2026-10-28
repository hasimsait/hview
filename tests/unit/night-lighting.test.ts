import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SceneLighting } from '../../src/engine/lighting/SceneLighting';
import { INDOOR_EXPOSURE, lightingExposure } from '../../src/engine/lighting/Exposure';
import { FixtureRooms } from '../../src/engine/lighting/FixtureRooms';
import { RoomFixtureLighting } from '../../src/engine/lighting/RoomFixtureLighting';
import { SurfaceColorView } from '../../src/engine/materials/SurfaceColorView';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { Room } from '../../src/domain/elements/Room';
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
  it('uses room footprints, including concave boundaries and wall-mounted fixture fallback', () => {
    const room = new Room({ id: 'room', name: 'Room', area: 3, height: 2.7, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }] });
    const index = new FixtureRooms([room], 32);
    expect(index.at(.5, .5)).toBe(1); expect(index.at(.5, 1.5)).toBe(1);
    expect(index.at(1.5, 1.5)).toBe(0); expect(index.at(-.05, .5, room.id)).toBe(1);
    const before = index.texture;
    expect(before.colorSpace).toBe(THREE.NoColorSpace); index.dispose();
  });
  it('keeps room data cached through fixture and door edits', () => {
    const lighting = new RoomFixtureLighting(), room = new Room({ id: 'room', name: 'Room', area: 4, height: 3, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] });
    lighting.rebuild(new PlanDocument([room]));
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material)); lighting.update(scene);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: '#include <common>\n#include <lights_fragment_begin>' };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    const texture = shader.uniforms.uFixtureRooms.value;
    lighting.rebuild(new PlanDocument([room])); expect(shader.uniforms.uFixtureRooms.value).toBe(texture);
    lighting.dispose(); material.dispose();
  });
  it('updates active fixture rooms without traversing scene geometry each frame', () => {
    const room = new Room({ id: 'room', name: 'Room', area: 4, height: 3, polygon: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }] });
    const lighting = new RoomFixtureLighting(), scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(), lamp = new THREE.PointLight();
    lamp.position.set(1, 1, 1); scene.add(lamp, new THREE.Mesh(new THREE.PlaneGeometry(), material));
    lighting.rebuild(new PlanDocument([room])); lighting.update(scene);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: '#include <common>\n#include <lights_fragment_begin>' };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.uniforms.uPointFixtureRooms.value).toEqual([1]);
    const traverse = vi.spyOn(scene, 'traverse'); lamp.visible = false; lighting.update(scene, false);
    expect(shader.uniforms.uPointFixtureRooms.value).toEqual([]); expect(traverse).not.toHaveBeenCalled();
    lighting.dispose(); material.dispose();
  });
  it('preserves material shaders and composes with colour comparison and cloned textiles', () => {
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
    const original = material.onBeforeCompile, occlusion = new RoomFixtureLighting(), comparison = new SurfaceColorView();
    occlusion.update(scene); comparison.update(scene, true);
    const clone = material.clone(); clone.onBeforeCompile = material.onBeforeCompile; clone.customProgramCacheKey = material.customProgramCacheKey;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), clone)); occlusion.update(scene); comparison.update(scene, true);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <common>\n#include <lights_fragment_begin>\n#include <opaque_fragment>' };
    clone.onBeforeCompile(shader as Parameters<typeof clone.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader.match(/uniform sampler2D uFixtureRooms;/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/uniform float uSurfaceColors;/g)).toHaveLength(1);
    expect(shader.fragmentShader).toContain('fixtureRoom == uPointFixtureRooms[i]');
    expect(shader.fragmentShader).toContain('fixtureRoom == uSpotFixtureRooms[i]');
    expect(shader.fragmentShader).toContain('fixtureRoom == uAreaFixtureRooms[i]');
    expect(shader.fragmentShader).not.toContain('fixtureVisibility(');
    expect(shader.fragmentShader).not.toContain('uFixtureBlocker');
    comparison.dispose(); occlusion.dispose(); expect(material.onBeforeCompile).toBe(original); material.dispose(); clone.dispose();
  });
});
