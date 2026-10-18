import type { AssetDefinition, AssetPlacement } from './AssetDefinition';
import type { AccessoryModel } from './AccessoryModel';
import type { BathroomKind, BathroomModel } from './BathroomModel';
import products from './IkeaBathroomProducts.json' with { type: 'json' };

interface Article extends Omit<BathroomModel, 'kind'> {
  article: string;
  name: string;
  kind: BathroomKind | AccessoryModel['kind'];
  collection: string;
  size: number[]; // W × D × H, centimetres
  mount: AssetPlacement['mount'];
  url: string;
  dimensionNotes: string;
  style?: AccessoryModel['style'];
}
const vesselKinds = new Set(['soap_pump', 'tumbler', 'soap_dish', 'dish', 'storage_box', 'basket', 'brush', 'bin', 'rug', 'trolley']);

function articleAsset(article: Article): AssetDefinition {
  const { article: code, name, kind, collection, size, mount, url, dimensionNotes, style, ...details } = article;
  const [w, d, h] = size;
  const accessory = vesselKinds.has(kind);
  const estimated = /estimat/i.test(dimensionNotes);
  const wood = /Bamboo|Birch|Willow|Rattan/.test(name);
  const fabric = ['rug', 'towel', 'curtain', 'hanging_storage'].includes(kind);
  const elevation = kind === 'curtain' ? .1 : kind === 'curtain_rod' || kind === 'curtain_ring' ? 2.1
    : kind === 'towel' ? .7 : ['shower_system', 'shower_kit', 'hose'].includes(kind) ? 1
      : kind === 'shower_head' ? 1.5 : kind === 'tap' ? 1 : 1.25;
  return {
    key: `ikea_${code}`, name, category: 'bathroom', collection,
    description: `${collection} from IKEA Türkiye. Editable planning model; ${estimated ? 'some dimensions are estimated' : 'published product dimensions'}.`,
    defaultDimensions: { x: +(w / 100).toFixed(6), z: +(d / 100).toFixed(6), y: +(h / 100).toFixed(6) },
    placement: mount === 'wall' ? { mount, defaultElevation: elevation, wallOffset: d / 200 + .005 }
      : mount === 'surface' ? { mount, defaultElevation: .9 } : { mount },
    recipe: accessory ? 'ikea_accessory' : 'bathroom_accessory',
    accessory: accessory ? { kind: kind as AccessoryModel['kind'], color: details.color, accentColor: details.accentColor, style,
      material: fabric ? 'fabric' : wood ? 'wood' : /Glass|Clear|Transparent/.test(name) ? 'glass' : 'paint' } : undefined,
    bathroom: accessory ? undefined : { kind: kind as BathroomKind, ...details },
    source: { retailer: 'IKEA', productCode: code, url, dimensions: estimated ? 'estimated' : 'listed', dimensionNotes },
  };
}

/** Individually referenced Turkish-market articles; colour/size variants retain their real article codes. */
export const IKEA_BATHROOM_PRODUCTS: readonly AssetDefinition[] = (products as Article[]).map(articleAsset);
