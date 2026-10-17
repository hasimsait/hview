# Adding and resizing windows

Select a wall and use **Windows → Add window**. A new window starts in the largest free horizontal span at its default sill elevation, with ceiling-mounted curtains. The editor selects and focuses it. The wall's window list also selects existing windows, even when their curtains make picking the glass difficult.

In the window inspector, edit width, height, sill height and **Left edge from wall start** in centimetres, then select **Apply window dimensions**. Measurements follow the host wall from p1 towards p2, including angled walls. Width changes preserve the entered left edge; height changes preserve the sill. The four draft values apply together as one undoable edit. Invalid or empty values leave the plan untouched and show an inline error. Imported sizes remain unchanged until explicitly edited.

Windows must fit within their host wall. Editing never moves another opening or rearranges furniture. The wall cut, frame, sill, glazing, curtain track and window dressing rebuild for the new geometry. Glazing finishes, frame colour, curtain state and window dressing choices survive edits. French windows use the same dimension controls.

**Delete window** removes the opening and its curtains and fills the wall cut; undo restores them. **Edit host wall** returns to the wall inspector. Add, edit, delete, undo/redo and both plan formats work in the full offline editor on desktop and iPad.
