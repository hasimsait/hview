# Tests

Install with `npm ci` (in the managed workspace, `npm ci --cache /workspace/.npm-cache`).

```sh
npm run build                 # Build current editor and standalone HTML first
npm test                      # Vitest plus Node save/export/layer regressions
npm run test:types            # Strict application/test TypeScript checks
npm run test:coverage         # Coverage with retained thresholds
npm run test:e2e              # Chromium integration workflows
npm run test:workflows        # Editing, manipulation, replacement, offline exports
npm run test:layers:browser   # Actual GPU overlap pixels and layer controls
npm run test:watch            # Unit tests while editing
```

Vitest covers the behavioral domain, codec boundaries, session commands/history/selection, explicit-save races, storage failures, retained nodes, resources, picking, and render scheduling. `recess-ownership.test.ts` covers one-host cuts, legacy migration, split rejection/rehosting, deletion, subtype replacement, and undo/redo. `scene-graph.test.ts` checks host dependencies and retained geometry during finish updates.

The Node suite covers save queues, stale completions, load/import/reset races, manual-save isolation, offline storage, asset replacement, HTML exports, and surface layers. Tests exercise the public save operation; there is no separate cache-only persistence entry point. Editing and closing tabs do not write automatically.

Coverage includes `src/domain`, `src/application`, `src/platform/persistence`, scene nodes, resources, picking, and `RenderScheduler`, including unexecuted files. Minimum aggregate thresholds are 78% lines/statements, 76% functions, and 74% branches. This does not measure full UI or geometry coverage. The HTML report is generated at `coverage/index.html`.

Browser tests build current standalone templates and run the actual Vite save/reset endpoints in a disposable copy. All plan writes occur there. A single worker prevents scenarios from racing over the working plan. Scenarios cover production-plan rendering, camera/visibility controls, inspector/gizmo edits, typed luminaire behavior, column/recess creation and validation, undo/redo, explicit save and input locking, failure/retry, replacement, paint selection, room isolation, import while isolated, room-name drafts/undo/save, layouts, and offline save/reload/re-export.

The runner uses system Chromium when available. Otherwise run `npx playwright install chromium` or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Software WebGL is enabled. The per-test limit is 120 seconds with no retries. Reports are written to `playwright-report/` and `test-results/` (both ignored by Git).

Offline checks fulfill downloaded HTML from its bytes in a fresh browser context and block every other HTTP request. They verify the offline runtime; native file navigation and Safari/iPad still require device checks.

`mobile-performance.spec.ts` opens the self-contained editor in a touch/mobile viewport, checks framebuffer and lighting budgets, toggles deferred ceilings, forces GPU loss/restoration, and opens both HTML formats re-exported without network access. It verifies consumed data nodes are removed while Reset still works, and checks readable startup failure/retry for unavailable WebGL or damaged compressed data. `shader-reuse.test.ts` verifies shared program sources keep independent surface uniforms. Texture tests cover image readiness, binary aliases/object URLs, and shared decoded sources with independent samplers. Build-asset coverage checks the 512-pixel limit, alpha preservation, deduplication, and unchanged originals; portable HTML coverage checks binary/Unicode round trips and repeated packaging without growth.

`data-url-startup.test.ts` fails if a Shortcut document's pathname is read or percent-encoded, checks bounded keys and unchanged ordinary saved-copy keys, and verifies reset/load without storage or network. `opaque-origin.spec.ts` uses an actual sandboxed opaque origin to exercise import → edit → Save HTML → reopen with `localStorage` throwing `SecurityError` and all HTTP requests blocked. Managed Chromium blocks top-level `data:` navigation, so native iPhone Shortcut navigation and its memory ceiling remain device checks.

[RESULTS.md](RESULTS.md) records validation results. [KNOWN_BUGS.md](KNOWN_BUGS.md) maps resolved defects to retained regression coverage.
