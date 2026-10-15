# Validation results

Second Shortcut optimization pass on 15 October 2026, starting from `befa327`:

- The checked-in working-plan editor falls from **3,657,156 to 1,615,688 bytes** (56% smaller). Its outer base64 Shortcut URL falls from **4,876,230 to 2,154,274 bytes**. Editor/viewer runtimes and plan JSON use compressed blocks with a bundled Safari 15-compatible decoder; all exports use the same packaging.
- The 28 unique catalog images use **427,130 encoded bytes**, down from 944,854. All 30 paths remain available, including two aliases. Ten images use JPEG and eighteen use WebP. The 512-pixel cap reduces catalog-wide base RGBA from 50.28 to 24.96 MiB (not live VRAM). Original images and plans are unchanged; alpha preservation has build-level coverage. Representative tile/wood/fabric comparisons were visually inspected.
- Consumed texture, plan, and runtime scripts are removed. The document retains binary image resources and compressed original plan/runtime bytes for Reset and re-export. CSS and rendering share image URLs; compatible palette/finish textures share decoded sources while retaining independent sampler settings.
- A sampled mobile Chromium/SwiftShader scene retains 19 programs and 1,130 draws. Its texture count falls from 26 to 24; estimated RGBA storage including mipmaps across unique material image sources falls from 50.67 to 32.51 MiB. This estimate includes procedural material images and excludes render targets/buffers. It is not measured iPhone memory.
- Production/standalone builds, 170 unit tests, 80 Node regressions, strict application/test TypeScript, coverage thresholds, and the GPU layer check pass. All 26 existing browser scenarios passed; after the final bootstrap error handling, the mobile/opaque checks passed again alongside the new compressed-data failure scenario (27 distinct scenarios total). The root HTML exactly matches the current template and working plan. Source images, plan files, and the dependency lock are unchanged.

The portable checks exercise loading with requests blocked, editor/viewer re-export and reopening, reset after DOM cleanup, GPU restoration, opaque-origin import/edit/Save HTML/reopen, and readable retry screens for unavailable WebGL or corrupt compressed data. Download object URLs are kept alive briefly for Safari's asynchronous download handoff.

A separate three-run comparison at 4× CPU throttling, with other browser checks stopped, had median scene-ready times of 4.50 s before and 4.32 s after; individual samples overlap. This HTTP-fulfilled Chromium test excludes Shortcut navigation and WebKit URL handling, and does not establish a substantial startup speedup.

Native iPhone Shortcut loading and peak WebContent/GPU memory still require the user's device test. Payload reduction and lower texture storage are verified; a 2× native startup speedup is not established.

Performance and iPhone Shortcut work on 15 October 2026, starting from `refactor` at `de40429` on branch `performance`:

- The regenerated working-plan editor is about 3.66 MB, compared with 21.64 MB before the changes. Its outer base64 Shortcut URL is about 4.88 MB rather than 28.86 MB. All finish choices and offline editor/viewer re-export remain embedded.
- The mobile-sized Chromium/SwiftShader profile submits 1,130 draws per sampled frame, compared with 2,371. Initial programs fall from 36 (22 distinct sources) to 19 (19 distinct sources). These are rendering diagnostics, not native Safari timings.
- Estimated RGBA material-texture storage, including enabled mipmaps, falls from about 146 MiB to 51 MiB. This estimate excludes buffers/render targets and is not a measured iOS process total.
- Context restoration now prepares materials and redraws without user input. Mobile lighting follows the focused area with at most four fixtures at night; new glass finishes retain the mobile transmission budget. Hidden ceilings are built when requested.
- Shortcut/opaque documents never read their payload-sized pathname for a persistence key and do not access localStorage. Ordinary saved-copy keys remain compatible. Save HTML downloads the current document; reset works in memory. Element IDs work when secure-context-only randomUUID is unavailable.

The 166 unit tests, 80 Node persistence/export regressions, strict application/test TypeScript, coverage thresholds, production/standalone builds, and GPU layer check pass. The complete 25-scenario Chromium suite passed before the additional Shortcut-specific changes; affected save, mobile, and export workflows were rerun alongside the new opaque-origin regression. Coverage is 92.67% lines/statements, 87.97% functions, and 85.43% branches for the configured scope.

The opaque-origin browser regression imports a plan, edits a dimension, resets, downloads Save HTML, and reopens the edited HTML with localStorage throwing SecurityError and all HTTP requests blocked. Top-level data navigation is blocked by managed Chromium, so the actual opaque security origin is exercised using a sandboxed srcdoc; a separate regression throws on any data-URL pathname access or encoding. Native iPhone Shortcut navigation, peak process memory, and Jetsam/GPU reset causation still require device verification.

Original plans and source images are unchanged. The root HTML is regenerated from the current template and working plan. The dependency lock adds build-time Sharp image optimization and the bundled fflate decoder used only for offline viewer-template expansion.

Wall-junction follow-up on 15 October 2026, starting from `e2628a9`: the 5 cm connector at the living-room door corner was being used as its own through-wall pair, cutting back `_w5f7a_a` by about 5 cm. Through-wall selection now uses distinct substantial walls and prefers the longest continuous run. `PlanDocument` owns junction resolution for imports and edits; the legacy reader and split operation no longer calculate separate trims. Stale canonical offsets are repaired without changing wall coordinates, openings, or finishes.

All 155 unit tests (including five new junction regressions), strict TypeScript, 80 Node persistence/export checks, and production/standalone builds pass. Mesh raycasts reproduce the missing strip in both source plans before the fix and find solid wall after it. The actual regenerated root HTML imports an old canonical file with the bad trim, selects the formerly empty strip, and manually saves the repaired trim offline with zero page errors or external requests. The HTML exactly matches its current template and working plan; source plans and the dependency lock remain unchanged.

The full Chromium run passed all 22 existing scenarios. The new junction scenario initially expected a zero-column badge that the header omits; after correcting that expectation, all three reported-bug scenarios passed again. All 23 distinct browser scenarios are verified; no assertion was skipped or disabled.

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
