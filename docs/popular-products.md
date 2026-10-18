# Popular Products catalogue

83 editable furniture assets across 14 collections, bundled for offline use. Filter with **Catalogue source → Popular Products**, then search by name, model or asset ID.

`src/domain/catalog/PopularProducts.json` stores only asset identity, name, category, collection, dimensions in centimetres (width × depth × height), model settings and optional placement. Model settings override the builder defaults; unused settings are omitted. Product keys remain stable for existing saved plans.

Models support resizing, position, rotation and component finishes. Floor lamps also support saved on/off and intensity settings. Bed dimensions describe the overall frame footprint. Models are adjustable planning geometry.
