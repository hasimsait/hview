# Validation results

Validated on 2026-10-14 after the column-wall migration finish fix. These results
replace the original pre-fix baseline; all regression assertions remain enabled.

Unit/service suite (`npm run test:coverage`): **96 passed, 4 failed (100 total)**.
All eight new migration checks pass, covering stored chimney geometry/finishes,
repeated migration, split-wall preservation, explicit undefined face finishes,
and saved finish precedence. The four undefined-finish cases failed before the fix.

The remaining unit failures reproduce:

- Asset replacement reverting after export/reload.
- An overlapping save clearing the dirty state for newer edits.
- Offline saves reporting success when storage is full and the network fails.
- Bathroom isolation retaining the unrelated hallway-to-bedroom door.

Plan-service coverage: **88.14% lines/statements, 79.42% branches, 85.57%
functions**. All coverage thresholds are met. Coverage includes all six files
under `src/services/plan`; it does not measure the entire app. Migration has
100% line coverage. The coverage command still exits nonzero because of the
four enabled product regressions above.

Application and test TypeScript checks pass. The production Vite bundle and
standalone viewer/editor templates build successfully from current source.

Browser suite (`npm run test:e2e`): **11 passed, 5 failed (16 total)**, using
system Chromium with software WebGL. Four failures reproduce known product bugs:
replacement persistence, bathroom isolation, and both offline HTML re-export
paths. The remaining failure hit the default 120-second rendering-test limit.
That test passed on a targeted recheck with a 240-second limit (about 2.1 minutes
for the test). The suite still returns nonzero with its default settings.

Rendering recheck command:

```bash
npm run test:e2e -- tests/e2e/hview.spec.ts --grep 'renders the real plan' --timeout=240000
```

| Workflow | Outcome |
| --- | --- |
| Column raycast selection → ordinary wall inspector, four faces and recess controls | Pass |
| Full working-plan rendering, view switches and visibility controls | Timeout at 120 seconds; pass on targeted recheck with a 240-second limit |
| Asset search, no-match state and cancellation | Pass |
| Real save/reset endpoints, including invalid-payload data preservation | Pass |
| Inspector position, elevation, rotation and resize → autosave → reload → plan download | Pass |
| Real raycast selection and translation-gizmo drag → disk persistence → reload | Pass |
| Asset replacement → autosave → reload | Fail: replacement reverts |
| Downloaded viewer with service requests blocked | Pass |
| Downloaded editor → offline resize → local storage → reload → plan download | Pass |
| Offline editor → standalone editor HTML export | Fail: missing external editor template |
| Offline editor → standalone viewer HTML export | Fail: missing external viewer template |
| Export controls at 1440px and 1024px | Pass |
| Finish-picker category wrapping | Pass |
| Paint change → highlight update without unfocusing | Pass |
| Bathroom isolation → correct entrance only | Fail: hallway door remains visible alongside the real entrance |

Browser tests build the production bundle and standalone templates in a disposable
copy and write plans only there. Tracked source plans and export templates remain
unchanged.

Managed Chromium blocks file navigation. Offline checks fulfill the downloaded
HTML document from its bytes and block every service/asset HTTP request in a
fresh browser context; they do not establish native file or Safari compatibility.

See [KNOWN_BUGS.md](KNOWN_BUGS.md) for reproduction steps and scope of each finding.

## Work rebased onto 6.1-m

The work branch includes 6.1-m's column-wall migration and both regression suites. Build and strict application/test type checks pass. The 71 Node save/export/layer tests all pass. Vitest reports 91 passing and one failing test: the documented, unchanged bathroom-isolation issue. Coverage thresholds remain satisfied (85.9% lines/statements, 77.2% branches, 86.44% functions).

Browser validation excluded only the already documented bathroom-isolation case from execution; its source assertion remains enabled. Of the other 15 cases, 13 passed on the full run. The offline edit case initially read the obsolete shared storage key; after aligning it with document-scoped storage, its targeted recheck passed. The full-plan controls smoke test exceeded its 120-second time limit. No assertion or time limit was relaxed to suppress that timeout.

Verified browser workflows include column-wall controls, real save/reset endpoints, paint-highlight refresh, manipulation and gizmo persistence, replacement/reload, network-blocked viewer loading, offline edit/reload/plan export, both offline HTML re-exports, and control/category wrapping. Raw rebase logs are stored under work/ and ignored by Git.
