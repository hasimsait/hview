# Retained regression coverage

Previously reported defects remain covered by enabled assertions. Current run results are recorded in [RESULTS.md](RESULTS.md).

| Resolved defect | Coverage |
| --- | --- |
| Asset replacement restores the old asset after reload | `asset-replacement.test.ts`, `unit/known-bugs.test.ts`, `e2e/workflows.spec.ts` |
| Offline save succeeds despite full or blocked browser storage | `offline-save.test.ts`, `unit/plan-persistence.test.ts` |
| Header and finish categories overflow | `e2e/workflows.spec.ts` |
| Older saves acknowledge newer edits or overwrite save status | `overlapping-saves.test.ts`, `persistence-lifecycle.test.ts`, `save-state-edge-cases.test.ts` |
| Downloaded editors cannot re-export HTML offline | `offline-html-export.test.ts`, `e2e/workflows.spec.ts` |
| Paint highlight stays stale until reselection | `unit/reported-surface-room.test.ts`, `e2e/reported-bugs.spec.ts` |
| Bathroom isolation retains an unrelated hallway door on a shared wall | `unit/scene-visibility.test.ts`, `e2e/reported-bugs.spec.ts` |
| Recess geometry cuts a nearby wall independently of its host | `unit/recess-ownership.test.ts`, `unit/scene-graph.test.ts` |
| Wall splits cross furniture recesses, or leave stale host IDs | `unit/recess-ownership.test.ts` |
| Valid shelving with nine or ten shelves cannot reload | `unit/domain-model.test.ts` |

Save is manual: the application no longer stages edits in storage, starts autosave timers, or writes on unload. Race regressions cover explicit saves and preserve unsaved edits in the session.
