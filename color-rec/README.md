# Fixed room palette with a light lilac master bedroom

The requested assignments are fixed: **salon WILD EARL sand-beige; smaller living room and small bedroom KUMRU; kitchen and corridor KIRIK BEYAZ**. The master bedroom uses **Filli HİBİSKUS 20, light lilac (`#dcc8db`)**. Only about 2.5 m width remains after its large wardrobe, so the proposed dark brick red was rejected. Light lilac gives the room a clear colour beside the taupe wardrobe and green pillows while keeping a light enclosure. Use one continuous colour on painted walls and column returns; retain the existing light ceiling and furniture.

## Rooms and corrected quantities

All amounts include **two coats plus 15% reserve** at 2.7 m wall height.

| Room / four-view sheet | Floor | Estimated painted surface | Colour | Required |
| --- | ---: | ---: | --- | ---: |
| [Main salon](room-sheets/06-living-room-22m2.png) | 22.00 m² | 49.65 m² | Jotun 1876 WILD EARL | 11.90 L |
| [Smaller living room](room-sheets/01-living-room-13m2.png) | 13.31 m² | 33.90 m² | Filli KUMRU | 6.24 L |
| [Small bedroom](room-sheets/02-bedroom-8m2.png) | 8.32 m² | 29.87 m² | Filli KUMRU | 5.50 L |
| [Kitchen](room-sheets/03-kitchen.png) | 7.95 m² | 19.17 m² | Filli KIRIK BEYAZ | 3.53 L |
| [Corridor](room-sheets/05-hallway-entry.png) | 11.72 m² | 45.96 m² | Filli KIRIK BEYAZ | 8.46 L |
| [Master bedroom](room-sheets/04-master-bedroom.png) | 11.36 m² | 33.27 m² | Filli HİBİSKUS 20 | 6.12 L |

**Correction to earlier quantities:** room polygons already follow column projections. Measure their boundary once; do not add the column front faces over the wall faces they replace. The earlier additive column calculation is superseded. The KUMRU rooms total **63.77 m² / 11.73 L** from unrounded values; individual displayed litres can differ by 0.01 L when summed.

The model estimate follows each room-polygon boundary, classifies boundary segments against adjacent wall finishes to exclude tile/glass, subtracts adjacent door/window openings and adds half-depth reveal allowance. It does not subtract fixed cabinetry or wardrobes. It is a model-based estimate rather than a site survey; use actual wall and opening measurements to refine it before painting. A segment and opening ledger is provided in [paint-quantities.json](paint-quantities.json).

## Practical pail plan

| Colour / specified coating | Combined need | Practical pail | Status |
| --- | ---: | --- | --- |
| KUMRU / Filli Momento Silan | 11.73 L | 1 × 15 L | Already owned; no additional purchase. About 3.27 L remains beyond the requirement that already includes reserve. |
| KIRIK BEYAZ / Filli Momento Silan | 11.98 L | 1 × 15 L | Kitchen and corridor share it. |
| WILD EARL / Jotun Fenomastic Güzel Evim Zengin Mat Yeni | 11.90 L | 1 × 15 L | Main salon. |
| HİBİSKUS 20 / Filli Momento Silan | 6.12 L | 1 × 7.5 L | Master bedroom. |

Total on hand after purchase: **52.5 L / four pails / four colours**. With the 15 L KUMRU already owned, the remaining order is **37.5 L / three pails**. For the three colours needing about 12 L each, 7.5 + 2.5 + 2.5 L is a lower-volume alternative to one 15 L pail. The practical plan uses fewer pails; no price saving is claimed without dealer quotes.

Product-specific coverage assumptions:

- Filli Momento Silan: **area × 0.080 L/m² per coat × 2 × 1.15**, the conservative endpoint of the manufacturer's 45–80 ml/m² range.
- Jotun Fenomastic Güzel Evim Zengin Mat Yeni: **area ÷ 9.6 m²/L per coat × 2 × 1.15**, the conservative endpoint of the accessed TDS's 9.6–13.4 m²/L range.

Primer and ceilings are separate; the two finish coats assume a suitably prepared and primed substrate. Quantities are undiluted litres; added water does not reduce the amount to buy. The 15% reserve is already included and must not be added again at checkout.

## Sources and deliverables

Manufacturer references: [HİBİSKUS 20](https://www.filliboya.com/renk/hibiskus-20), [KUMRU](https://www.filliboya.com/renk/kumru), [KIRIK BEYAZ](https://www.filliboya.com/renk/kirik-beyaz), [WILD EARL](https://www.jotun.com/tr-tr/decorative/colours/interior/all-interior-colours/1876-wild-earl-interior), [Momento Silan TDS](https://www.filliboya.com/uploads/TDS_MOMENTOSILAN.pdf), [Jotun TDS, code 42882, dated 14 September 2022](https://jotundatasheetsprod.blob.core.windows.net/tds/TDS%C2%A442882%C2%A4Fenomastic%20G%C3%BCzel%20Evim%20Zengin%20Mat%20Yeni%C2%A4tr-TR%C2%A4TR.pdf). A newer local label/TDS takes precedence over the accessed sheet.

- [Palette and quantity sheet](palette-and-quantities.png).
- [Seven-page PDF](room-colour-study.pdf): six room sheets plus the quantity sheet.
- [Room sheets](room-sheets/): four opposing diagonal views per included room.
- [24 full-size native renders](renders/), 1400 × 1050.
- [Palette](palette.json), [corrected quantity ledger](paint-quantities.json), [painted column map](column-finishes.json).

WC, bathrooms, shower and the 5.5 m² balcony are excluded. The source Dining / Office is the balcony. Tile, glass, ceilings, furniture and layout remain unchanged; the optional bedroom dryer is not placed. View directions use model coordinates, not compass directions. Camera-facing walls and ceilings are omitted to reveal interiors. Digital swatches and model lighting are approximations; compare physical samples under installed lamps. Wild Earl's `#d4cbb9` uses a [third-party digital reference](https://plan-home.com/color/wild-earl-1876), not an official Jotun RGB specification. No exact cross-brand tint formula is claimed. Application source and `public/sample.plan` remain unchanged.
