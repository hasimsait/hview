# Tests

Install the locked dependencies with `npm ci`. In the cloud environment, use
`npm ci --cache /workspace/.npm-cache` because the default home cache is unwritable.

```bash
npm test                 # Both Vitest unit tests and Node save/layer regression tests
npm run test:state       # 80 Node save/export/layer regression tests (build HTML first)
npm run test:unit        # Vitest unit/service regression suite
npm run test:watch       # Rerun affected tests while editing
npm run test:coverage    # Coverage report and minimum coverage checks
npm run test:types       # Type-check application, tests and runner configurations
npm run test:e2e         # Real Chromium UI and HTTP persistence tests
npm run test:workflows   # Edit/reload, manipulation and offline export workflows
```

Unit tests cover plan parsing, edit/export/reload round trips, manager events and
selection, debounced autosave, local-storage backups, offline fallbacks, and save
and reset failure handling. All timer-based checks use virtual time.

Run `npm run build` before `npm test` or `npm run test:state`; the offline export
tests read the generated HTML templates from `dist`.

Save/export regressions also cover unload recovery after cache invalidation,
superseded queued POSTs, latest-save failures, and literal script-ID matching.
Migration regressions cover stored chimneys, repeated migration, split-wall
preservation, and inherited face finishes when saved properties are undefined.

Vitest coverage includes all eight files under `src/services/plan`, including
unexecuted code. The minimum aggregate thresholds are 78% lines/statements, 76% functions,
and 74% branches. These percentages do not measure rendering or UI coverage.
The HTML coverage report is generated at `coverage/index.html`.

Browser tests start their own Vite server on port 3100 in a temporary copy of the
checkout. The real save/reset endpoints write only in that copy, which is removed
when the server exits. The existing development server and working plan are not
used or changed. A single worker prevents tests from racing over the plan file.

The browser suite checks sample-plan counts, real WebGL draw calls, view switching,
ceiling/cutaway toggles, asset search, JSON disk persistence, invalid saves, and
template reset. These are behavioral smoke tests, not visual regression tests.
Legacy column outlines and spaces below 0.5 m² import as solid, thick walls.
The root template has 47 walls; the working public plan has 50. Both have 10 usable
rooms and 119 furniture objects. Columns and chimneys use ordinary wall selection,
finishes, end caps, and recess controls.

The workflow suite additionally selects a real mesh through raycasting, drags the
translation gizmo, edits position/elevation/rotation/dimensions in the inspector,
and verifies autosave, reload, and downloaded plan data. It uses a small plan in
the disposable checkout so pointer tests are faster and deterministic.

Standalone templates are built from current source inside that copy before the
server starts; tracked templates remain unchanged. Downloaded viewer/editor HTML
is tested in a fresh browser context. Managed Chromium blocks `file://`, so tests
fulfill only the downloaded document bytes in memory and abort all other HTTP
requests. Reload uses those same document bytes and the real browser storage.
This validates offline bundle behavior; native file navigation and Safari/iPad
still need separate device checks.

See [KNOWN_BUGS.md](KNOWN_BUGS.md) for confirmed failures. The new regression
assertions remain enabled, so the current test commands return a failure status.

To run the three user-reported regressions specifically:

```bash
npm run test:unit -- tests/unit/reported-surface-room.test.ts
npm run test:e2e -- tests/e2e/reported-bugs.spec.ts tests/e2e/workflows.spec.ts --grep 'paint highlight|isolating Bathroom|offline editor can re-export'
```

The paint test verifies immediate highlight updates and checks reselection as
well. The bathroom tests use actual opening IDs and preserve the legitimate
entrance while rejecting the unrelated hallway door. HTML re-export checks cover
both editor and viewer downloads from inside the downloaded editor.

On this cloud machine the runner uses system Chromium. Elsewhere, install the
Playwright browser with `npx playwright install chromium`, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a Chromium executable. Software WebGL is
enabled so CI does not require a physical GPU. Rendering can be slow; browser
tests allow 120 seconds per case and run without retries.

Playwright generates `playwright-report/index.html`, machine-readable results at
`test-results/results.json`, and saves traces/screenshots
for failed tests under `test-results`. Open the report locally with
`npx playwright show-report`. Test reports are ignored by Git.

Both test suites remain enabled. The documented bathroom-isolation regression
still makes the full test command return nonzero; save/export/layer regressions
pass. See [RESULTS.md](RESULTS.md) for current counts and browser runtime settings.
