import type { AssetDefinition } from './AssetDefinition';

export interface AssetSearchFilter { query: string; category: string; source: string; collection: string; }
const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function inCategory(asset: AssetDefinition, category: string): boolean {
  switch (category) {
    case 'all': return true;
    case 'lighting': return !!asset.capabilities?.lighting;
    case 'cabinets': return asset.cabinetDoors !== undefined;
    case 'pets': return !!asset.dailyLife?.kind.startsWith('cat_');
    case 'wardrobe_items': return asset.key.startsWith('fit_clothes_rail_') || !!asset.dailyLife && /^(garment|boots|sneakers)_/.test(asset.dailyLife.kind);
    case 'vanity': return asset.collection === 'Vanity accessories';
    case 'drawer_inserts': return asset.collection === 'Drawer inserts';
    case 'household': return (!!asset.householdDetail && !asset.householdDetail.practical) || !!asset.dailyLife;
    case 'practical': return !!asset.householdDetail?.practical;
    case 'textiles': return !!asset.softFurnishing || /^(Rugs|Cushions)$/.test(asset.collection ?? '');
    default: return asset.category.toLowerCase() === category.toLowerCase();
  }
}

/** A modal session searches every definition without renormalizing its metadata per keystroke. */
export class AssetSearchIndex {
  readonly sources: readonly string[];
  readonly collections: readonly string[];
  private readonly entries: { asset: AssetDefinition; fields: string[] }[];
  constructor(assets: readonly AssetDefinition[]) {
    this.sources = [...new Set(assets.flatMap(asset => asset.source ? [asset.source.retailer] : []))].sort();
    this.collections = [...new Set(assets.flatMap(asset => asset.collection ? [asset.collection] : []))].sort();
    this.entries = assets.map(asset => ({ asset, fields: [asset.name, asset.description, asset.key, asset.collection, asset.source?.retailer, asset.source?.productCode, ...(asset.aliases ?? [])]
      .filter((value): value is string => !!value).map(normalized) }));
  }
  search(filter: AssetSearchFilter, allowed?: (asset: AssetDefinition) => boolean): AssetDefinition[] {
    const query = normalized(filter.query.trim());
    return this.entries.filter(({ asset, fields }) => (!allowed || allowed(asset))
      && (filter.source === 'all' || asset.source?.retailer === filter.source)
      && (filter.collection === 'all' || asset.collection === filter.collection)
      && inCategory(asset, filter.category) && (!query || fields.some(field => field.includes(query))))
      .map(entry => entry.asset);
  }
}
