# Cabinet layout editor

Select a cabinet and choose **Edit layout**. The cabinet opens in an isolated view with its doors open. The house remains unchanged and cannot receive pointer or keyboard edits. **Done** commits the layout as one undoable house edit; **Cancel layout** discards the draft. Layout Undo/Redo and Ctrl/Cmd+Z work within the draft. The previous house camera and door angles are retained.

The same application and layout editor run on desktop, iPad and in exported offline HTML. No model service, physics server or additional model downloads are needed. The catalogue includes seven rectangular modular cabinet starting points and five adjustable fit objects: a toilet-paper roll, detergent bottle, spray bottle, bucket and mop. Existing one-/two-door wardrobes, kitchen cabinets, open shelving and compatible catalogue bookcases can also be configured.

## Layout editing

Add shelves and dividers, then select them in the scene or parts list. Reuse the normal object inspector to enter exact positions, dimensions and finishes. Drag a shelf's Y handle or a divider's X handle to move it continuously; shelves do not snap. Readouts give the clear height above/below a shelf, accounting for board thickness and overlapping spans.

Shelf width is linked to its start/end surfaces: cabinet sides, divider faces or fixed coordinates. A divider likewise connects to the base, top, shelf faces or fixed heights. Its X position is independent of its vertical span. Select **Split divider at shelves** to make individually selectable segments, then delete any segment. Connected shelves retain their references to the surviving segments. This supports an open full-width bottom area connected to a tall side slot and several short shelves on the other side.

Depth can follow the usable cabinet depth with a front setback, or remain fixed. Carcass and door panels default to 18 mm; back panels default to 6 mm and have their own thickness control. Both thicknesses are editable. Door count is explicitly zero, one or two. A single door can hinge on either side.

Each door also has its own hinge controls in the room inspector and layout editor: **Fixed pivot**, or concealed hinges with **straight**, **half-cranked** or **fully cranked** arms. Selecting a concealed hinge starts with **20 mm clearance travel**, adjustable from 0–50 mm. Existing saved cabinets without hinge settings retain their fixed-pivot motion.

Concealed doors move inward from the hinged edge and outward from the cabinet front as they rotate. Travel rises smoothly from zero when closed to the configured amount at 90°, then stays at that amount for larger angles. Closed door positions, carcass geometry and interior dimensions stay the same. Both sides mirror correctly, and the two doors can use different hardware/travel. Arm styles describe the selected hardware; they share the same adjustable planning path because crank type alone does not determine a manufacturer's linkage motion. Use the hinge's actual clearance dimensions when planning a flush neighbouring enclosure. Opening farther than 90° can still extend a leaf beyond the cabinet side and show a collision.

## Coordinates, placement gravity and resizing

The interior origin is inside left/base/back, excluding the carcass and back thickness. A stored object's position is its left-bottom-back bounding corner relative to its support's left/top/back. Height zero therefore means resting on the support. Objects move with their shelf and retain their own physical dimensions and offsets. Rotation uses the rotated footprint when resolving that corner.

Adding or deliberately moving an object settles it onto the highest shelf below its footprint centre, or onto the cabinet base. Loading, resizing and deleting boards never run gravity. Deleting a shelf detaches its contents while preserving their positions. Unsupported contents remain available for correction.

Outside cabinet resizing refits connected panel spans and depth setbacks, preserves shelf heights and preserves content dimensions/offsets. A shelf above a newly lowered top is retained. Restoring the original size restores the intended span. Crossing boundaries or too-small interiors produce invalid parts rather than deleting anything or rewriting its connections. Re-enter layout mode to see the problems.

## Collision feedback

Collision checks run only in cabinet layout mode or while opening/closing a room/cabinet door. Ordinary furniture translation, rotation and overlap remain unrestricted. Checks are informational and never block editing.

Inside layout mode, penetrating boards/contents, parts outside the usable interior, and unsupported objects turn red. Surface contact within a 0.5 mm numerical tolerance is allowed. Contents use upright oriented planning boxes; they are fit/clearance checks rather than detailed mesh physics. Supports are the cabinet base and horizontal shelves.

Door controls work independently outside layout mode and include touch-friendly Open/Close buttons. Swing checks sample the traversed angles at intervals of at most two degrees and show the moving door red when it intersects an obstacle. Cabinet checks follow the same translating hinge path used to render the door, in both opening and closing directions. Changing a hinge or its travel rechecks the opening path at the current angle. Room doors retain their fixed hinge axes. Door checking uses oriented mesh bounds, with triangle checks for walls so actual doorway openings are respected. Materials are temporarily replaced for feedback and original finishes are restored afterwards.

Layouts, content identities, dimensions, support attachments, finishes, independent door angles and hinge settings are included in canonical plans, legacy plans and standalone editor exports. There is no destructive cleanup of invalid layouts when saving.
