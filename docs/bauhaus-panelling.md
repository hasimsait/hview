# Bauhaus panelling references

The Lambri picker contains 15 reference-matched finishes keyed by retailer SKU. Wood tones and backing tones were visually matched to the product references supplied in chat. These are design previews, not calibrated product scans. Their grain uses the bundled photographic oak and walnut textures; it is not extracted from the retailer images. The picker states this provenance.

All presets use the user's final requested geometry: **25 mm wood faces and 15 mm exposed felt**, including Quanti. An eight-slat texture covers 320 mm horizontally and 500 mm vertically. Rotation switches the complete grain/slat direction together. The grey-felt light oak has its own backing colour. Square and full-height ARTELMO products retain separate SKUs and dimensions; automatic alternating-square layouts are not introduced.

The renderer mean-centres the photographic RGB around each reference wood tone, preserves grain variation, aligns walnut grain with the slats, and blends the repeat boundary to avoid horizontal joins. Material tint stays white so it does not darken or tint the photographed wood and felt a second time. Both source grain images are already embedded in the offline editor. No external image fetch is required.

The working plan and its current materials are unchanged. These presets must be selected deliberately. Traditional solid timber tongue-and-groove products are not represented as verified Bauhaus finishes: the supplied reference batch covers acoustic MDF panels, and does not establish their grain or colour.

The final reference batch refines ARTELMO Grey Oak to warm grey-taupe, Antique to medium brown, Dark Walnut to dark red-brown, and Teak to orange-brown. Each square/tall pair shares its finish recipe; repeated photos do not introduce duplicate SKUs.

## Comparing bedroom colours

Open **Lighting → Compare surface colors** to compare the base wood and paint colours without room lights, shadows, tone mapping, white-balance adjustment or foreground fading. Switch it off to assess the materials under room lighting; the previous lighting settings are retained. Dark felt and natural grain remain visible, so the overall panel still appears darker than a wall painted entirely in the wood's base tone.

The selected panel's **Wood color** and **Felt color** hex fields are independent. Copy a wall's **Paint color** hex into **Wood color** to match its base tone while keeping the grain. **Restore reference colors** restores that panel's reference tones. Generic lambri has equivalent slat/felt fields. The selected wall's hex field follows changes of selection rather than retaining the previous wall's value.

Generated colour maps are tagged sRGB and carry their tint once. Photographic wood keeps its photographed albedo instead of being multiplied by the catalogue swatch again. Plaster uses the selected solid colour plus a separate bump map for surface detail. The new `woodColor` override survives native and legacy plan export; old panel finishes with `color: #ffffff` still use their reference colours. The working plan's saved colours and geometry are not rewritten by this rendering refactor.

`npm run test:colors:browser` checks actual rendered sRGB pixels for lambri, paint and plaster, custom wood/felt independence, preserved grain and restoration of room lighting. This is a rendering-consistency check, not a claim that the retailer reference photos are calibrated measurements of physical samples.
