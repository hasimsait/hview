# Catalogue references

Catalogue entries contain the maintained product identities, dimensions, source URLs and estimate notes. Procedural models are planning references, not manufacturer CAD. Published dimensions and estimated missing extents are distinguished in each entry's `source` metadata; retailer links do not establish current availability.

## Maintained data

| Catalogue | Data and references |
| --- | --- |
| BAUHAUS accessories, IKEA bookcases and reference kitchen appliances | [CuratedAssets.ts](../src/domain/catalog/CuratedAssets.ts) |
| IKEA accessories | [IkeaAccessories.ts](../src/domain/catalog/IkeaAccessories.ts) |
| IKEA bathroom and shower articles | [IkeaBathroomProducts.json](../src/domain/catalog/IkeaBathroomProducts.json), with metadata conversion in [IkeaBathroomProducts.ts](../src/domain/catalog/IkeaBathroomProducts.ts) |
| Popular Products | [PopularProducts.json](../src/domain/catalog/PopularProducts.json): planning dimensions and model settings |
| Electrical fittings | [ElectricalAssets.ts](../src/domain/catalog/ElectricalAssets.ts) |
| Water-treatment and household appliances | [HouseholdAppliances.ts](../src/domain/catalog/HouseholdAppliances.ts) |
| Pet care, vanity and wardrobe objects | [DailyLifeAssets.ts](../src/domain/catalog/DailyLifeAssets.ts) |
| Tile sizes and finish defaults | [tiles.json](../public/textures/tiles/tiles.json) |

Runtime dimensions use metres: `x` is width, `y` height and `z` depth. Product `size` arrays in the IKEA datasets use width × depth × height in centimetres. Installed depths, folded/hanging thicknesses, foliage spread and other unpublished extents may be estimates; package dimensions are not substituted for product dimensions.

## Additional reference notes

- VIKO Karre face sizes were checked against the [manufacturer catalogue](https://viko.panasonic.com/Uploads/File/panasonic-general-product-catalogue_1.pdf) and [double-socket listing](https://www.trendyol.com/en/viko/viko-karre-double-grounded-socket-90967x56-white-p-40496935). Visible projection excludes the concealed mechanism and is estimated. Per-product links remain in the catalogue data.
- The angled hood, gas cooktop and built-in oven use standard-size estimates from unidentified reference photographs.
- The water-treatment unit uses the supplied photograph's 35 W × 67 H × 49 D cm envelope. The DT4 65 L heater uses the supplied 50 W × 72 H × 50 D cm envelope; its exterior geometry is a reference representation.
- The kitchen laminate and Ivory & Taupe Striped Mosaic are reconstructed from photographs. Mosaic pitch is estimated at 25 × 12.5 mm, repeated over a 30 × 30 cm sheet. Internal joints are in the texture; sheet-boundary grout defaults to zero. Color, grain scale and gloss remain approximations.
- Generic trim, soft furnishings, pet-care objects, footwear and practical fittings have adjustable planning envelopes. Shoe labels do not establish the measured size of a particular pair. Cloth patterns are neutral visual cues rather than reproductions of product artwork.

Placement and editing instructions are in the [editor guide](editor-guide.md) and [cabinet guide](cabinet-editor.md). Catalogue geometry and referenced textures are bundled into portable HTML; opening a product's retailer link is optional.
