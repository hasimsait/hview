import { describe, expect, it } from 'vitest';
import { matchWoodPhotoTone } from '../../src/engine/materials/WoodPhotoTone';
import { FURNITURE_WOOD_FINISHES } from '../../src/domain/catalog/WoodFinishes';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';

describe('dark photographic woods', () => {
  it('keeps dark grain variation and alpha without applying the base tone twice', () => {
    const pixels = new Uint8ClampedArray([80, 60, 40, 255, 120, 100, 80, 128, 160, 140, 120, 255]);
    matchWoodPhotoTone(pixels, '#281a14');
    expect([pixels[3], pixels[7], pixels[11]]).toEqual([255, 128, 255]);
    for (const [channel, expected] of [40, 26, 20].entries()) {
      const values = [pixels[channel], pixels[4 + channel], pixels[8 + channel]];
      expect(values[0]).toBeGreaterThan(0); expect(values[2]).toBeGreaterThan(values[0]);
      expect(values.reduce((sum, value) => sum + value, 0) / 3).toBeCloseTo(expected, 0);
    }
  });
  it('retains all existing finish identities and round-trips every added deep brown through both plan formats', () => {
    expect(new Set(FURNITURE_WOOD_FINISHES.map(finish => finish.id)).size).toBe(FURNITURE_WOOD_FINISHES.length);
    const codec = new PlanCodec();
    for (const variant of ['deep_chocolate_walnut', 'espresso_walnut', 'black_brown_wood']) {
      const option = FURNITURE_WOOD_FINISHES.find(finish => finish.variant === variant)!;
      const finish = { type: option.type, variant, color: option.color, roughness: option.roughness, rotation: 90 };
      const item = codec.factory.furniture({ id: variant, assetKey: 'cabinet_base_single', name: variant, displayName: variant, category: 'storage', dimensions: { x: .6, y: .8, z: .6 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0, finish });
      const plan = new PlanDocument([item]);
      for (const encoded of [codec.encode(plan), new LegacyPlanWriter().encode(plan)]) expect(codec.decode(encoded).requireFurniture(item.id).finish).toEqual(finish);
    }
  });
});
