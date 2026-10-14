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
- Offline success requires confirmed local plan storage; a confirmed server save can succeed when local storage fails.

## Surface-layer fix

The shared surface finish editor now exposes a signed integer layer with increase/decrease buttons. Higher layers take priority on coincident surfaces. The renderer compresses distinct layer values into adjacent depth ranks so large numeric gaps do not create large depth shifts. Material caches distinguish layers, and existing finish serialization preserves them on export/reload.

Browser validation passed with actual paint and tile materials: 270 overlap pixels across three camera angles and two insertion orders, plus a physically nearer object, integer buttons, negative input, and rejection of fractional input. Run `npm run test:layers:browser` with Chromium installed. Browser results and screenshot are in `work/surface-layer-browser-results.json` and `work/surface-layers.png`.

## Validation

Run `npm test` after rebuilding HTML distributions. The runner bundles all TypeScript tests using the project's installed esbuild and executes them with Node; it does not require the environment-specific tsx path.

Latest result: **37 tests passed, zero failures, zero TODOs**. Raw results are saved in `work/test-results.txt`. TypeScript checking and production/standalone builds are also verified.

Coverage uses controlled browser/storage/network substitutes and generated HTML. The targeted layer test also uses real Chromium rendering and DOM controls; this does not establish full application UI or exhaustive application coverage. Concurrent writes from separate tabs or other clients are outside this test scope.

Existing downloaded editors need regeneration to receive the fixes.
