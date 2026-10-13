# Confirmed product bugs

Unresolved regressions remain enabled and make the runners return a nonzero exit
status until fixed. Resolved issues are marked below; their tests remain enabled
to prevent regressions.

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

## 3. Fixed: header controls and finish categories overflow

The header and its control groups now wrap onto additional lines. Its height
grows with the controls, and the viewport and inspectors fit the remaining space.
Finish-picker category tabs also wrap, keeping each category label together.

Tests: `workflows.spec.ts`, “export controls wrap and remain reachable at desktop
widths” (1440px and 1024px) and “finish categories wrap within the inspector
without horizontal scrolling”.

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

## 6. Fixed: selected paint swatch stays stale

Previously, painting a selected wall updated the scene and saved plan but left
its highlighted swatch unchanged until the wall was reselected.

`setWallFinish` now emits the selected-wall notification with the updated wall
snapshot and current side, immediately refreshing the inspector and paint picker.
Choosing a face in the inspector also updates the selected side, so this refresh
preserves the face being edited.

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
