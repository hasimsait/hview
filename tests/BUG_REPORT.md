# Bug and test report

Updated October 14, 2026.

## Current state

All four originally reported issues and the five follow-up persistence findings are fixed in the workspace. Implementation files, tests, and generated HTML are updated. Deployment is separate from committing and pushing these changes.

| Covered behavior | Test file | Count |
| --- | --- | --- |
| Asset replacement survives save/reload | `asset-replacement.test.ts` | 5 |
| Older save cannot clear newer edits' dirty flag | `overlapping-saves.test.ts` | 6 |
| Downloaded editor re-exports editor/viewer HTML offline | `offline-html-export.test.ts` | 3 |
| Storage-full/network-unavailable saves fail honestly | `offline-save.test.ts` | 6 |
| Cache-first loading, blocked storage fallback, current save status, ordered writes, immediate edit caching, queue recovery, reset ordering, unload behavior, server fallback, quota recovery | `persistence-lifecycle.test.ts` | 11 |
| Additional import/reset/load races, source isolation, acknowledgements, corrupt data, subscribers, timeouts, stale-tab unloads and application bootstrap | `save-state-edge-cases.test.ts` | 34 |
| Surface layer ranking, independent materials, bounds, finish changes and persistence | `surface-layers.test.ts` | 6 |

The former known-bug TODO tests are now ordinary regression tests in `persistence-lifecycle.test.ts`. No TODO tests remain.

## Persistence behavior

- Every editor mutation caches the latest serialized plan synchronously, before the 600 ms server autosave debounce.
- Reload restores the valid browser working copy before attempting server loading. The server remains the fallback when local and embedded data are unavailable; reset explicitly replaces the working copy with the server template.
- Storage access errors cannot prevent embedded-plan fallback.
- Server save requests are sent in order. A failed request releases the queue.
- Only the latest staged snapshot can update save status or schedule the saved-to-idle transition. The manager also checks the plan revision before clearing its dirty flag.
- Unload uses the latest staged snapshot and avoids sending a competing beacon while server writes are pending.
- Reset waits for previous writes and updates the snapshot used on unload.
- Standalone HTML saves only to its own browser working copy; reset restores its embedded baseline. It never writes to a hosting site’s plan API or silently loads a hosting site’s sample plan. Online editor saves require a positive server acknowledgement and can succeed when local storage is unavailable.

## Additional save-state review

The follow-up review added 34 tests, reproduced previously uncovered failures, and fixed them. This review is included with the implementation and regression tests.

- Importing another plan updates the persistence snapshot, invalidates queued writes and status completions for the previous document, and preserves the imported plan on unload.
- Reset and save operations share one queue. Reset responses cannot overwrite edits or imports made while waiting; failed resets reschedule the cancelled autosave.
- Online saves require `{ "success": true }`, rather than merely HTTP 200. HTML fallbacks, explicit negative acknowledgements, malformed save/reset data, and rejected persistence promises do not clear unsaved edits.
- Invalid/circular embedded globals fall back to valid script data; corrupt local data cannot prevent embedded fallback.
- Throwing save-status subscribers cannot stop persistence or other subscribers.
- Requests and response bodies time out after 15 seconds, release queued operations, and preserve active edits. Delayed URL loads cannot overwrite newer edits, and the latest URL request takes precedence.
- Standalone working copies are separated by document path. Standalone saving, resetting and bootstrap never substitute an unrelated host plan/API for the embedded document.
- Closing a stale tab cannot overwrite another tab’s newer local snapshot; confirmed server saves do not issue redundant unload writes.
- Application bootstrap preserves a plan imported or edited while initial loading was pending.

Existing server-acknowledgement mocks were corrected to use the actual endpoint response contract. Server queue tests now explicitly exercise the online editor; standalone storage tests exercise local persistence independently.

## Surface-layer fix

The shared surface finish editor now exposes a signed integer layer with increase/decrease buttons. Higher layers take priority on coincident surfaces. The renderer compresses distinct layer values into adjacent depth ranks so large numeric gaps do not create large depth shifts. Material caches distinguish layers, and existing finish serialization preserves them on export/reload.

Browser validation passed with actual paint and tile materials: 270 overlap pixels across three camera angles and two insertion orders, plus a physically nearer object, integer buttons, negative input, and rejection of fractional input. Run `npm run test:layers:browser` with Chromium installed. Browser results and screenshot are in `work/surface-layer-browser-results.json` and `work/surface-layers.png`.

## Rebase onto 6.1-m

`work` now includes the `6.1-m` column-to-wall migration and test infrastructure. Layer persistence for legacy columns is verified through their migrated wall faces. Vitest save mocks were aligned with positive server acknowledgements, current-copy cache precedence, and reset snapshot behavior. Build and strict test TypeScript checks pass. Browser workflows passed after updating the offline cache-key assertion, except for a full-plan controls smoke-test timeout; see `tests/RESULTS.md` for the exact outcomes.

The existing bathroom-isolation regression remains enabled and unresolved. No visibility assertion was weakened to make the rebased suite pass. Plan-service coverage thresholds are met (85.9% lines/statements, 77.2% branches, 86.44% functions).

## Validation

Run `npm test` after rebuilding HTML distributions. The runner bundles all TypeScript tests using the project's installed esbuild and executes them with Node; it does not require the environment-specific tsx path.

Save/export/layer regression suite: **71 tests passed, zero failures, zero TODOs**. After rebasing onto `6.1-m`, its Vitest suite reports **91 passing and 1 failing** (92 total): the documented pre-existing bathroom-isolation bug. The combined `npm test` runs both suites and retains that failure; it is not a fully green suite. Raw results are saved in `work/test-results.txt`. TypeScript checking and production/standalone builds are also verified.

Coverage uses controlled browser/storage/network substitutes and generated HTML. The targeted layer test also uses real Chromium rendering and DOM controls; this does not establish full application UI or exhaustive application coverage. Stale-tab closing is covered; simultaneous user edits from separate tabs/devices still have no conflict resolution or server revision checks. These tests do not prove that all possible failures are absent.

Existing downloaded editors need regeneration to receive the fixes.
