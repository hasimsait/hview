import { describe, expect, it } from 'vitest';
import { IKEA_BATHROOM_PRODUCTS } from '../../src/domain/catalog/IkeaBathroomProducts';
import { IKEA_ACCESSORIES } from '../../src/domain/catalog/IkeaAccessories';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';

describe('IKEA Türkiye bathroom inventory', () => {
  it('keeps 265 individually referenced articles across 30 English collections', () => {
    expect(IKEA_BATHROOM_PRODUCTS).toHaveLength(265);
    expect(new Set(IKEA_BATHROOM_PRODUCTS.map(a => a.collection)).size).toBe(30);
    expect(IKEA_BATHROOM_PRODUCTS.filter(a => a.collection !== 'Towels')).toHaveLength(199);
    const catalog = new AssetCatalog();
    for (const asset of IKEA_BATHROOM_PRODUCTS) {
      expect(asset.source?.url).toMatch(new RegExp(`^https://www\\.ikea\\.com\\.tr/en/.*${asset.source?.productCode}$`));
      expect(asset.name).not.toMatch(/havlu|sabun|priz|anahtar|dolap|dus|askı|melanj|alcipan/i);
      expect(asset.category).toBe('bathroom');
      expect(catalog.recipe(asset.key)).toBe(asset.recipe);
      expect(IKEA_ACCESSORIES.filter(a => a.source?.productCode === asset.source?.productCode)).toHaveLength(1);
      expect(asset.source?.dimensionNotes).toBeTruthy();
    }
  });

  it('uses floor, wall and counter placement according to the product function', () => {
    const byArticle = (code: string) => IKEA_BATHROOM_PRODUCTS.find(a => a.source?.productCode === code)!;
    expect(byArticle('40381253')).toMatchObject({ placement: { mount: 'wall' }, defaultDimensions: { x: .28, z: .17, y: .17 }, source: { dimensions: 'listed' } });
    expect(byArticle('20214731').placement).toMatchObject({ mount: 'floor' });
    expect(byArticle('10600964').placement).toMatchObject({ mount: 'surface', defaultElevation: .9 });
    expect(byArticle('10557423').placement).toMatchObject({ mount: 'wall', defaultElevation: .1 });
    expect(byArticle('90253074').placement).toMatchObject({ mount: 'floor' });
    expect(byArticle('60426707')).toMatchObject({ bathroom: { kind: 'swivel_rail' }, defaultDimensions: { x: .03, y: .15, z: .43 } });
    expect(byArticle('90314973')).toMatchObject({ defaultDimensions: { x: 1.2 }, source: { dimensions: 'estimated' } });
  });
});
