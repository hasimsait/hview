# Focused room and material study

[Open the four photorealistic combinations with complete palettes](realistic-concepts/index.html).

[Open the controlled HView comparison gallery](index.html).

This supersedes the ten-room first pass. Only the **salon, living/work room and master bedroom** are in scope. The images are rendered directly in HView so door, mirror and object positions follow the actual plan. Kitchen, bathroom, WC, shower, small bedroom, dining area and hall are not being redesigned.

## Repairs in the included plan and editor

- The living/work room's two sofa modules are replaced by one left-chaise L-shaped sofa. Its overall footprint follows their combined envelope. It has only two outside arms, with no arm at the join. The catalogue also offers the mirrored right-chaise asset.
- All six windows, including the French window, have two side-hung uPVC sashes, outer hinges, handles by a fixed centre mullion and separate clear panes. They are shown closed. Existing wall openings, dimensions, sill heights and positions are unchanged.
- The salon's three 80 cm BILLY cases plus one added 40 cm case, all with matching extensions, use **walnut bodies, shelves and backs, with black BILLY doors/frames and knobs**, following the latest choice. The narrow case sits at the free end beside the short wall return, giving a 280 cm run. The complete row and its extensions are shifted 22 mm towards that end to centre the available side clearance. The room door is shown at 90° instead of 180° to clear the end case; its frame, hinge and position are unchanged. Glass stays clear. Black Oak Effect is a dedicated non-metallic BILLY finish, separate from generic wenge and metal black. Body and door finish remain independently selectable.

[Clearance check](clearance-check.json) verifies the actual cabinet, door and knob meshes against walls, columns, skirting and the room door at its saved angle, with no intersections.

[Plan change report](plan-changes.json) lists the only saved element changes. Every other element is unchanged from the uploaded plan. Suggested colours are render-session overrides and are not saved to the working plan.

## Choices to compare

| Decision | Alternatives |
| --- | --- |
| Salon sofa fabric | Existing burgundy/champagne; olive/oat; tobacco/flax; petrol/warm stone |
| BILLY body / doors | Walnut/black selected baseline; oak/black; oak/oak; white/oak |
| Master accent wall | Existing muted terracotta; muted olive; clay brown; warm mushroom |
| Curtains | Room-specific alternatives in blue, olive, flax, stone, oat and petrol |
| Both work desks | Current birch; natural oak; American walnut; warm white |

Bedding and sofa pillows are styling props. Neutral bedding in these views keeps attention on the fixed joinery and proposed wall paint. The master bedroom's fitted curtains are shown temporarily in curtain comparisons; the saved hidden state is preserved. Unbranded colour alternatives are planning references, not manufacturer paint matches.

## Fixed constraints

- Salon walls: **Jotun 1876, exact base colour `#D4CBB9`**.
- All wall geometry and actual door/mirror positions.
- Socket, AC and light-fixture positions. Bathroom spotlight heights may be corrected later.
- Master bedroom and hall cabinet handles remain brass.
- Water heater placement.
- For future kitchen work: existing geometry and mermerit cast-marble counter; white dishwasher and fridge; black oven, black glass **induction** hob and black range hood. Previous gas-hob interpretations are superseded.
- Bathroom tiles, shower enclosure and cabinetry. Only decoration may change later; wet rooms are currently excluded.
- Uploaded washer positions remain preserved and flagged in the [original audit](../2026-10-30/README.md#flagged-plan-anomalies--preserved-at-the-users-request).

## Capture settings

Baseline views use two opposite corners at **6500 K and 2700 K** in each of the three rooms. Colour comparisons use one fixed view per decision at both temperatures. The BILLY close-up temporarily closes the room door so all four cases remain visible; the saved plan and baseline views retain its 90° pose. Foreground is solid, ceilings and sockets are visible, walls remain full-height and daylight is off.

The same exposure is retained within each room. Comparison-only fixture output uses saved lumens, or 806 lm where absent, with enabled fixtures at full output. A modest 0.75 indirect-fill proxy and 55% viewing adaptation are applied consistently. No lighting code or saved fixture settings change. Exact cameras, finish values, exposure and verification results are in [manifest.json](manifest.json).

The labelled hex swatches are the base-colour references. Rendered pixels vary with light and viewing adaptation; CCT alone cannot predict a specific real paint/fabric under an unmeasured LED spectrum. BILLY and desk grain use the editor's bundled photographic wood textures. Alternative upholstery uses neutral bump-only weave so a coloured photograph does not distort the selected colour. The capture background is neutral near-black, so an open doorway into hidden adjacent rooms does not appear to be a blue door. No AI geometry reconstruction is used in this study.

## Reproduction

```sh
npm run build:sample-editor
node scripts/capture_focus_review.cjs
XDG_CACHE_HOME=/workspace/hview/work/fontcache node scripts/build_focus_review.cjs
```

`--preview` captures neutral-light camera checks. `--only=baseline` or `--only=<decision-id>` updates a subset only when the source-plan hash matches the existing manifest.

## Photorealistic proposals

The [four coordinated concepts](realistic-concepts/index.html) add image-generated material realism and decoration to the HView references. Each shows all three rooms at 6500 K and 2700 K. The downloaded images have a labelled footer mapping every main wall, upholstery, curtain, desk, chair, wardrobe and BILLY finish to its selected base hex value. Bedroom curtains are one-sided, on the wardrobe side. These proposals do not change the saved plan.
