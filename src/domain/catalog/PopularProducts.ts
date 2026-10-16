import type { AssetDefinition, AssetPlacement } from './AssetDefinition';
import type { FurnitureProductModel } from './FurnitureProductModel';
import products from './PopularProducts.json' with { type: 'json' };

interface PopularProduct {
  id: string;
  name: string;
  category: string;
  collection: string;
  size: number[]; // Width × depth × height, centimetres; never package measurements.
  model: FurnitureProductModel;
  popularityRank: number;
  popularityCategory: string;
  checkedAt: string;
  dimensionStatus: 'listed' | 'estimated';
  dimensionNotes: string;
  dimensionSources?: string[];
  placement?: AssetPlacement;
}

/** Bundled popular products with dated category ranks and editable planning geometry. */
export const POPULAR_PRODUCTS: readonly AssetDefinition[] = (products as PopularProduct[]).map(product => {
  const [w, d, h] = product.size;
  const estimated = product.dimensionStatus === 'estimated';
  return {
    key: `popular_${product.id}`, name: product.name, category: product.category, collection: product.collection,
    description: `${product.collection} selected using dated category popularity. Editable planning model${estimated ? ' with estimated dimensions' : ''}.`,
    defaultDimensions: { x: +(w / 100).toFixed(6), z: +(d / 100).toFixed(6), y: +(h / 100).toFixed(6) },
    placement: product.placement ?? { mount: 'floor' },
    recipe: 'retail_furniture', furnitureProduct: product.model,
    capabilities: product.model.kind === 'floor_lamp' ? { lighting: { type: 'diffuse', defaultColor: '#fff3df', defaultIntensity: 1 } } : undefined,
    source: { retailer: 'Popular Products', productCode: product.id,
      dimensions: product.dimensionStatus, dimensionNotes: product.dimensionNotes,
      dimensionSources: product.dimensionSources,
      popularity: { category: product.popularityCategory, rank: product.popularityRank, checkedAt: product.checkedAt },
    },
  };
});
