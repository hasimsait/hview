# Kitchen worktops and cabinet appearance

**Kitchen Worktop** is an independent asset in the Kitchen category, searchable as counter, countertop or worktop. Its default slab is 240 × 62 cm and 4 cm thick, with its underside at 85 cm. Width, height/thickness, depth, elevation and rotation use the normal object inspector. It accepts stone, tile, wood and other surface finishes. It remains independent of cabinet layouts and can span multiple cabinets. Existing attached worktops can be hidden through their Countertop finish when using a separate slab.

Opening a legacy kitchen cabinet door or entering Edit layout creates a modular carcass. That renderer retains the base module's original worktop, dimensions, overhang, elevation and Countertop finish. Upper wall cabinets do not acquire a worktop. Legacy Cabinet/Body finishes remain the fallback for new frame, back, shelves, dividers and door sections. Explicit section and panel finishes take precedence; handles, worktops and stored objects keep their own finishes.

This is a rendering fix. Existing saved layouts, finishes, positions and dimensions do not require a destructive migration. Cabinet interiors are not rebuilt from defaults when an edited layout is already present.
