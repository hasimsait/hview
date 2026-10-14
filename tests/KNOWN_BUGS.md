# Confirmed product bugs

Resolved regressions remain enabled to prevent recurrence. Bathroom isolation
is the remaining unresolved product issue; its assertions still fail.

## 1. Fixed: Asset replacement is lost on reload

Saved asset keys now override the original item name. Replacing a sofa with a
chair survives autosave, export and reload, with the replacement's metadata.

Previously, saved JSON retained `name: "sofa"` alongside `assetKey: "chair"`.
Parsing the name restored the original sofa.

Tests: `asset-replacement.test.ts`, `unit/known-bugs.test.ts`,
and `e2e/workflows.spec.ts` (replacement through the UI).

## 2. Fixed: Offline save reports success after losing the write

Standalone save success requires a confirmed browser write. Full or blocked
storage returns failure and an error status, preserving the previous cached
plan. An unrelated hosting API cannot count as recovery for a standalone file.

Previously, a failed storage write plus a failed network request still reported
success, although neither destination accepted the edit.

Cache invalidation after a successful hosted save/reset also clears its snapshot
marker, allowing unload to retry the current plan when storage becomes available.

Tests: `offline-save.test.ts`, `unit/plan-persistence.test.ts`,
`persistence-lifecycle.test.ts`, and `save-state-edge-cases.test.ts`.

## 3. Fixed: Header controls and finish categories overflow

The header and its control groups wrap onto additional lines. Its height grows
with the controls, and the viewport and inspectors fit the remaining space.
Finish-picker category tabs also wrap, keeping each category label together.

Tests: `e2e/workflows.spec.ts`, “export controls wrap and remain reachable at
desktop widths” (1440px and 1024px) and “finish categories wrap within the
inspector without horizontal scrolling”.

## 4. Fixed: An older save clears the dirty flag for newer edits

Only a successful save of the current edit revision clears the manager's dirty
flag. Persistence generations prevent older completions from replacing newer
save statuses. Queued snapshots superseded by a newer edit or save are skipped;
they return failure without posting outdated JSON or acknowledging a newer edit.

Previously, save A could complete after edit B and mark B clean even though the
server only received A.

Tests: `overlapping-saves.test.ts`, `persistence-lifecycle.test.ts`,
`save-state-edge-cases.test.ts`, and `unit/known-bugs.test.ts`.

## 5. Fixed: Standalone editor cannot re-export standalone HTML offline

Editor exports embed reusable viewer/editor templates and shared texture/catalog
data. Both HTML export paths work without fetching external templates, including
repeated exports. Script data escapes closing tags, preserves literal replacement
characters, and matches script IDs literally even when they contain regex syntax.

Previously, an offline editor fetched external templates and displayed “Unable
to load editor template” or “Unable to load viewer template” instead of downloading.

Tests: `offline-html-export.test.ts` and `e2e/workflows.spec.ts` (both offline
HTML re-export paths).

## 6. Fixed: Selected paint swatch stays stale

Painting a selected wall immediately refreshes its highlighted swatch.
`setWallFinish` notifies selected-wall subscribers with the updated snapshot and
current side. Face selection also updates the selected side, preserving the face
being edited.

Previously, the highlighted swatch stayed unchanged until the wall was reselected.

Tests: `e2e/reported-bugs.spec.ts` (paint highlight),
`unit/reported-surface-room.test.ts` (selected-wall notification).

## 7. Unresolved: Bathroom isolation includes a hallway-to-bedroom door

Reproduction: isolate Bathroom (4.2 m²), ID `_rscdq`, in the working plan.
Door `_87omj` on wall `_tmb2o` remains visible, although it is outside the bathroom.
The bathroom's actual entry door is `_buz1m` on wall `_ojjeh`.

Isolation filters openings by whether their entire parent wall borders the
selected room. The long `_tmb2o` wall borders several rooms; its hallway door
should not remain visible merely because another segment borders the bathroom.

Browser and unit checks retain the correct entrance and reject the unrelated
hallway door. Additional assertions preserve the plan during isolation and
restore all openings with Show All.

Tests: `e2e/reported-bugs.spec.ts` (Bathroom isolation),
`unit/reported-surface-room.test.ts` (opening visibility).
