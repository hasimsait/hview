import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { AssetSearchIndex } from '../../src/domain/catalog/AssetSearchIndex';
import type { AssetDefinition } from '../../src/domain/catalog/AssetDefinition';

const catalogue = new AssetCatalog(), assets = catalogue.all(), index = new AssetSearchIndex(assets);
const all = { query: '', category: 'all', source: 'all', collection: 'all' };
describe('indexed catalogue search', () => {
  it('searches every product, including products beyond the initial display page', () => {
    expect(index.search(all)).toEqual(assets);
    const last = assets[assets.length - 1];
    expect(index.search({ ...all, query: last.key })).toContain(last);
    expect(index.search({ ...all, query: '10470991' }).map(asset => asset.key)).toContain('ikea_10470991');
    expect(index.search({ ...all, query: 'padrag' })).toEqual(index.search({ ...all, query: 'PÅDRAG' }));
  });
  it('combines source, collection, capability/category and allowed-object filters', () => {
    const lamps = index.search({ ...all, category: 'lighting' });
    expect(lamps.length).toBeGreaterThan(0); expect(lamps.every(asset => asset.capabilities?.lighting)).toBe(true);
    const trolleys = index.search({ ...all, source: 'IKEA', collection: 'Trolleys' }, asset => asset.defaultDimensions.x < .5);
    expect(trolleys.length).toBeGreaterThan(0); expect(trolleys.every(asset => asset.source?.retailer === 'IKEA' && asset.collection === 'Trolleys' && asset.defaultDimensions.x < .5)).toBe(true);
    expect(index.search({ ...all, query: 'no-such-asset-123456' })).toEqual([]);
  });
  it('reads search metadata once and does not match across unrelated fields', () => {
    let reads = 0;
    const asset: AssetDefinition = { key: 'test', get name() { reads++; return 'Distinct name'; }, category: 'decor', description: 'Separate description', defaultDimensions: { x: 1, y: 1, z: 1 } };
    const search = new AssetSearchIndex([asset]), before = reads;
    expect(search.search({ ...all, query: 'distinct' })).toEqual([asset]);
    expect(search.search({ ...all, query: 'name separate' })).toEqual([]);
    expect(reads).toBe(before);
  });
});
