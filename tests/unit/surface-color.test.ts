import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { surfaceColor, colorCanvasTexture } from '../../src/engine/materials/SurfaceColor';
import { SurfaceColorView, configureColorView } from '../../src/engine/materials/SurfaceColorView';
import { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { StandardFurniture } from '../../src/domain/elements/Furniture';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';

describe('one colour conversion and one albedo multiplier', () => {
  it.each(['lambri', 'wood', 'ceiling'] as const)('%s never multiplies an already coloured map by its swatch again', type => {
    expect(surfaceColor({ type, color: '#864954' }, '#ffffff', true).getHexString()).toBe('ffffff');
  });
  it('retains the exact chosen solid paint or plaster colour', () => {
    for (const type of ['paint', 'plaster'] as const) expect(surfaceColor({ type, color: '#864954' }, '#ffffff', false).getHexString()).toBe('864954');
    expect(colorCanvasTexture({} as HTMLCanvasElement).colorSpace).toBe(THREE.SRGBColorSpace);
  });
  it('uses plaster detail as bump data and keeps its base tone identical to paint', () => {
    const factory = new SurfaceMaterialFactory(), bump = new THREE.Texture();
    vi.spyOn(factory, 'getPlasterTexture').mockReturnValue(bump);
    const paint = factory.getMaterial({ type: 'paint', color: '#ece5d4' }) as THREE.MeshStandardMaterial;
    const plaster = factory.getMaterial({ type: 'plaster', color: '#ece5d4' }) as THREE.MeshStandardMaterial;
    expect(plaster.color.getHexString()).toBe(paint.color.getHexString());
    expect(plaster.map).toBeNull(); expect(plaster.bumpMap).toBe(bump); factory.dispose(); bump.dispose();
  });
  it('persists independent wood and felt colours with the chosen panel in current and legacy exports', async () => {
    const codec = new PlanCodec(), finish: SurfaceFinishConfig = { type: 'lambri', variant: 'bauhaus_61598007', color: '#ffffff', woodColor: '#864954', backingColor: '#121212' };
    const item = new StandardFurniture({ id: 'headboard', name: 'headboard', displayName: 'Headboard', assetKey: 'cabinet_wardrobe', category: 'storage', dimensions: { x: 1.6, y: 1.1, z: .03 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0, finish });
    const doc = new PlanDocument([item]);
    expect(codec.decode(codec.encode(doc)).requireFurniture('headboard').finish).toEqual(finish);
    const { LegacyPlanWriter } = await import('../../src/domain/codec/LegacyPlanWriter');
    expect(codec.decode(new LegacyPlanWriter().encode(doc)).requireFurniture('headboard').finish).toEqual(finish);
  });
});

describe('surface colour comparison', () => {
  it('turns off display remapping temporarily, then restores the saved lighting exposure', () => {
    const renderer = { toneMapping: THREE.NeutralToneMapping as THREE.ToneMapping, toneMappingExposure: 1 };
    const settings = { surfaceColors: true, toneMapping: 'aces' as const, exposure: .25 };
    configureColorView(renderer, settings); expect(renderer.toneMapping).toBe(THREE.NoToneMapping); expect(renderer.toneMappingExposure).toBe(1);
    configureColorView(renderer, { ...settings, surfaceColors: false });
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping); expect(renderer.toneMappingExposure).toBe(.25); expect(settings.exposure).toBe(.25);
  });
  it('does not duplicate shader declarations when a textile copies an already patched material', () => {
    const view = new SurfaceColorView(), scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material)); view.update(scene, true);
    const textile = material.clone(); textile.onBeforeCompile = material.onBeforeCompile; textile.customProgramCacheKey = material.customProgramCacheKey;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), textile)); view.update(scene, true);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '#include <common>\n#include <opaque_fragment>' };
    textile.onBeforeCompile(shader as Parameters<typeof textile.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader.match(/uniform float uSurfaceColors;/g)).toHaveLength(1);
    view.dispose(); material.dispose(); textile.dispose();
  });
  it('preserves metric texture shaders, catches later materials and switches through a shared uniform', () => {
    const view = new SurfaceColorView(), scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial(), original = material.onBeforeCompile;
    material.onBeforeCompile = shader => { original.call(material, shader, {} as THREE.WebGLRenderer); shader.fragmentShader += '\n// metric mapping retained'; };
    const compile = material.onBeforeCompile;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material)); view.update(scene, true);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: '#include <common>\n#include <opaque_fragment>', vertexShader: '' };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('metric mapping retained'); expect(shader.fragmentShader).toContain('outgoingLight = diffuseColor.rgb');
    expect(shader.uniforms.uSurfaceColors.value).toBe(1);
    view.update(scene, false); expect(shader.uniforms.uSurfaceColors.value).toBe(0);
    view.dispose(); expect(material.onBeforeCompile).toBe(compile); material.dispose();
  });
});
