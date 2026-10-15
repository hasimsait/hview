# Validation results

Column selector follow-up on 15 October 2026, starting from `443c816`: wall and column inspectors now render one shared `SurfaceTargetSelector`; the previous wall selector and column-only button row are removed. Strict TypeScript, production/standalone builds, five column unit tests, and three browser scenarios pass. The column browser scenario covers all-face and independent four-face painting, selected-target highlighting, undo/redo, recess selection/validation, and save/reload. The other browser scenarios cover wall paint highlighting and Bathroom isolation.

The regenerated checked-in HTML also passes offline column selection, independent face painting, and manual save/reload, with zero page errors or external requests. Its bytes match the current template and working plan; source plans and the dependency lock are unchanged.

Final checks on 15 October 2026, starting from `refactor` at `afe277e` and including the fixes committed with this record.

| Check | Result |
| --- | --- |
| Production editor and standalone builds (`npm run build`) | Pass |
| Checked-in working-plan editor (`npm run build:sample-editor`) | Regenerated; exact match to current template and plan |
| Strict application/test TypeScript (`npm run test:types`) | Pass |
| Unit tests and coverage (`npm run test:coverage`) | 150 passed; thresholds pass |
| Node save/export/layer regressions (`npm run test:state`) | 80 passed |
| Complete Chromium suite (`npm run test:e2e`) | 22 passed |
| Offline workflow after the final thumbnail fix | Pass, including embedded wood/fabric previews and zero HTTP requests |
| Actual checked-in HTML with external requests blocked | Load, Bathroom isolation, plan import, room edit, manual save/reload, JSON/HTML export, and embedded reset pass |
| GPU surface layers (`npm run test:layers:browser`) | 270 overlap pixels and layer-control validation passed |
| `git diff --check` | Pass |

Configured coverage is 92.42% lines/statements, 87.90% functions, and 84.93% branches. Coverage includes domain, application, persistence, scene nodes, resources, picking, and scheduling; it does not measure the entire UI or geometry library.

The final checks reproduced and fixed three additional defects:

- Opening another plan while a room was isolated retained the old room IDs and could hide the new plan. Invalid room filters are now removed when the document changes.
- Clearing a room-name field called the domain with an empty name, raising an uncaught error. The field now holds a draft, commits a valid name on blur/Enter, restores blanks, and cancels with Escape. A rename is one undoable edit and survives save/reload.
- Finish thumbnails used external wood/tile/fabric URLs even when the texture bytes were embedded. CSS previews and Three.js now share the same embedded URL resolver.

The first two fixes have browser regressions in `e2e/document-editing.spec.ts`. Embedded URL resolution has unit coverage in `unit/embedded-textures.test.ts`; the offline browser workflow verifies photographic previews use data URLs and make no HTTP requests.

The complete 22-scenario browser suite passed after the document/room fixes. Following the final thumbnail fix, the affected offline workflow, unit/type/build/Node checks, and the actual checked-in HTML were validated again. No assertion was skipped or disabled. Browser save/reset tests use disposable checkouts, and standalone checks use isolated browser storage. Source plans and the dependency lock remain unchanged.

The checked-in HTML check starts with all 119 objects and 10 rooms, exercises the actual portable file, and finishes with no page errors or HTTP requests. The artifact is regenerated from current source and `public/sample.plan`, including these fixes.

Native file navigation and Safari/iPad compatibility still require device checks. Vite continues to report its existing large-bundle advisory.
