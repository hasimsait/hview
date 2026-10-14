# Validation results

Validated on 2026-10-14 after the PR #2 persistence and script-ID review fixes.
These results replace the earlier PR #1 baseline and rebase summaries. All
regression assertions remain enabled.

| Check | Result |
| --- | --- |
| Vitest unit/service suite (`npm run test:coverage`) | **99 passed, 1 failed (100 total)** |
| Node save/export/layer suite (`npm run test:state`, after building HTML) | **80 passed, 0 failed** |
| Application and test TypeScript (`npm run test:types`) | Pass |
| Production bundle and standalone viewer/editor templates (`npm run build`) | Pass |
| Chromium end-to-end suite (`npm run test:e2e -- --timeout=240000`) | **15 passed, 1 failed (16 total)** |

Nine new Node regression cases failed against the pre-fix source and pass now.
They cover unload recovery after hosted save/reset invalidates a stale cache,
skipping superseded queued snapshots, retaining pending cached edits and latest
save errors, and matching script IDs literally despite regex metacharacters.
Existing overlapping-save, import/reset, timeout, stale-tab protection, asset
replacement, offline save, HTML re-export and surface-layer regressions also pass.

The only failing unit/browser assertions are bathroom isolation retaining the unrelated
hallway-to-bedroom door. It remains enabled in
`unit/reported-surface-room.test.ts`; the corresponding browser assertion is
enabled in `e2e/reported-bugs.spec.ts`.

Vitest plan-service coverage: **85.94% lines/statements, 77.36% branches, 86.44%
functions**. All configured thresholds are met. Coverage includes all eight files
under `src/services/plan`; it does not measure the whole app or the separate Node
suite. The coverage command exits nonzero because of the bathroom assertion.

The browser run uses system Chromium with software WebGL and a 240-second
per-test limit. The runner's default remains 120 seconds; full-plan rendering
previously exceeded that limit. No browser assertion is skipped.

| Browser workflow | Outcome |
| --- | --- |
| Column selection → ordinary wall inspector, four faces and recess controls | Pass |
| Full working-plan rendering, view switches and visibility controls | Pass (about 2.2 minutes; 240-second test limit) |
| Asset search, no-match state and cancellation | Pass |
| Real save/reset endpoints, including invalid-payload data preservation | Pass |
| Inspector move/resize → autosave → reload → plan download | Pass |
| Raycast selection and gizmo drag → persistence → reload | Pass |
| Asset replacement → autosave → reload | Pass |
| Downloaded viewer with service requests blocked | Pass |
| Downloaded editor → offline edit → storage → reload → plan download | Pass |
| Offline editor → standalone editor HTML export | Pass |
| Offline editor → standalone viewer HTML export | Pass |
| Export controls at 1440px and 1024px | Pass |
| Finish-picker category wrapping | Pass |
| Paint change → highlight update without unfocusing | Pass |
| Bathroom isolation → correct entrance only | Fail: unrelated hallway door remains visible; correct entrance is retained |

Build and Node export validation run in a disposable copy. Browser tests build
the current bundle/templates in another disposable copy and write plans only
there. Tracked source plans and generated templates remain unchanged.

Offline browser checks load downloaded HTML bytes in a fresh context and block
every other HTTP request. They establish offline bundle behavior; native file
navigation and Safari/iPad compatibility require separate device checks.

See [KNOWN_BUGS.md](KNOWN_BUGS.md) for the remaining bathroom-isolation issue and
the resolved regressions.
