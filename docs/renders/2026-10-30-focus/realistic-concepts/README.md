# Four photorealistic room combinations

[Open the image gallery](index.html).

These are image-generated interior proposals based on the current HView plan, replacing the earlier material-only comparison as the main design presentation. Each board contains the salon, living/work room and master bedroom at 6500 K and 2700 K. Their source layout is the six-view [geometry reference](geometry-reference.png).

The four complete combinations include sofa fabric, independent BILLY body/door finishes, bedroom accent paint, curtains, work-desk finishes and restrained decorations. All four preserve the salon's Jotun 1876 base paint `#D4CBB9`, existing room geometry, furniture footprints, fixture/socket/AC positions and the master bedroom's cream joinery and brass handles. BILLY retains three 80 cm cases plus one 40 cm case with matching extensions and clear glass.

The master bedroom has **only one curtain panel, on the wardrobe side of the window**. The left panel is removed in these proposals. Bedding and sofa pillows are styling props. Kitchen and wet rooms are excluded.

| Concept | Salon upholstery / curtains | BILLY body / doors | Bedroom accent / single curtain | Work desk tops / curtains |
| --- | --- | --- | --- | --- |
| 1 · Burgundy and Flax | Wine/champagne fabric; flax curtain | Walnut / walnut | Muted terracotta; flax | Natural oak; oat |
| 2 · Olive and Oat | Olive/oat fabric; flax curtain | Oak / black oak effect | Muted olive; warm stone | Bleached birch; oat |
| 3 · Tobacco and Stone | Tobacco/flax fabric; blue-grey curtain | White / walnut | Warm mushroom; slate-blue | American walnut; oat |
| 4 · Petrol and Clay | Petrol/stone fabric; warm stone curtain | Walnut / black oak effect | Soft clay; petrol | Warm white; petrol |

My first choice is **2 · Olive and Oat**: the light oak BILLY body and black door frames retain contrast beside the dark wood furniture without adding as much brown as the walnut body. **1 · Burgundy and Flax** is the reference choice if retaining the current burgundy upholstery is preferable. The boards make these whole-room combinations visible rather than asking the user to mentally combine separate swatches.

Each downloadable `--palette.jpg` attaches a complete, object-labelled colour legend below its photographs: room walls, upholstery, wood arms, curtains, desks, chairs, wardrobes, brass hardware and BILLY body/doors. Exact planning colour values are in [concepts.json](concepts.json). Prompts and the [reference manifest](reference-manifest.json) record the source material. The rendered images are visual proposals, not measured lamp/paint simulations or replacements for the plan's clearance checks. The saved working plan has not been changed by these proposals.

Rebuild palette exports and the portable image gallery ZIP with `XDG_CACHE_HOME=/workspace/hview/work/fontcache node scripts/build_realistic_concepts.cjs --package`. The original generated room scenes remain separate PNGs.
