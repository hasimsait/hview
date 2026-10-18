# Wall surfaces and framing

Select a wall. **Wall Faces** edits Side A, Side B or both. **Ends, Edges & Sills** separates the start/end caps, wall top edge, window sills, and opening returns. Window sills have their own material group and no longer inherit an edit to the wall top edge.

Under **Wall Framing**, select **Skirting board (bottom)** to enable or remove skirting and choose its finish. Applying the first skirting finish creates the geometry immediately; later colour changes keep that geometry. Boards stop at floor-level door openings. Undo, save/reload and offline exports retain the selection and finish.

Select **Top corner / cornice** for a full-wall ceiling profile: plain square, classic cove, stepped or ogee. Choose None to remove it. Set height, projection, clearance from the wall, visible state and the wall sides to frame. Room-facing sides follow their respective finished ceiling heights. Clearance can leave room for curtain tracks behind the cornice; the original curtain-concealing profile uses a 17 cm clearance and 12 × 12 cm section. A cornice without curtains can sit flush against the wall.

Adjoining cornices with the same profile, section height and finished ceiling elevation meet at a mitred seam. Cuts follow the actual wall angle, thickness, projection and clearance, including inside/outside corners and unequal clearances. Straight continuations share a square seam. Editing or removing a run updates its neighbours, including through undo and offline export. Different profiles or ceiling levels remain separately capped; impossible cuts that would invert a short run are not applied.

Existing window cornices consolidate onto their host wall on load. Multiple windows create one continuous cornice per wall side; visible/hidden/removed states migrate, with a visible window taking precedence over hidden/removed ones. Window inspectors link to the wall control. Window curtains remain independently editable. Old per-window cornice fields are removed from subsequent exports. Standalone catalogue cornice objects retain their dimensions for custom placement.
