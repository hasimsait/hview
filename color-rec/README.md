# Warm paint palette and purchase quantities

Use two shared Filli Boya colours for the smaller spaces and the user's selected **Jotun 1876 WILD EARL** for the 22 m² living room. Remove the previous ANDEZİT 25 accent completely: the living room now has one continuous warm beige on all painted walls and exposed painted column faces. The 13.3 m² living room retains SİS BULUTU; the singular living-room correction is applied to the previously accented 22 m² room.

Jotun's [official Turkish colour page](https://www.jotun.com/tr-tr/decorative/colours/interior/all-interior-colours/1876-wild-earl-interior) identifies 1876 WILD EARL as a soft golden beige and presents it as a sand beige. It is a Jotun colour reference, **not a verified Filli Boya equivalent**. The preview uses `#d4cbb9`, a [third-party digital approximation](https://plan-home.com/color/wild-earl-1876), not an official Jotun RGB specification. Match a physical sample if commissioning this colour in Momento Silan; an exact cross-brand tint formula is not established here.

| Room / four-view sheet | Floor area | Painted surfaces |
| --- | ---: | --- |
| [Living room](room-sheets/01-living-room-13m2.png) | 13.31 m² | SİS BULUTU: warm ivory, continuous walls and painted columns; existing slate-blue sofa and burgundy curtains supply contrast |
| [Small bedroom](room-sheets/02-bedroom-8m2.png) | 8.32 m² | SİS BULUTU on all painted walls and column faces; no accent wall; retain the blue bed |
| [Kitchen](room-sheets/03-kitchen.png) | 7.95 m² | SİS BULUTU on painted surfaces; retain green cabinets, mosaic and floor tile |
| [Master bedroom](room-sheets/04-master-bedroom.png) | 11.36 m² | HASIR 310: light warm stone throughout; replace the dark red wall; keep the wardrobe and bedding |
| [Hallway / entry](room-sheets/05-hallway-entry.png) | 11.72 m² | SİS BULUTU continuously through the L-shaped corridor, including painted columns and returns |
| [Large living room](room-sheets/06-living-room-22m2.png) | 22.00 m² | Jotun 1876 WILD EARL continuously on every painted wall and exposed painted column face; no grey accent |

The 8.3 m² bedroom stays visually continuous, with no green or dark accent. The master bedroom retains light warm HASIR 310 around its large wardrobe. The large living room is approximately 3.21 × 7.03 m in polygon bounding span: use the same golden beige on the sofa wall, TV wall, end walls and painted column returns. The existing burgundy upholstery and timber provide contrast. These spans describe polygon envelopes, not clear circulation space.

## Momento Silan specification and quantity calculation

Checked against the manufacturer's [Momento Silan technical data sheet](https://www.filliboya.com/uploads/TDS_MOMENTOSILAN.pdf) and [official product page](https://www.filliboya.com/urun/momento-silan) on 26 October 2026. The TDS gives **45–80 ml/m² per coat**, also expressed approximately as 13–22 m²/L for one coat. It recommends at least two coats over the appropriate primer. Use the conservative **80 ml/m²** endpoint, then add the requested **15% reserve**:

**Undiluted paint required (L) = painted surface (m²) × 0.080 × 2 coats × 1.15.**

| Colour | Estimated painted surface | Two coats + 15%, at Momento Silan consumption | Purchase / status |
| --- | ---: | ---: | --- |
| SİS BULUTU `#ece6db` | 137.27 m² | 25.26 L | 2 × 15 L = **30 L** |
| HASIR 310 `#e2dbd4` | 39.65 m² | 7.30 L | 1 × 7.5 L = **7.5 L** |
| Jotun 1876 WILD EARL | 55.36 m² | **10.19 L, provisional scenario only** | Jotun coating product not selected; no confirmed purchase quantity or pack sizes |

**Wild Earl is a colour code, not a coating product.** The 10.19 L figure reuses the requested Momento Silan consumption assumption solely for comparison; it must not be read as a Jotun coverage specification. If using Jotun paint, recalculate from the selected product's TDS and actual packs. If using a physically approved Momento Silan colour match, the same calculation yields 10.19 L (a provisional 12.5 L pack scenario using 7.5 + 2.5 + 2.5 L). The exact Filli tint formula is not verified. Do not treat the former ANDEZİT pails or 50 L three-tint order as a current shopping list.

A lower-volume SİS BULUTU option remains **27.5 L** (15 + 7.5 + 2.5 + 2.5 L), rather than two 15 L pails; compare actual dealer quotes. Manufacturer pack sizes and coverage are in **litres**; do not equate kg with litres without the product/base density.

Areas use model wall centreline lengths and actual heights (2.7 m), subtract rectangular door/window openings, add half-depth reveals per painted room side, and add all selected painted column faces. This is a **conservative model estimate**, not a measured site bill: fixed cabinetry, wardrobes and any overlap between wall and column surfaces are not deducted. A face-by-face calculation is supplied in [paint-quantities.json](paint-quantities.json). The 15% reserve is applied once, after both coats, before rounding to packs. The brochure's optimistic two-coat coverage table is not multiplied by two again.

Quantities exclude ceilings and primer. The former dark red bedroom surface needs appropriate preparation and primer; two finish coats assume a sound, suitably primed substrate. The TDS specifies up to 10% water by volume for brush/roller application and 4–6 hours between coats at 20°C / 65% RH. Added water does not reduce the amount of paint to buy. Final consumption depends on surface absorbency and a controlled test patch.

## Scope and deliverables

Only the corridor / entry, kitchen, two living rooms and two bedrooms are included. **WC, bathrooms, shower and the 5.5 m² balcony are excluded.** The source label Dining / Office refers to the balcony. Preserve all tile and glass finishes. Existing ceilings and furniture remain unchanged. The optional dryer in the small bedroom has not been placed; its clearance and ventilation remain a separate layout decision.

- [PDF study](room-colour-study.pdf): six room sheets.
- [Room sheets](room-sheets/): four diagonal views per room.
- [Full-size renders](renders/): 24 PNGs, four per room at 1400 × 1050.
- [Palette](palette.json): Filli catalogue shades, the selected Jotun reference, dimensions and room-specific notes.
- [Column finish map](column-finishes.json): 22 explicitly coloured column faces, matched to their adjoining room colour.
- [Quantity schedule](paint-quantities.json): formula, purchase packs and surface ledger.

Views use +X/+Z, −X/+Z, −X/−Z and +X/−Z model coordinates, not compass directions. Camera-facing walls and ceilings are omitted to reveal opposing wall pairs. Native HView renders use fixed model lighting; physical samples should be checked under the installed lamps. This study changes neither application source nor `public/sample.plan`.
