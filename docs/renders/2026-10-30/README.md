# House review — 30 October 2026

[Open the comparison gallery](index.html).

Source: `hview_1793317965664.plan`, preserved byte for byte as [`public/sample.plan`](../../../public/sample.plan). SHA-256: `fc1b8c8a10f84aede4ecbe2ba24bb849981e1b318ac211a44c7cdd4710392964`.

The initial isometric request was changed by the user to wide-angle interior POVs. Every room has two opposite-corner views at 6500 K and 2700 K: **40 views per complete set**. Ceilings and sockets are visible, foreground is solid, full-height walls remain, and daylight is off. Camera coordinates and FOV are recorded per view. Captures exclude the editor controls.

## Image sets

- `originals/`: HView geometry and the uploaded finish assignments, with comparison lighting adjusted for visibility. Includes individual PNGs and four-view comparison boards.
- `corrected/`: the same geometry, cameras and room exposures, with the approved BILLY interpretation and partial warm-light white balance. Includes individual PNGs and comparison boards.
- `realistic/`: image-generated material studies based on the captured views. These interpret texture, glazing, fabric and indirect lighting while retaining the layout as closely as possible. The HView images remain the geometric reference.
- `concepts/`: optional decoration or alternative-palette proposals, separate from the original layout.

Read [design notes](design-notes.md) for two salon textile directions, two bedroom palette directions and room-specific suggestions. The salon proposals preserve Jotun 1876 `#D4CBB9`.

## Authoritative choices and placeholders

- **Salon walls:** Jotun 1876, selected base colour **`#D4CBB9`**. This supersedes stale values in legacy `rawWall` fields. Illumination can change displayed pixels; the underlying paint anchor is fixed.
- **BILLY, including extensions:** oak carcass/frame, shelves and backing; black BILLY wood-effect doors/door frames and knobs; clear glass. The saved walnut asset names, oak/white extension choices and black-metal preset are editor stand-ins. The corrected capture uses `billy_oak_effect` `#c0b099` for the body and non-metallic `#18181b` for door frames and knobs.
- **Paint on bedding, soft seating, towels and mats:** retain the selected colour, interpret the object as textile in the realistic study rather than a painted rigid object.
- **Paint on mirror surfaces:** interpret as a mirror in the realistic study, with reflections consistent with the room.
- **Clear/frosted glass presets:** interpret as transparent/translucent glazing rather than opaque blue panels. Retain actual dark framing.
- Kitchen cabinet sage, laminate grain, tile patterns, bedroom terracotta and green bedding, wardrobe finish and hardware remain anchored to the uploaded choices.

See [plan-audit.json](plan-audit.json) for object IDs, finishes and wall-side colours. This is extracted metadata, not a revised plan.

## Capture lighting

The saved lumen output is used where present; fixtures without a saved lumen value receive an **806 lm comparison reference**. Enabled fixtures use full comparison output. Disabled fixtures remain off. Fixtures above a lowered ceiling are temporarily lowered below it. The separate shower compartment has no light, so a temporary 806 lm ceiling fixture is used there. No fixture settings are written back to the source plan.

Exposure is chosen per room to keep surfaces visible and restrain highlight clipping, then held fixed for its two cameras and two temperatures. The source set uses no viewing-white adaptation. The corrected set uses 55% adaptation for the selected lamp temperature and a modest room-isolated indirect-light proxy, because HView does not simulate interreflection; this helps reveal the recessed shower tile cavity. These are rendering decisions, not measured predictions of the actual bulbs or paint spectra.

The manifests record all fixture adjustments, per-view camera coordinates, exposure, temperature and brightness statistics.

Each realistic board contains the same four requested view/temperature combinations. Kitchen and bedroom studies received a further object/material check: the cooktop remains a four-burner gas hob, actual caramel-ripple and mosaic textures are supplied as references, and the tall bedroom mirror is interpreted as a mirror rather than another door. Image generation can still vary fine details and reflections; it is not a replacement for the exact HView geometry.

## Flagged plan anomalies — preserved at the user's request

- Washer `5f47cf47-50fc-439b-9bcf-88ca7389adb9` is labelled Guest WC but positioned at `(-0.254, 0, 3.692)`, in the small-bedroom/desk area. Room-isolated HView captures follow its saved room assignment; the object falls outside the WC camera bounds.
- Washer `_vw5zq` is 170 cm tall and positioned at `(-2.0646, 0, 10.2089)`, beyond the main bathroom's back wall. It remains there and is outside the bathroom camera bounds. It is not silently moved into the room or converted into another appliance.
- The shower-system transport height is 374 cm; its procedural model and all source dimensions are preserved.

## Reproduction

```sh
npm run build:sample-editor
node scripts/capture_house_review.cjs
node scripts/capture_house_review.cjs --corrected
XDG_CACHE_HOME=/workspace/hview/work/fontcache node scripts/build_house_review_gallery.cjs
```

`--preview` writes camera checks under ignored `work/`; `--room=<slug>` recaptures one room and retains the other manifest entries. Image-generation prompts and their reference paths are recorded alongside the realistic studies when generated.
