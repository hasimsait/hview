# Editor guide

Save/export behavior and setup are in the [README](../README.md). Cabinet interiors have a separate [layout guide](cabinet-editor.md).

## Catalogue and placement

Use **Add Asset** to search by name, model or article code, then narrow by category, source or collection. **Show more assets** expands the visible results; search includes the whole catalogue. Select an object to edit its position, rotation, dimensions and individual finish sections.

**Duplicate Asset** is near the top of the object inspector. It selects an independent copy with the same dimensions, rotation, finishes, light settings and cabinet contents, shifted 15 cm sideways for placement. Undo removes the copy. Inside the cabinet editor, Duplicate Asset also copies a selected stored object with its support attachment intact.

Search **BILLY / OXBERG** for the panel/glass-door bookcase in White, Walnut Effect or Oak Effect. Its nominal case is 80 × 30 × 202 cm, with two 192 cm doors above a recessed 10 cm plinth; knobs project 24 mm beyond the nominal front. Doors open through the existing hinge controls, and shelves/contents remain editable. Upper glazing retains its transparency when the whole bookcase is recoloured. The **BILLY** finish options have separate identifiers from generic hardwoods and are also available in the wood finish picker. Wood-effect tones are visually matched to the supplied photos using bundled photographic veneer grain; they are planning references rather than product texture scans.

The same search also offers **Full Glass-Door Bookcase** versions in all three finishes. **BILLY doors** in the inspector switches between panel/glass and full glass while retaining shelves, contents, finishes and opening angles. Full glass uses framed clear panes above and below the central rail.

Search **BILLY Height Extension** or **BILLY / OXBERG Height Extension** for the open 80 × 28 × 35 cm or glass-door 80 × 30 × 35 cm unit. Both have an open bottom, no plinth and no internal shelf: the original bookcase top provides their base. Select a BILLY bookcase and use **Add open extension** or **Add glass extension** to place one directly above it, aligned at the back and matching its width, rotation, room and finishes. A standard 202 cm bookcase becomes 237 cm tall. The extension remains an independent object; move or duplicate both parts when rearranging the complete unit. Extension glass doors open separately. Catalogue placement starts at 202 cm elevation when adding an extension by itself. Dimensions reference [IKEA's BILLY extension](https://www.ikea.com/gb/en/p/billy-height-extension-unit-white-40263853/) and [OXBERG glass doors](https://www.ikea.com/gb/en/p/oxberg-glass-door-white-90275617/), with the existing nominal door-height convention preserved.

Dimensions describe the outside planning envelope. Floor, wall, ceiling and surface objects start at their catalogue placement height; adjust elevation for the actual room or support. Independent catalogue objects do not automatically attach to furniture, fit an opening or follow later wall edits. Pipes, hoses and cables are visual route envelopes, without automatic connections or routing.

Electrical fittings use the **Sockets** visibility toggle. Bubble fittings keep their circular 10 cm face; frame and insert finishes remain independent. Rugs, bedding, curtains, practical fittings and architectural trim use the same selection and finish controls. Source dimensions and estimates are described in [Catalogue references](catalogue-sources.md).

## Kitchen worktops and finishes

**Kitchen Worktop** is an independent slab in Kitchen, searchable as counter, countertop or worktop. It can span several cabinets. Edit height for thickness and elevation for its underside; hide an attached cabinet worktop through its Countertop finish when substituting a separate slab.

Cabinet, Countertop, handles and stored-object finishes are independent. **Edit layout** retains the cabinet's existing worktop and finishes; upper cabinets do not acquire a worktop. Kitchen base cabinets have an optional plinth, initially 10 cm when enabled.

Select a surface section before choosing paint, wood, tile, glass or another material. Higher signed **Surface layer** values resolve overlapping finishes. Wood grain controls offer horizontal/vertical orientation. The kitchen laminate and striped mosaic are visual reconstructions from photographs, not calibrated manufacturer samples.

**Wood & Parquet → Wood, Veneers & Laminates** includes American Walnut, Smoked Walnut and near-black Dark Wenge with distinct dark base tones and photographic grain. **Deep Chocolate Walnut**, **Espresso Walnut** and **Black-Brown Wood** add warmer and deeper browns. Picker previews use the same final texture as the scene. These dark wood tones are matched once in their textures; the existing oak, teak, birch, ash, laminate, parquet, BILLY and acoustic-panel tones are preserved. Existing saved wood selections receive the corrected appearance without changing the plan's finish data. **Compare surface colors** in Lighting shows the base tone without illumination or exposure changes; normal room lighting still affects the rendered result.

## Walls, windows and curtains

Select a wall. **Wall Faces** controls Side A and Side B; **Ends, Edges & Sills** controls caps, top edges, sills and opening returns separately. **Wall Framing** controls skirting and wall-to-wall cornices, including profile, dimensions, clearance, finish, visibility and which sides are framed. Select None to remove a cornice. Compatible neighboring cornices meet at their corners and follow the adjoining rooms' finished ceiling heights.

To add a window, use the wall's **Windows → Add window** control. Select the window to edit width, height, sill height and **Left edge from wall start** in centimetres, then choose **Apply window dimensions**. The left-edge measurement follows the wall from its start point towards its end. Changes apply together as one undoable edit and must fit the host wall. **Delete window** also removes its curtains; undo restores them.

Under **Window dressing**, choose pleated, sheer, blackout, layered, roller, Roman or Venetian styles. Curtains fit the window width and finished room height; blinds fit the opening. Use **Open curtains** or **Raise blind** for the opening amount. Layered curtains have independent outer/sheers colors, and opening moves the outer layer. Hide/remove and restore controls preserve dressing settings; changing style does not restore a hidden dressing.

Window **Cornice sides** controls the same wall cornice as Wall Framing. Standalone catalogue curtains, blinds and trims remain independent objects: hide the fitted treatment when placing a custom one over it.

## Ceilings and balcony railings

Select a room floor to edit **Finished ceiling height (m)**. The value sets the underside independently of structural walls and the shared maximum. Clip-in ceilings default to a 15 cm drop; smooth ceilings retain room height until lowered. **Reset ceiling height** restores the finish default. The global **Ceilings** button controls visibility independently of saved settings.

Window-fitted curtains, tracks and wall cornices follow ceiling-height edits. Newly placed ceiling accessories use the room's finished height; existing independent objects retain their edited elevations.

For a balcony, select its floor and choose **Add railing to open edges**. Use the numbered edge map to enable individual runs, set height/color or remove the railing. Railings follow open room-polygon edges and existing wall faces; doors/windows in a wall do not create an open railing edge.

## Lighting and floor drains

Lighting assets include visible fittings and actual room illumination. **Fixture Lighting**, brightness and color controls affect the light and its diffuser. Chandelier/spotlight group sliders scale fixtures of that type. Ceiling coves can be inspected with ceilings visible. Cabinet-mounted lights use the controls described in the [cabinet guide](cabinet-editor.md#cabinet-lighting).

Night mode removes sunlight, sky, environment and artificial ambient fill. Each fixture illuminates only the room containing it. Open doors and windows do not transfer fixture light between rooms. This uses cached room footprints; there are no per-pixel wall intersections, door shadow calculations or extra fixture shadow passes. Touch devices retain at most four contributing fixture sources near the camera.

Night exposure defaults to a fixed 100 lux reference: an 18% diffuse grey under 100 lux maps to 18% linear display grey before tone mapping. Exposure does not rise when lamps dim or switch off. Explicit Exposure adjustments remain available; **Reset color controls** restores the default for the current day/night mode. Daylight's legacy fill uses relative units and retains its original default exposure.

**White light preview** overrides every fixture's temperature. The fixture inspector displays an active override and provides **Use fixture temperatures** to remove it. Set the fixture or preview explicitly to 3500 K to assess that temperature. Viewing white balance and adaptation are separate from lamp output. Colour temperature alone does not specify an LED's spectrum, and bundled paint RGB values are digital references, so the renderer cannot guarantee a physical paint match under a particular LED.

**Compare surface colors** bypasses room lighting and displays a persistent viewport banner. Changes to global lighting or a fixture's controls return to room lighting. Use comparison mode to inspect base colours, then return to lighting to assess the room. `npm run test:lighting:browser` checks Kumru and Günbatımı at 3500 K, fixture isolation between rooms even through open doors, and black unlit surfaces with fixed exposure.

Drain covers sit at floor level. Tile-insert drains have a separate insert finish and drainage gap; they do not cut a floor opening or add concealed plumbing.
