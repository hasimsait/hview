# Popular Products catalogue

83 individually identified products across 14 furniture and home collections, selected from a dated category-popularity snapshot on 16 October 2026. Brand, range and model identifiers are retained; product labels and dimension notes are English.

Use **Catalogue source → Popular Products** to filter this collection. Search by product name, model or reference ID. Category ranks are historical snapshots, not live sales statistics. No price, offer or stock claim is embedded.

Geometry and catalogue data are bundled in editor and viewer HTML and work offline. Dimensions are marked as listed or estimated. Manufacturer and retailer dimension references are retained where available; conflicting specifications remain explicit. Mattress dimensions are not treated as outer bed-frame dimensions.

The maintained inventory is `src/domain/catalog/PopularProducts.json`; its runtime adapter is `PopularProducts.ts`. Older saved product identifiers remain readable through numeric-reference migration.

## Geometry and measurements

These bundled procedural models are editable references for room planning, not manufacturer CAD. Component geometry distinguishes bookcase shelf/column counts, side-shelf and gaming desks, drawer/door layouts, mirrors, upholstered and metal-frame seats, armless chair beds, storage tables, media shelves, shoe racks and benches, fluted sideboards, upholstered dining chairs, spiral/arc/tripod lamps, front-loading washers, daybeds and folding guest beds. Sofa beds and folding beds are shown in their use position; opening mechanisms are not simulated. Colour, dimensions, position, rotation and section finishes remain editable. Lamps retain on/off, intensity and saved settings.

All geometry and source metadata are bundled in both editor and viewer HTML. Placing, rendering and re-exporting these products works with all network requests blocked. The app does not need an account or catalogue connection at runtime.

12 product dimension sets are marked as listed; 71 include an estimated extent or unresolved ambiguity. Dimensions below are **width × depth × overall height** in centimetres. Labelled listing dimensions take precedence over guessed order, and additional manufacturer/retailer references are listed where consulted. Dimensions in an unlabelled title are not silently treated as confirmed W × D × H. Bed titles specify mattress sizes, so their larger outer frames and heights remain estimated. Lamp projections and missing sofa dimensions are also estimates. Package dimensions are not used as product dimensions.

Known conflicts are preserved in the dimension notes instead of being presented as precise: Novado's labelled dimensions disagree with its combined size field; a wardrobe title describes six doors while the specification field says four. Confirm the exact merchant edition before making clearance decisions. The maintained inventory is `src/domain/catalog/PopularProducts.json`; the runtime adapter is `PopularProducts.ts`.

## Bookcases (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Dekorister Cansu D Five-Shelf Bookcase — White | #1 | 39 × 20 × 160 | Listed. Manufacturer lists width 39 cm, depth 20 cm and height 160 cm. | Reference ID 63214012 · [Dimension reference 1](https://www.dekorister.com.tr/urun/cansu-d-5-rafli-kitaplik-beyaz) |
| Remaks Three-Shelf Bookcase — White | #2 | 56 × 20 × 108 | Listed. Product listing labels height 108 cm, width 56 cm and depth 20 cm; product listing gives the same three extents in a different order. | Reference ID 14359445 · [Dimension reference 1](https://www.trendyol.com/remaks/3-rafli-kitaplik-kutuphane-hareketli-rafli-dekoratif-kitaplik-beyaz-p-959488549) |
| Remaks Five-Shelf Bookcase — White | #3 | 56 × 20 × 169 | Estimated. Planning dimensions are estimates for the five-shelf model; exact extents are not supplied by product listing. | Reference ID 14801412 |
| Adore Max KTP-150-BY-1 Five-Shelf Bookcase — White | #4 | 60 × 30 × 150 | Estimated. Planning extents are estimates; model code is not treated as a dimension. | Reference ID 45453458 |
| Remaks Ten-Compartment Bookcase — White | #5 | 93 × 20 × 169 | Estimated. product listing lists 169 × 20 × 93 cm without axis labels. Planning interpretation is W 93 × D 20 × H 169 cm; this axis assignment is estimated. | Reference ID 49050602 |
| Evdemo Oertha Bookcase — Walnut | #6 | 60 × 25 × 170 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 679745933 |

## Desks (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Evdemo Meta Metal-Frame Desk — Pine / White | #1 | 120 × 60 × 75 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2429113936 |
| Evdemo Leo Desk with Side Shelves — Pine | #2 | 120 × 50 × 73 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2300878202 |
| Evdemo Milenyum Gaming Desk — Black | #3 | 112 × 69 × 78 | Listed. Manufacturer lists width 112 cm, depth 69 cm and height 78 cm. | Reference ID 2090364621 · [Dimension reference 1](https://www.evdemo.com.tr/milenyum-profesyonel-oyuncu-masasi-siyah.html?manufacturer_id=1) |
| Moonlife Yagmur Compact Desk — White | #4 | 75 × 35 × 73 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2144170376 |
| Evdemo Leo Desk with Side Shelves — White | #5 | 120 × 50 × 73 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2378989044 |
| Kenzlife KIMI070 Compact Desk — White | #6 | 70 × 45 × 75 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 519412067 |

## Wardrobes (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Metalia Novado Four-Door Two-Drawer Wardrobe — White | #1 | 120 × 44 × 174 | Estimated. Conflicting product listing specifications: labelled extents 120 × 45 × 175 cm versus 130 × 51 × 180 cm. The 120 × 44 × 174 cm planning size follows the linked retailer variant; verify the exact edition. | Reference ID 23749091 · [Dimension reference 1](https://www.vivense.com/novay-4-kapili-2-cekmeceli-gardrop-dolap-modeli.html) |
| Metalia GM 177 Modena Mirrored Three-Door Wardrobe — White | #2 | 90 × 44 × 175 | Listed. Manufacturer-operated Metalia offer labels width 90 cm, depth 44 cm and height 175 cm. Mirror follows the named product variant; product listing mirror flag conflicts. | Reference ID 2481365267 · [Dimension reference 1](https://www.koctas.com.tr/metalia-gm-177-modena-3-kapi-2-cekmeceli-aynali-siyah-kulplu-beyaz-gardirop/p/5000571697) |
| Metalia GM 069 Delux Six-Door Two-Drawer Wardrobe — White | #3 | 180 × 45 × 180 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2481365252 |
| Metalia GM 070-A Novado Four-Door Wardrobe — White / Black Handles | #4 | 120 × 44 × 175 | Listed. product listing labelled width 120 cm, depth 44 cm and height 175 cm agree with its combined dimension field. | Reference ID 2481365253 |
| Metalia GM 081 Favorite Mirrored Six-Door Wardrobe — White | #5 | 180 × 48 × 180 | Estimated. Planning dimensions are estimates. Product title describes six doors but product listing specifications say four; geometry follows the named six-door variant. | Reference ID 2481365258 |
| Metalia GM 308 Ece Three-Door Three-Drawer Wardrobe — White | #9 | 90 × 44 × 175 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2481365438 |

## Coffee tables (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Variant Eylul Coffee Table — Cream | #1 | 105 × 60 × 35 | Listed. Manufacturer lists width 105 cm, depth 60 cm and height 35 cm. | Reference ID 873387540 · [Dimension reference 1](https://www.variantmobilya.com/urun/eylul-orta-sehpa-krem) |
| Remaks Retro Coffee Table — White | #3 | 100 × 55 × 42 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 336903977 |
| Zuesse Tokyo Coffee Table — Walnut | #4 | 100 × 55 × 42 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2165286734 |
| Dekorister Golden Coffee Table — White / Walnut | #5 | 100 × 55 × 42 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 39867526 |
| Moonlife Manolya Coffee Table — White | #6 | 100 × 55 × 42 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 535002087 |
| Dekorister Erica Coffee Table — White / Walnut | #7 | 100 × 55 × 42 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 47089538 |

## Sofas (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Evdemo Ada Two-Seater Sofa — Grey | #1 | 125 × 60 × 75 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 229668286 |
| Pafu Sando Two-Seater Sofa Bed — Grey | #2 | 140 × 90 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2105795112 |
| Kilim Dove 296652 Two-Seater Sofa — Navy | #3 | 160 × 85 × 85 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2376289373 |
| Eymense Yaprak Three-Seater Sofa Bed — Anthracite | #5 | 220 × 90 × 85 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2289872459 |
| Pafu Sando Single Chair Bed — Cream | #9 | 75 × 90 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 1576188154 |
| Gaga Albatros Metal-Frame Loveseat — Black | #10 | 132 × 67 × 80 | Estimated. product listing lists width 132 cm and depth 67 cm. Overall height is estimated at 80 cm. | Reference ID 66952844 |

## Armchairs (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Pafu Sando Reclining Chair Bed — Grey | #1 | 75 × 90 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 1516436014 |
| Pafu Sando Reclining Chair Bed — Teal | #2 | 75 × 90 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 851201965 |
| Enza Home Netha 11707 Armchair — Dark Green | #4 | 82 × 93 × 92 | Estimated. Planning dimensions are estimated from the Netha family footprint; confirm this upholstery edition. | Reference ID 2138929696 |
| Pafu Sando Reclining Chair Bed — Light Brown | #6 | 75 × 90 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2357111086 |
| Enza Home Netha 20202 Linen-Texture Armchair — Cream | #7 | 82 × 93 × 92 | Listed. Manufacturer lists width 820 mm, depth 930 mm and height 920 mm. | Reference ID 2138926268 · [Dimension reference 1](https://www.enzahome.com.tr/netha-berjer-keten-dokulu-20202-krem-1354395/) |
| Eymense Alfa Armchair — Light Brown | #9 | 80 × 85 × 90 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2203632673 |

## TV stands (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Dorpek Dale TV Stand — White | #1 | 140 × 30 × 43 | Listed. Manufacturer lists width 140 cm, depth 30 cm and height 43 cm. | Reference ID 2210182939 · [Dimension reference 1](https://www.dekorister.com.tr/urun/dale-tv-sehpasi-beyaz) |
| Lagomood Keyif TV Stand | #2 | 140 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 496944802 |
| Vivense Penta TV Stand — Walnut, 140 cm | #3 | 140 × 35 × 50 | Estimated. product listing title publishes width 140 cm. Depth and height are planning estimates. | Reference ID 120686813 |
| Mert Sert Tarab TV Stand — Walnut | #4 | 140 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2092150169 |
| Kenzlife Tokyo TV Stand | #5 | 140 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 672035847 |
| Decoraktiv Trendstyle 5220s TV Stand — Natural Walnut | #6 | 180 × 35 × 45 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2089188559 |

## Bedside tables (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Aeka AE-2022 London Two-Drawer Bedside Table — White | #1 | 45 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 747347649 |
| Aeka AE-2029 Inci Two-Drawer Bedside Table — Pearl White | #2 | 49 × 35 × 50 | Estimated. Title gives 49 cm without an axis. Complete planning dimensions are estimated. | Reference ID 2243627713 |
| Metalia GM027 One-Drawer Bedside Table — Walnut / Anthracite | #3 | 45 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 700407380 |
| Adore Country Two-Drawer Bedside Table — Matt White | #4 | 51 × 40 × 53 | Estimated. Title gives 51 × 53 × 40 cm without labels; W 51 × D 40 × H 53 cm is an estimated interpretation. | Reference ID 2576169586 |
| Rabi Izel Country Bedside Table | #5 | 45 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 686107297 |
| Rabi Rumy-S1 Country Bedside Table | #6 | 45 × 35 × 50 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2089465676 |

## Shoe storage (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| KZY Four-Compartment Shoe Cabinet — White | #1 | 60 × 24 × 145 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 155638404 |
| Retodesign Open Shoe Rack | #2 | 65 × 30 × 90 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 677222386 |
| IKEA TRONES Wall Shoe Cabinet — White | #3 | 52 × 18 × 39 | Listed. The product listing supplies labelled product width, depth and height; converted to centimetres. | Reference ID 84595046 |
| Minar Drago Shoe Storage Bench — White | #4 | 90 × 35 × 45 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 322079372 |
| Bofigo Ceren Two-Door Shoe Cabinet — White | #5 | 60 × 30 × 100 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2403096804 |
| Moonlife Three-Door Shoe Cabinet — Walnut | #6 | 60 × 30 × 100 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2144159833 |

## Sideboards (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Variant Kiev Sideboard — Walnut / Cream | #1 | 180 × 40 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2360973753 |
| Mezza 1614 Elite Sideboard — White, 180 cm | #2 | 180 × 40 × 80 | Estimated. Title lists width 180 cm; depth and height are planning estimates. | Reference ID 716455305 |
| Aydinev Marsilya Sideboard | #6 | 180 × 40 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2231080551 |
| Aydinev Bahar Sideboard | #10 | 180 × 40 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2231080561 |
| Adore Milano Three-Door Two-Drawer Sideboard — Taupe / Zebrawood | #11 | 210 × 44 × 80 | Estimated. Title gives 210 × 80 × 44 cm; width/depth/height assignment is estimated pending labelled manufacturer dimensions. | Reference ID 2576171246 |
| Aydinev Askar Sideboard | #12 | 180 × 40 × 80 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2231080563 |

## Dining chairs (5)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Evdemo Elma Dining Chair — Brown | #2 | 48 × 55 × 88 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2444190412 |
| Evdemo Elma Dining Chair — Cream | #3 | 48 × 55 × 88 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2444190415 |
| Canisa Bika Upholstered Dining Chair — Cream / Black Legs | #9 | 48 × 55 × 88 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2225742108 |
| Canisa Bika Upholstered Dining Chair — Grey / Black Legs | #11 | 48 × 55 × 88 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2225742113 |
| Canisa Krax Upholstered Dining Chair — Black / Gold Legs | #14 | 48 × 55 × 88 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2230169728 |

## Floor lamps (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Apliqa Helezon Spiral Floor Lamp — Aged Brass / White Shade | #1 | 45 × 45 × 160 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2225693697 |
| Apliqa Liona Arc Floor Lamp — Aged Brass | #2 | 70 × 40 × 175 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2553797835 |
| Apliqa Modrica Arc Floor Lamp — Nickel | #3 | 70 × 40 × 175 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 2578247816 |
| Homing AYD-3131 Pi Wooden Floor Lamp — Taupe Shade | #4 | 45 × 45 × 160 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 1294661690 |
| Lumexx Tripod Floor Lamp with Shelf — Walnut / Mustard Shade | #5 | 45 × 45 × 160 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 348012422 |
| Apliqa Klara Floor Lamp — Black | #6 | 45 × 45 × 160 | Estimated. Planning width, depth and height are estimates; adjust to the exact product before checking clearances. | Reference ID 515210825 |

## Washing machines (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Altus AL CM 71045R Washing Machine | #1 | 60 × 60 × 85 | Estimated. The product listing has no labelled dimensions for this model; cabinet extents are planning estimates. | Reference ID 2570456173 |
| Bosch WGA242X3TR Washing Machine | #2 | 59.8 × 58.8 × 84.8 | Listed. The product listing supplies labelled product width, depth and height; converted to centimetres. | Reference ID 2499665783 |
| Arcelik 10121 Washing Machine | #3 | 60 × 60 × 85 | Estimated. The product listing has no labelled dimensions for this model; cabinet extents are planning estimates. | Reference ID 2580356604 |
| Profilo CGA242X3TR Washing Machine | #4 | 59.7 × 58.8 × 84.5 | Listed. The product listing supplies labelled product width, depth and height; converted to centimetres. | Reference ID 2501696410 |
| Bosch WGA25203TR Washing Machine | #5 | 60 × 60 × 85 | Estimated. The product listing has no labelled dimensions for this model; cabinet extents are planning estimates. | Reference ID 2580352920 |
| Altus AL CM 81050 Washing Machine | #6 | 60 × 54.6 × 84.5 | Listed. The product listing supplies labelled product width, depth and height; converted to centimetres. | Reference ID 2492345071 |

## Beds (6)

| English product label | Category rank on 2026-10-16 | W × D × H (cm) | Dimension status and notes | Source references |
| --- | --- | --- | --- | --- |
| Argimo Kamelya Metal Daybed with Trundle — Black, 90 × 200 cm | #1 | 98 × 208 × 90 | Estimated. Published mattress size 90 × 200 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 2503594608 |
| Niron XL Folding Guest Bed — 90 × 200 cm | #3 | 98 × 208 × 45 | Estimated. Published mattress size 90 × 200 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 495626775 |
| Metalia GM 305 Double Bed Frame — Walnut / Black, 160 × 200 cm | #4 | 168 × 208 × 90 | Estimated. Published mattress size 160 × 200 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 2216361840 |
| Metalia Gozde Single Bed Frame — Black, 90 × 190 cm | #5 | 98 × 198 × 90 | Estimated. Published mattress size 90 × 190 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 1757105824 |
| Metalia Gozde Single Bed Frame — White, 90 × 190 cm | #6 | 98 × 198 × 90 | Estimated. Published mattress size 90 × 190 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 1757105882 |
| Iron Folding Guest Bed — 80 × 190 cm | #7 | 88 × 198 × 45 | Estimated. Published mattress size 80 × 190 cm; outside frame footprint and overall height are planning estimates. Shown in the open/use position. | Reference ID 2179989427 |
