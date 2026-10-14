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
