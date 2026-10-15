# Validation results

Validated on 15 October 2026 on `refactor`, extending the behavioral-domain implementation at `ae46d9e`.

| Check | Result |
| --- | --- |
| Production editor and both standalone HTML builds (`npm run build`) | Pass |
| Strict application/test TypeScript (`npm run test:types`) | Pass |
| Unit tests with coverage (`npm run test:coverage`) | 145 passed |
| Node save/export/layer regressions (`npm run test:state`) | 80 passed |
| Full Chromium suite (`npm run test:e2e`) | 19 passed |
| Chromium recess/manual-save checks after the persistence cleanup | 3 passed |
| Chromium asset-replacement check after factory cleanup | 1 passed |
| GPU surface layers (`npm run test:layers:browser`) | 270 overlap pixel checks and layer-control validation passed |
| Whitespace/conflict check (`git diff --check`) | Pass |

Configured coverage is 92.41% lines/statements, 87.50% functions, and 84.85% branches. All retained thresholds pass. Scope includes domain, application, persistence, scene nodes, resources, picking, and scheduling; it does not cover the entire UI or geometry library.

This cutover adds regression coverage for behavioral recess creation, invalid creation atomicity, one-host cuts, movement/rehosting, detached placement, wall and rotated-column splits, hidden recess preservation, host deletion, asset replacement, old canonical/RemPlanner migration, and canonical round-trip stability. Rendering checks verify that host finishes refresh recess appearance without replacing its geometry and that removing/replacing recesses rebuilds only their owned host cuts. Shelving tests cover the full supported shelf range through both codecs. Door input rules are exercised directly on domain classes.

The column browser scenario creates a recess through actual controls, checks validation, undoes/redoes creation, saves, and reloads its typed host relationship. Existing scenarios cover the production plan, lighting, paint, room isolation, gizmo edits, explicit-save locking and retry, replacement, layouts, and offline HTML save/reload/re-export. Browser tests use disposable checkouts; source plans are unchanged.

The full browser suite passed before the final cache-only API removal. The affected column/recess and manual-save scenarios were rerun after that cleanup. The asset-replacement scenario was rerun after consolidating subtype field rules in the factory. Unit/Node/type/build checks pass after the corresponding changes. No assertion was skipped or disabled.

Offline browser checks block all external requests while serving the downloaded document bytes. Native file navigation and Safari/iPad compatibility still require device checks. Vite continues to report its existing large-bundle advisory.
