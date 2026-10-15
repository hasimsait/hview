import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcclusionShader, applyBasicOcclusionShader, createOcclusionUniforms } from '../../src/engine/materials/OcclusionShader';
import { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';

afterEach(() => vi.unstubAllGlobals());

describe('shader program reuse without shared material values', () => {
  it('keeps newly selected mobile glass finishes transparent without transmission passes', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const factory = new SurfaceMaterialFactory();
    const glass = factory.getMaterial({ type: 'glass', variant: 'clear' }) as THREE.MeshPhysicalMaterial;
    expect(glass.transmission).toBe(0);
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBe(0.35);
    factory.dispose();
  });
  it('shares identical sources while keeping each surface scale, layout, and grout independent', () => {
    const factory = new OcclusionShader();
    const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
    factory.apply(a, new THREE.Vector2(2, 3), 'world', 0, 1, '#ffffff', 1, 'grid');
    factory.apply(b, new THREE.Vector2(7, 5), 'world', 90, 3, '#000000', 2, 'running_bond');
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    const shader = () => ({ uniforms: {} as Record<string, { value: any }>, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
    const sa = shader(), sb = shader();
    a.onBeforeCompile(sa as any, {} as THREE.WebGLRenderer);
    b.onBeforeCompile(sb as any, {} as THREE.WebGLRenderer);
    expect(sa.vertexShader).toBe(sb.vertexShader);
    expect(sa.fragmentShader).toBe(sb.fragmentShader);
    expect(sa.uniforms.uTilingScale.value.toArray()).toEqual([2, 3]);
    expect(sb.uniforms.uTilingScale.value.toArray()).toEqual([7, 5]);
    expect(sa.uniforms.uGroutWidth.value).toBe(0.001);
    expect(sb.uniforms.uGroutWidth.value).toBe(0.003);
    expect(sa.uniforms.uTilePattern.value).not.toBe(sb.uniforms.uTilePattern.value);
    expect(sa.uniforms.uGroutColor.value.getHexString()).toBe('ffffff');
    expect(sb.uniforms.uGroutColor.value.getHexString()).toBe('000000');
    factory.apply(b, new THREE.Vector2(2, 3), 'local');
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });
  it('does not share basic shaders with different baked fade distances', () => {
    const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
    applyBasicOcclusionShader(a, createOcclusionUniforms(), 0.5);
    applyBasicOcclusionShader(b, createOcclusionUniforms(), 0.6);
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });
});
