import type { AssetDefinition } from './AssetDefinition';
import type { KitchenwareModel } from './KitchenwareModel';
import products from './IkeaKitchenProducts.json' with { type: 'json' };

interface Article extends KitchenwareModel {
  article: string;
  name: string;
  collection: string;
  size: [number, number, number]; // Width × depth × height, centimetres; includes handles/lid.
  url: string;
  dimensionNotes: string;
  packQuantity?: number;
  singleFromSet?: boolean;
}

export const IKEA_KITCHEN_PRODUCTS: readonly AssetDefinition[] = (products as Article[]).map(article => {
  const { article: code, name, collection, size: [w, d, h], url, dimensionNotes, packQuantity, singleFromSet, ...model } = article;
  return {
    key: `ikea_${code}`, name, category: 'kitchen', collection,
    description: `${collection}. ${singleFromSet ? 'One piece from the retail set. ' : ''}${packQuantity ? `Retail pack: ${packQuantity} pieces. ` : ''}Editable cabinet-planning model.`,
    defaultDimensions: { x: +(w / 100).toFixed(6), y: +(h / 100).toFixed(6), z: +(d / 100).toFixed(6) },
    placement: { mount: 'surface', defaultElevation: .85 },
    capabilities: { resizable: true }, recipe: 'kitchenware', kitchenware: model,
    source: { retailer: 'IKEA', productCode: code, url, dimensions: /estimat/i.test(dimensionNotes) ? 'estimated' : 'listed', dimensionNotes },
  };
});
