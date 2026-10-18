# Lighting components and floor drains

## Catalogue

The **Lighting** category includes all existing catalogue lamps as well as 14 new generic fittings:

- Round and square recessed LED downlights.
- Single and twin surface cylinder spotlights.
- Straight three-head and L-shaped five-head ceiling tracks.
- Dome, opal globe and linear dining pendants.
- Up-and-down wall lights and opal wall sconces.
- Under-cabinet LED bars and segmented LED strips.
- Concealed ceiling cove channels with LED strips.

Each fitting includes editable visible geometry and actual room lights. Downlights, spotlights and track heads cast soft-edged cones; opal fittings illuminate their surroundings; task and dining bars use distributed sources. Cove channels use a continuous rectangular area emitter across a 4 cm ceiling gap. Turn **Ceilings: ON** to inspect the ceiling wash. Position cabinet lighting underneath the actual cabinet run using the elevation control.

Existing ring and cascading chandeliers now have stronger room-light output rather than just bright-looking bulbs. Their original asset identities and saved controls are retained. The normal **Fixture Lighting** on/off, brightness and colour controls affect both room illumination and the visible glow. Pendants also follow the chandelier group intensity control, including their diffusers; directional and task fixtures follow the spotlight group control.

On touch devices, four active light sources are retained in both daylight and night views, selected by their estimated contribution near the camera. This replaces disabling all fixture output in daylight. The budget follows the camera during house tours; hidden or disabled fittings do not consume it. Desktop rendering keeps all enabled sources. Fixture shadows are not enabled, so this remains an interactive planning preview rather than a photometric simulation.

**Bathroom & Accessories → Floor drains** adds five generic drain covers:

| Cover | Default W × D × H (cm) |
| --- | --- |
| Square stainless steel | 10 × 10 × 0.6 |
| Round stainless steel | 10 × 10 × 0.6 |
| Linear stainless steel | 80 × 7 × 0.6 |
| Linear matte black | 80 × 7 × 0.6 |
| Tile-insert linear | 80 × 8 × 0.6 |

Grates have open slots over a dark inlet. The tile-insert version has an independently editable **tile_insert** section and a drainage gap around it. Drain covers sit at floor level; they do not cut the floor or include concealed plumbing.

Dimensions are editable planning references. Thin fittings and architectural finishes support 1 mm dimension increments. Positions, dimensions, finishes, lighting colours and enabled states persist in plan saves and offline HTML exports. All geometry and illumination work without retailer or network requests.

## Validation

Unit coverage checks all asset envelopes, beam directions, distributed emitters, drain apertures, material ownership and save/load behaviour. Browser checks exercise actual controls, thin drain resizing, offline export and rendered surface luminance with existing chandeliers, new downlights, track heads, cabinet bars and ceiling coves switched off and on, on desktop and touch devices. Mobile checks retain the four-source budget and GPU restoration workflow.
