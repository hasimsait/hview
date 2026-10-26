# Shared paint palette and purchase quantities

Use **two shared main colours plus one restrained accent** across the six included spaces. This replaces the all-KIRIK BEYAZ proposal. The purchase plan groups rooms by tint, rather than buying a separate colour for every room.

| Room / four-view sheet | Floor area | Painted surfaces |
| --- | ---: | --- |
| [Living room](room-sheets/01-living-room-13m2.png) | 13.31 m² | SİS BULUTU: warm ivory, continuous walls and painted columns; existing slate-blue sofa and burgundy curtains supply contrast |
| [Small bedroom](room-sheets/02-bedroom-8m2.png) | 8.32 m² | SİS BULUTU on all painted walls and column faces; no accent wall; retain the blue bed |
| [Kitchen](room-sheets/03-kitchen.png) | 7.95 m² | SİS BULUTU on painted surfaces; retain green cabinets, mosaic and floor tile |
| [Master bedroom](room-sheets/04-master-bedroom.png) | 11.36 m² | HASIR 310: light warm stone throughout; replace the dark red wall; keep the wardrobe and bedding |
| [Hallway / entry](room-sheets/05-hallway-entry.png) | 11.72 m² | SİS BULUTU continuously through the L-shaped corridor, including painted columns and returns |
| [Large living room](room-sheets/06-living-room-22m2.png) | 22.00 m² | HASIR 310 main walls, ANDEZİT 25 muted blue-grey on the uninterrupted sofa wall `_5k50y` and its adjoining painted column faces |

The 8.3 m² bedroom stays visually continuous, with no green or dark accent. The master bedroom receives a warmer stone tone that reduces contrast around the large wardrobe. The large living room is approximately 3.21 × 7.03 m in polygon bounding span: concentrate the blue-grey on one sofa backdrop, while keeping the opposite TV wall and remaining enclosure light. The blue-grey connects to the burgundy upholstery without repeating another red surface. Do not carry it around all four walls. These spans describe polygon envelopes, not clear circulation space.

## Momento Silan specification and quantity calculation

Checked against the manufacturer's [Momento Silan technical data sheet](https://www.filliboya.com/uploads/TDS_MOMENTOSILAN.pdf) and [official product page](https://www.filliboya.com/urun/momento-silan) on 26 October 2026. The TDS gives **45–80 ml/m² per coat**, also expressed approximately as 13–22 m²/L for one coat. It recommends at least two coats over the appropriate primer. Use the conservative **80 ml/m²** endpoint, then add the requested **15% reserve**:

**Undiluted paint required (L) = painted surface (m²) × 0.080 × 2 coats × 1.15.**

| Shared tint | Estimated painted surface | Two coats + 15% reserve | Practical purchase |
| --- | ---: | ---: | --- |
| SİS BULUTU `#ece6db` | 137.27 m² | 25.26 L | 2 × 15 L = **30 L** |
| HASIR 310 `#e2dbd4` | 73.78 m² | 13.57 L | 1 × 15 L = **15 L** |
| ANDEZİT 25 `#b9bfc2` | 21.23 m² | 3.91 L | 2 × 2.5 L = **5 L** |
| Total | 232.28 m² | **42.74 L** | **50 L**, three tint codes |

A lower-volume SİS BULUTU option is **27.5 L** (15 + 7.5 + 2.5 + 2.5 L), bringing the total purchase to 47.5 L but adding two pails. Compare dealer quotes before choosing between the two pack combinations; no price saving is assumed. There is no need to buy a large pail just for an accent. The manufacturer's pack sizes and coverage are in **litres**; kg cannot be converted to litres without the particular product/base density.

Areas use model wall centreline lengths and actual heights (2.7 m), subtract rectangular door/window openings, add half-depth reveals per painted room side, and add all selected painted column faces. This is a **conservative model estimate**, not a measured site bill: fixed cabinetry, wardrobes and any overlap between wall and column surfaces are not deducted. A face-by-face calculation is supplied in [paint-quantities.json](paint-quantities.json). The 15% reserve is applied once, after both coats, before rounding to packs. The brochure's optimistic two-coat coverage table is not multiplied by two again.

Quantities exclude ceilings and primer. The former dark red bedroom surface needs appropriate preparation and primer; two finish coats assume a sound, suitably primed substrate. The TDS specifies up to 10% water by volume for brush/roller application and 4–6 hours between coats at 20°C / 65% RH. Added water does not reduce the amount of paint to buy. Final consumption depends on surface absorbency and a controlled test patch.

## Scope and deliverables

Only the corridor / entry, kitchen, two living rooms and two bedrooms are included. **WC, bathrooms, shower and the 5.5 m² balcony are excluded.** The source label Dining / Office refers to the balcony. Preserve all tile and glass finishes. Existing ceilings and furniture remain unchanged. The optional dryer in the small bedroom has not been placed; its clearance and ventilation remain a separate layout decision.

- [PDF study](room-colour-study.pdf): six room sheets.
- [Room sheets](room-sheets/): four diagonal views per room.
- [Full-size renders](renders/): 24 PNGs, four per room at 1400 × 1050.
- [Palette](palette.json): official catalogue shades, dimensions and room-specific notes.
- [Column finish map](column-finishes.json): 22 explicitly coloured column faces, matched to their adjoining room / accent plane.
- [Quantity schedule](paint-quantities.json): formula, purchase packs and surface ledger.

Views use +X/+Z, −X/+Z, −X/−Z and +X/−Z model coordinates, not compass directions. Camera-facing walls and ceilings are omitted to reveal opposing wall pairs. Native HView renders use fixed model lighting; physical samples should be checked under the installed lamps. This study changes neither application source nor `public/sample.plan`.
