# Confirmed product bugs

These tests assert the intended behavior and currently fail. They remain enabled
and make the runners return a nonzero exit status until the application is fixed.
Application source has not been modified as part of this test expansion.

## 1. Asset replacement is lost on reload

Reproduction: select a sofa, choose **Replace Asset**, select **Dining Chair**,
wait for autosave, and reload. The sofa returns.

The saved JSON contains `assetKey: "chair"` but retains `name: "sofa"`.
`PlanParserService` resolves the model from `name`, restoring `sofa_triple`.
This is reproduced with the real asset registry and with browser UI actions.

Tests: `known-bugs.test.ts` (replacement round trip),
`workflows.spec.ts` (replacement through the UI).

## 2. Offline save reports success after losing the write

Reproduction: use the standalone editor offline with browser storage full or
unavailable, then edit and save. Local storage throws and the server request
fails, but `savePlan` returns `true` and the status becomes `saved`.
The previous cached plan is unchanged, so reloading cannot restore the new edit.

The regression injects an actual `QuotaExceededError`, fails the network request,
verifies that the old cached plan remains, and asserts that saving must fail.

Test: `plan-persistence.test.ts`, “does not report an offline save as successful
when storage is full”.

## 3. Export controls fall outside common desktop viewports

Reproduction: open the editor at 1440px width. The header does not wrap or provide
a usable responsive overflow layout, while the page clips overflow. The
`Export .plan` button's right edge is approximately 1574px, beyond the viewport;
the standalone export controls are farther to the right.

Test: `workflows.spec.ts`, “export controls are reachable on a 1440px desktop
viewport”.

## 4. An older save clears the dirty flag for newer edits

Reproduction: start saving edit A, make edit B while A is in flight, then let A
complete. The JSON passed to persistence contains A, but
`hasUnsavedChanges()` returns `false` for the plan containing B.

The regression controls promise completion without timing guesses. A later
debounced save may recover B if it succeeds; this test establishes incorrect
dirty-state tracking, not that every overlapping edit is lost.

Test: `known-bugs.test.ts`, “keeps later edits dirty when an earlier in-flight save
completes”.

## 5. Standalone editor cannot re-export standalone HTML offline

Reproduction: download **Full Editor (.html)**, open it without network access,
then click **Full Editor (.html)** again. Instead of a download, it displays
“Unable to load editor template. Please ensure the template file is generated.”

The bundled export service still fetches `/hview_editor_template.html`; the
template is not available inside the standalone document. The same dependency
exists for the viewer export path. The browser regression proves the editor path
by loading the actual downloaded bundle and blocking all service requests.
Offline editing, reload, and `.plan` export pass independently.

Tests: `workflows.spec.ts`, “offline editor can re-export Full Editor (.html)
without fetching a template” and the equivalent iPad Viewer export case. Each
requires an actual HTML download with valid embedded plan data.

## 6. Selected paint swatch stays stale until the surface is reselected

Reproduction: select a wall surface painted Chantilly Lace and choose White Dove.
The scene and saved plan change to White Dove, but the picker still highlights
Chantilly Lace. Close the inspector and select the same wall again; the picker
then highlights White Dove.

The browser regression confirms the saved color and the reselection workaround,
then asserts that the active background must have changed before unfocusing.
The service regression also shows that changing the selected wall's paint emits
no selected-wall update to its subscribers.

Tests: `reported-bugs.spec.ts` (paint highlight),
`reported-surface-room.test.ts` (selected-wall notification).

## 7. Bathroom isolation includes a hallway-to-bedroom door

Reproduction: isolate Bathroom (4.2 m²), ID `_rscdq`, in the working plan. Door
`_87omj` on wall `_tmb2o` remains visible, although it is outside the bathroom.
The bathroom's actual entry door is `_buz1m` on wall `_ojjeh`.

Isolation currently filters openings by whether their entire parent wall borders
the selected room. The long `_tmb2o` wall borders several rooms; its hallway door
should not become visible merely because another segment borders the bathroom.
The browser regression uses those actual wall, room, and door coordinates with
unrelated scene elements removed. It checks the visible opening IDs, retains the
correct bathroom entrance, and verifies that isolation does not write a new plan.
Unit checks additionally cover retaining the correct entrance and Show All.

Tests: `reported-bugs.spec.ts` (Bathroom isolation),
`reported-surface-room.test.ts` (opening visibility).
