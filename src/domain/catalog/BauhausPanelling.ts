/** Reference-matched appearances. Grain comes from bundled wood photographs,
 * not extracted retailer images; colours are visual estimates from supplied references. */
export interface BauhausPanelFinish {
  id: string;
  name: string;
  sku: string;
  range: 'Quanti' | 'Bauhaus' | 'ARTELMO';
  color: string;
  backingColor: string;
  grain: 'oak' | 'walnut';
  slatWidth: number;
  gapWidth: number;
  panelWidth: number;
  panelHeight: number;
  thickness: number;
  sourceUrl: string;
}
const product = (sku: string, name: string, range: BauhausPanelFinish['range'], color: string, backingColor: string, grain: BauhausPanelFinish['grain'], width: number, height: number, slug: string): BauhausPanelFinish => ({
  id: `bauhaus_${sku}`, sku, name, range, color, backingColor, grain,
  slatWidth: .025,
  gapWidth: .015,
  panelWidth: width, panelHeight: height, thickness: range === 'ARTELMO' ? .020 : .018,
  sourceUrl: `https://www.bauhaus.com.tr/${slug}-${sku}`,
});
export const BAUHAUS_PANEL_FINISHES: readonly BauhausPanelFinish[] = [
  product('61465077', 'Quanti Oiled Oak', 'Quanti', '#bda078', '#252725', 'oak', .52, 2.44, 'quanti-dikdortgen-akustik-duvar-paneli-yagli-mese-52x244x18-cm'),
  product('61465068', 'Quanti Grey Oak', 'Quanti', '#aaa79b', '#252625', 'oak', .52, 2.44, 'quanti-dikdortgen-akustik-duvar-paneli-gri-mese-52x244x18-cm'),
  product('61465059', 'Quanti Light Grey Oak', 'Quanti', '#c1bfb4', '#252625', 'oak', .52, 2.44, 'quanti-dikdortgen-akustik-duvar-paneli-acik-gri-mese-52x244x18-cm'),
  product('61467912', 'Quanti Walnut', 'Quanti', '#927e6d', '#272725', 'walnut', .52, 2.44, 'quanti-dikdortgen-akustik-duvar-paneli-ceviz-52x244x18-cm'),
  product('61598007', 'Light Oak / Grey Felt', 'Bauhaus', '#c9b07d', '#aaa99f', 'oak', .52, 2.44, 'akustik-mdf-gri-keceli-duvar-paneli-acik-mese-52x244-cm'),
  product('61598016', 'Oiled Oak / Black Felt', 'Bauhaus', '#d1a65d', '#272c29', 'oak', .52, 2.44, 'akustik-mdf-duvar-paneli-yagli-mese-52x244-cm'),
  product('61598034', 'Grey Oak / Black Felt', 'Bauhaus', '#a6a59a', '#252725', 'oak', .52, 2.44, 'akustik-mdf-duvar-paneli-gri-mese-52x244-cm'),
  product('61505016', 'ARTELMO Antique — 60 × 60 cm', 'ARTELMO', '#8b6a50', '#191b18', 'oak', .60, .60, 'akustik-mdf-duvar-paneli-kare-antik'),
  product('61505007', 'ARTELMO Grey Oak — 60 × 60 cm', 'ARTELMO', '#9a8d7e', '#171a17', 'oak', .60, .60, 'akustik-mdf-duvar-paneli-kare-grey-oak'),
  product('61505025', 'ARTELMO Dark Walnut — 60 × 60 cm', 'ARTELMO', '#603c2e', '#181715', 'walnut', .60, .60, 'mdf-akustik-duvar-paneli-kare-20x600x600mm-koyu-ceviz'),
  product('61505034', 'ARTELMO Teak — 60 × 60 cm', 'ARTELMO', '#bc8a56', '#191b17', 'oak', .60, .60, 'mdf-akustik-duvar-paneli-kare-20x600x600mm-teak'),
  product('61504970', 'ARTELMO Antique — 60 × 280 cm', 'ARTELMO', '#8b6a50', '#191b18', 'oak', .60, 2.80, 'mdf-akustik-duvar-paneli-20x600x2800mm-antik'),
  product('61504961', 'ARTELMO Grey Oak — 60 × 280 cm', 'ARTELMO', '#9a8d7e', '#171a17', 'oak', .60, 2.80, 'mdf-akustik-duvar-paneli-20x600x2800mm-grey-oak'),
  product('61504989', 'ARTELMO Dark Walnut — 60 × 280 cm', 'ARTELMO', '#603c2e', '#181715', 'walnut', .60, 2.80, 'mdf-akustik-duvar-paneli-20x600x2800mm-koyu-ceviz'),
  product('61504998', 'ARTELMO Teak — 60 × 280 cm', 'ARTELMO', '#bc8a56', '#191b17', 'oak', .60, 2.80, 'mdf-akustik-duvar-paneli-20x600x2800mm-teak'),
];
const byId = new Map(BAUHAUS_PANEL_FINISHES.map(p => [p.id, p]));
export const bauhausPanel = (id?: string): BauhausPanelFinish | undefined => id ? byId.get(id) : undefined;
export const PANEL_TEXTURE_SLATS = 8;
export const PANEL_TEXTURE_HEIGHT = .5;
export const panelGrainUrl = (panel: BauhausPanelFinish): string => `/textures/wood/wood_${panel.grain === 'walnut' ? 'american_walnut' : 'natural_oak'}.jpg`;
export const panelTextureWidth = (panel: BauhausPanelFinish): number => PANEL_TEXTURE_SLATS * (panel.slatWidth + panel.gapWidth);
/** Mean-centre photographic RGB so wood hue and felt hue cannot tint each other. */
export function matchGrainColour(pixels: Uint8ClampedArray, target: readonly number[]): void {
  const mean = [0, 0, 0], count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += pixels[i + c] / count;
  for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) pixels[i + c] = Math.max(0, Math.min(255, target[c] + (pixels[i + c] - mean[c]) * .65));
}
