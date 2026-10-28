import { describe, expect, it, vi } from 'vitest';
import { BAUHAUS_PANEL_FINISHES, bauhausPanel, matchGrainColour, panelGrainUrl, panelTextureWidth } from '../../src/domain/catalog/BauhausPanelling';
import { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { StandardFurniture } from '../../src/domain/elements/Furniture';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import * as THREE from 'three';

describe('reference-matched Bauhaus panelling', () => {
  it('uses the final user scale consistently across all families', () => {
    expect(new Set(BAUHAUS_PANEL_FINISHES.map(p => p.id)).size).toBe(BAUHAUS_PANEL_FINISHES.length);
    for (const panel of BAUHAUS_PANEL_FINISHES) {
      expect(panel.slatWidth).toBe(.025); expect(panel.gapWidth).toBe(.015);
      expect(panelTextureWidth(panel)).toBeCloseTo(.32);
      expect(panelGrainUrl(panel)).toMatch(/wood_(natural_oak|american_walnut)\.jpg$/);
      expect(bauhausPanel(panel.id)).toBe(panel);
    }
    expect(bauhausPanel('oak_slats')).toBeUndefined();
  });
  it('preserves grain variation while matching mean RGB without multiplying a coloured photo by a second tint', () => {
    const pixels = new Uint8ClampedArray([100, 120, 130, 255, 140, 160, 170, 255]);
    matchGrainColour(pixels, [180, 145, 100]);
    for (let c = 0; c < 3; c++) expect((pixels[c] + pixels[c + 4]) / 2).toBe([180, 145, 100][c]);
    expect(pixels[4] - pixels[0]).toBeGreaterThan(20); expect(pixels[3]).toBe(255);
  });
  it('retains selected products and rotation in saved plans', () => {
    const codec = new PlanCodec();
    const finish = { type: 'lambri' as const, variant: 'bauhaus_61598007', color: '#ffffff', rotation: 90 };
    const entity = new StandardFurniture({ id: 'panel', name: 'panel', displayName: 'Panel', assetKey: 'cabinet_wardrobe', category: 'storage', position: { x: 0, y: 0, z: 0 }, dimensions: { x: 1, y: 2, z: .5 }, rotationY: 0, finish });
    const restored = codec.decode(codec.encode(new PlanDocument([entity])));
    expect(restored.requireFurniture('panel').finish).toEqual(finish);
  });
  it('uses neutral tint and metric texture repeats for photographic panels', () => {
    const factory = new SurfaceMaterialFactory(), texture = new THREE.Texture();
    vi.spyOn(factory, 'getLambriTexture').mockReturnValue(texture);
    const material = factory.getMaterial({ type: 'lambri', variant: 'bauhaus_61598007', color: '#c9b07d' }) as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('ffffff'); expect(material.map).toBe(texture);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: '' };
    material.onBeforeCompile(shader as Parameters<typeof material.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
    const scale = shader.uniforms.uTilingScale.value as THREE.Vector2;
    expect(scale.x).toBeCloseTo(1 / .32); expect(scale.y).toBe(2);
    factory.dispose(); texture.dispose();
  });
  it('does not change plain paint rendering', () => {
    const factory = new SurfaceMaterialFactory();
    const material = factory.getMaterial({ type: 'paint', color: '#aabbcc' }) as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('aabbcc'); factory.dispose();
  });
});
