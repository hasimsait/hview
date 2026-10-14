# HView refactor implementation plan

Prepared 14 October 2026 against commit `76e318ef7e0c65ee696be764cce4791e8817b8cd`; branch `refactor`.

## Recommendation

Fix persistence and round-trip correctness first, then migrate one authoritative document model through the editor and viewer. Keep the existing geometry algorithms until characterization tests cover them. Extract renderer ownership and reconciliation before changing wall construction or procedural textures.

The supplied review correctly identifies duplicated models, large services, weak boundaries, and data-loss risks. Its proposed five-step replacement is too broad for this repository's current verification coverage. It also replaces existing layers with another large set of mandatory classes. Use typed data, pure operations, explicit adapters, and polymorphism where implementations actually vary. Each change below has a working intermediate state and a removal gate for its predecessor.

This document is a plan, not an implementation of the refactor.

## What was verified

The checkout contains 107 tracked files and no `tests/` directory, test runner, Playwright configuration, or lint configuration. TypeScript is strict. The review's cited unit and E2E suites cannot serve as existing gates; they must be introduced.

| Review claim or finding | Evidence in this checkout | Consequence |
| --- | --- | --- |
| Asset replacement is lost on reload | Reproduced: replace `sofa` with `chair`; exported `assetKey` is `chair`, reparsed key is `sofa`. `PlanParserService.ts:229` resolves from `name`; furniture construction ignores explicit `it.assetKey`. | Fix before model changes. Separate asset identity from labels and legacy names. |
| Save completion clears newer edits | Reproduced with a controlled save promise: edit, start save, edit again, finish old save; newer edit remains but `hasUnsavedChanges()` is false. `PlanManagerService.ts:1071`. | Track the exact captured document and serialize writes. |
| Save always succeeds after failures | Overstated. Normal HTTP failure returns false. Reproduced false success in standalone/file mode when both `localStorage.setItem` and fetch fail. `PlanPersistenceService.ts:118`. | Define which target constitutes a successful save; retain separate backup/server outcomes. |
| Columns have no first-class model | Incorrect here: `ColumnEntity`, `ColumnObject`, and `ColumnInspector` exist. However, `ThreeSceneService.ts:276` detects columns and `:438` assigns `plan.columns` during rendering. | Remove renderer writes to the document; preserve current column features and classification behavior. |
| Column migration sidecars exist | `ColumnDetection.ts` and `ColumnWallMigration.ts` are absent. Detection is embedded in `ThreeSceneService.detectWallColumns`. | Extract the code that actually exists; avoid planning deletions of imaginary files. |
| SceneObject is a passive wrapper with no contracts | Incorrect here: it declares `renderObject`, surface/property APIs, and `toJSON`. It imports Three.js and the concrete material service. Neither the factory nor universal inspector has an external caller in `src`. | The problem is an unused, rendering-coupled parallel model. Do not build another class hierarchy beside it. |
| Asset dispatch is entirely string chains | Mixed. `SceneObjectFactory` uses conditions; active `AssetBuilderRegistry` already uses a map and aliases, with a heuristic fixture fallback. | Consolidate metadata and aliases; reuse actual builders. |
| Listener arrays and room changes lack batching | Listeners are Sets. `setRoomWallFinish` emits per-entity callbacks followed by one plan-change callback. | Replace fragmented event semantics with one transaction and affected IDs, rather than merely replacing arrays. |
| Two inspectors compete at runtime | Several specialized inspectors are active; `UniversalObjectInspector` is unreferenced. | Remove verified dead paths early; migrate working controls section by section. |
| Two sample files are accidental duplicates | README and Vite middleware explicitly distinguish root template and public working copy. Standalone build prefers the root template. | Preserve both roles until working storage is separated from distributable assets; make build input explicit. |
| Tile catalog is hardcoded in its service | Incorrect: `TileCatalogService.load` loads `public/textures/tiles/tiles.json` or embedded catalog data. Its API does leak Three.js vectors. | Retain the existing manifest; separate metadata from rendering math. |
| Removed scene resources leak | Removal paths detach meshes without consistently disposing geometry; material/texture caches have no release API. Some helpers are disposed correctly. | Implement explicit ownership. Actual GPU growth still requires browser measurement. |
| Last-column deletion round-trips correctly | Additional reproduced defect: set the last column list to empty, export, parse; the raw original column reappears. Export writes columns only when nonempty. `PlanExportService.ts:206`. | Include empty collections and deletions in codec invariants. |
| Parsing returns isolated state | Additional reproduced defect: canonical parse retains input entity references and the furniture array. It also changes candidate walls and computes offsets. `PlanParserService.ts:23`. | Decode must not mutate or alias input. |
| Interaction lifecycle is clean | `InteractionService.initialize` subscribes repeatedly; `dispose` does not retain or invoke those unsubscribe functions. | Include repeated mount/unmount and pending animation-frame cleanup in the first lifecycle work. |

Actual sizes: plan manager 1,267 lines; scene service 2,186; wall geometry 1,197; surface finishes 1,744; viewer entry 642. File length indicates responsibilities to examine, not a correctness rule.

### Baseline checks performed

- `./node_modules/.bin/tsc --noEmit`: passed.
- Vite production build to a scratch output directory: passed; main JS is 1,261.65 kB minified / 328.56 kB gzip and triggers a chunk-size warning.
- Standalone build in an isolated source copy: passed using the existing externally installed tsx loader; viewer HTML 17.43 MB, editor HTML 17.88 MB, 30 texture assets embedded.
- Node audit harness using bundled actual parser/exporter/manager/persistence code: reproduced the four correctness defects and parser aliasing above.
- Root sample parses to 60 walls, 12 rooms, 119 furniture items, and zero explicit columns before renderer detection. This is a fixture baseline, not a target column count.

No browser behavior, GPU memory benchmark, screenshots, or E2E tests were run. The standalone build check is not proof that a clean `npm ci && npm run build` is reproducible: tsx is not declared in this project's dependencies, and the build script imports transitive esbuild.

## Design decisions

### 1. A serializable domain model, with rendering outside it

Use immutable, discriminated TypeScript records for walls, rooms, columns, hosted openings, and furniture variants. Keep domain rules as pure functions. Keep builders behind typed renderer interfaces or a registry. A mandatory `PlanElement` inheritance tree and double-dispatch visitors are unnecessary for ordinary transforms, serialization, or field editing.

Domain code must not import Three.js, React, DOM APIs, rendering services, or UI descriptors. Inspector sections belong to the UI; declarative surface capabilities may belong to catalog/domain metadata. World bounds should distinguish geometric bounds from renderer-specific/model bounds instead of promising an exact box from incomplete metadata.

Retain every currently supported variant, including sliding doors, French windows, chimneys, named furniture finish sections, invisible surfaces, wall edge/baseboard finishes, and both wall-native cavities and legacy recess furniture. The review's example union omits several of these.

Introduce branded entity IDs and explicit unit conversions at boundaries. Internal lengths are meters and orientation is radians; display conversions use named helpers. Specify the plan XY to world XZ mapping and wall A/B convention using asymmetric fixtures. Grout millimeters and catalog centimeters remain explicit boundary units. Do not globally rewrite all numeric types before correctness tests exist.

The catalog has one source for canonical asset keys, import aliases, default dimensions, placement, and capabilities. Resolve explicit `assetKey` before a legacy name; labels never choose geometry. Retain unknown keys and render a documented fallback without changing identity. Capability changes on replacement must remove incompatible subtype settings in one transaction while preserving valid user transforms and size overrides.

### 2. A symmetric codec, preserving legacy information

Introduce `PlanCodec.decode(unknown)` and `encode(document, format)` with separate canonical HView and legacy RemPlanner adapters. Validate shape, finite numbers, IDs, references, and hosted-feature bounds. Return path-specific diagnostics. Unsupported future HView schema versions must fail clearly rather than entering a legacy heuristic parser.

Use an application-owned schema discriminator/version independent of existing upstream `v` or in-memory `version`. Decode existing dictionary-based centimeter files, existing array-based meter files, and the new format through explicit adapters. Legacy import retains unknown metadata in a codec-owned, immutable extension sidecar; known edited fields always win on export. Do not serialize the live document plus a stale duplicate `rawPlan` as competing authorities.

The codec must handle both present and removed values, empty collections, and all supported finishes/lighting/geometry fields. Test semantic round trips with documented numeric tolerance; existing export rounding means byte-for-byte equality is not a reasonable gate. Keep legacy export available explicitly while canonical saves become the default after migration coverage passes.

Extract column detection and legacy split cleanup into deterministic, idempotent normalization. Preserve authored columns and their finishes, stable IDs, source wall references, and chimney behavior. Report ambiguous tiny wall clusters instead of silently converting arbitrary short walls. Persist accepted imported columns once. Recompute affected topology through document operations after wall edits; the renderer consumes the result and never discovers persistent data.

Do not delete a parent solely because a string-suffixed child exists. Validate split lineage and references, and preserve uncertain imported data with diagnostics.

### 3. One document store and atomic operations

Use normalized entity records and derived indexes for wall-hosted openings, adjacency, room sides, and column sources. Maintain one authority for an opening; do not keep editable copies in both a global opening map and wall arrays. During transition, an adapter can expose the old array/nested shapes.

`DocumentStore` owns a stable immutable snapshot and a typed `dispatch(command)` / `transaction(commands)` API. Operations return the new document, affected IDs/dependencies, and history information. Stateless geometry and topology functions remain functions. A separate generic command-bus framework is optional; dispatch does not require one class per setter.

Use typed operations for transform, replacement, deletion, door configuration, wall splitting, recess edits, and finish application. Validate the entire batch before publishing; errors leave state untouched. Emit one change set and create one undo entry. No-op edits create no history or dirty state. Start history with structurally shared before/after snapshots bounded by an explicit limit, excluding raw duplicate documents and GPU resources; introduce inverse patches only if measured memory warrants them.

Separate `SelectionStore` and `ViewportStore`. Selection is one union of `{ kind, id, subtarget }` or null, resolved against the current document. Deletion clears invalid selection; splits explicitly remap selected walls and hosted openings. UI/renderer code receives readonly snapshots, not references it can mutate.

`subscribe` and `getSnapshot` support `useSyncExternalStore`; repeated reads return the same reference until the relevant state changes. Keep document, selection, and save subscriptions separate so selecting an object does not serialize or rebuild geometry. A failing subscriber must not suppress later listeners; report errors rather than swallowing them silently.

### 4. Persistence acknowledges a specific snapshot and target

Separate local backup, server persistence, file export, and reset capabilities. Default deployment adapters: development HTTP storage for the existing middleware, browser-local storage for a static editor, and embedded input plus explicit browser backup/download for a standalone editor. The read-only viewer exposes no mutation/save capability. Future production server persistence needs a real backend, not the Vite development plugin.

Capture `{ documentSessionId, contentToken, encodedPayload }` before awaiting a write. A success acknowledges only that payload on the required target. Serialize/coalesce writes per document so an older request cannot overwrite a newer saved document. Changing or resetting the document invalidates old acknowledgments. Handle quota errors, unavailable storage, malformed server results, and missing endpoints explicitly.

Distinguish a monotonic change revision from document content identity. `dirty` compares the current immutable content token with the last confirmed token, so undo back to the saved state can become clean. A simple increasing revision inequality would avoid the observed race but mishandle that case. In-flight saves, undo/redo, failed saves, reload/reset, and queued autosaves all need controlled-promise tests.

Loading must not overwrite a valid unsaved local recovery candidate before comparing it with the server/template. Standalone startup should use its embedded document before unrelated cached plans; cache keys need document/artifact identity. Failed unload beacons never establish success. Reset changes state only after a validated template is available.

### 5. An incremental renderer with explicit resource ownership

Keep Three.js in `src/engine`. Split canvas/camera/lighting lifecycle from document scene reconciliation, picking, selection overlays, cutaway policy, and assets/materials. A retained map of element IDs to scene nodes is useful; nodes may be small objects implementing an interface rather than compulsory subclasses.

Reconciliation distinguishes transform, geometry, material, topology, and view changes. A furniture transform preserves its meshes. A wall edit invalidates its hosted openings, attached recesses/trim, and adjacent junctions; room boundaries may affect floors/ceilings; column source changes may affect wall cutouts. The change set must include this dependency closure, not just the directly edited ID.

Each node owns its geometries and registrations and leases pooled materials/textures. Keep stable root groups so TransformControls can remain attached through child mesh replacement. Dispose owned resources exactly once; shared assets are reference counted and disposed only after the last lease. Account for texture sharing, material arrays, edges/labels, loaded models, environment render targets, and scene-wide helpers. Global material/texture pools use normalized semantic keys including rendering options and catalog revision, with bounded retention for zero-reference entries.

Picking uses a typed mesh registry (`WeakMap<Object3D, PickTarget>`) plus a managed candidate collection. Register leaf meshes, resolve material-group/face subtargets, and unregister removed candidates. A WeakMap alone neither enumerates candidates nor releases GPU resources.

Layers are useful for whole-object pickability, but they do not reproduce visibility of shader-clipped wall fragments. Preserve an explicit hit-visibility predicate for foreground clipping, cutaway height, invisible materials, ancestor visibility, room isolation, and excluded ceilings. Verify layer settings on descendant meshes and test clipped and visible parts of the same wall. Editor and viewer must call the same picker.

Add render invalidation after correctness and lifecycle work. Render while orbit damping, keyboard movement, gizmo dragging, or animation is active; also invalidate on resize, selection, async asset completion, material updates, and settings changes. Stop GPU rendering when idle or hidden without freezing navigation or missing async updates.

### 6. Preserve geometry; extract by stage

Extract current wall outline/junction calculations, opening and recess interval subdivision, face classification/UV projection, and trim builders into separately tested modules. Share opening placement inputs with both wall cuts and opening meshes. Share room shape/UV helpers between floors and ceilings.

The existing wall box/interval subdivision can remain the implementation. Introducing general CSG is not a prerequisite and could change winding, precision, material groups, UVs, and bundle size. Consider it only for a documented feature that current geometry cannot support.

Keep material visual behavior while extracting texture drawing and shader/material assembly. Not every pattern needs a strategy class. Reuse setup/drawing helpers and introduce a `CanvasFactory` adapter so tests do not require a WebGL context. Browser image comparisons remain necessary for actual canvas/shader output. Seed procedural randomness for deterministic fixtures.

Workers/OffscreenCanvas, instancing, and shared primitive geometry follow measured hotspots. Shared geometry must not be mutated for per-mesh UV projection; clone or use shader/instance attributes when required. Do not impose a 150-line strategy or 350-line file cap that would fragment coherent algorithms.

### 7. Typed composition and shared application behavior

Keep dependency injection through explicit constructor parameters and a `createRuntime({ mode, persistence, assets, ... })` composition root. Replace global token/service lookup with a typed React runtime context as callers migrate. Runtime construction creates no canvas; viewport mount attaches browser resources; `dispose()` owns every subscription, listener, timer, frame callback, and GPU lifetime.

Share codec, catalog, stores, scene engine, picking, view policy, and display formatters across editor and viewer. An editor shell supplies mutation controls; a viewer shell supplies readonly inspection. Sharing React controls is useful where it reduces duplication, but a lightweight DOM viewer is acceptable if its domain/engine behavior is shared and tested. Rewriting it merely to hit a line count is not a goal.

The inspector router resolves the selection union. Reuse transform, numeric, finish-slot, lighting, opening, wall-structure, and column-face sections. Keep complex sections as focused React components instead of encoding all interactions into a universal schema. Input drafts remain local until valid commit; drag gestures are previewed and committed/coalesced as one history operation.

## Staged delivery and gates

Each row is a bounded delivery step; split renderer/material work further if its diff cannot be reviewed independently. All steps retain a working editor and both standalone products. Steps 1–4 are the first milestone.

| Step | Concrete implementation | Required gate | Retirement condition |
| --- | --- | --- | --- |
| 0. Establish tests/build baseline | Add pinned Vitest and Playwright tooling; declare tsx/esbuild directly; add typecheck/test/build scripts and CI. Capture legacy/canonical sample fixtures and asymmetric geometry/view screenshots. Choose explicit template vs working-plan build input. | Clean locked install; web and both standalone builds; smoke load/pick/edit/export workflows. Existing defects are tracked by repro tests and fixed in step 1, not accepted as desired behavior. | No cited nonexistent test suite remains in project documentation; build requires no implicit tool download. |
| 1. Repair current data integrity | Prioritize explicit asset keys; correct standalone failure status; guard saves with captured document identity; serialize saves; export empty columns. Fix duplicate interaction subscriptions and cancel deferred reattachment frames. Add one shared safe embedded-JSON serializer. | Reproduced defects now pass expected-behavior tests; failed saves stay dirty; no stale writes; repeated mount/unmount leaves one active interaction subscriber. Strings containing `</script>`, `<`, U+2028/U+2029, and replacement-string characters survive standalone injection. | Temporary fixes remain the sole current path until codec/store replacement passes the same regressions. |
| 2. Introduce codec and catalog authority | Add `domain/model`, `domain/catalog`, `domain/codec` canonical schema and explicit legacy adapters; preserve extensions and units. Extract column normalization from renderer, with dependency-aware topology refresh. Parser/exporter temporarily delegate to codec. | Semantic decode/encode/decode equality across fixture formats and every editable field; deletions/empty lists; unknown assets/metadata; no input mutation; migration idempotence; unsupported-version diagnostics. Deep-freeze a document and render/rebuild it without writes. | Old parser/export implementations and duplicate alias dispatch disappear only after both shells use the codec. |
| 3. Introduce document operations/stores | Add document/selection/view stores, pure topology operations, atomic batches, dependency change sets, bounded undo/redo, and readonly legacy adapter. Move `WallTargetStrategy` rules and recess presets out of UI after preserving behavior. | Stable snapshots, one event/history entry per batch, invalid-batch rollback, no-op behavior, delete/split selection remapping, opening/cavity bounds and source-column references. Room finish changes preserve the neighboring room's opposite face. | Every existing manager mutation delegates to dispatch; the adapter owns no independent editable document. |
| 4. Move persistence into a controller | Add target-specific adapters, save queue, snapshot acknowledgments, recovery policy, and document-scoped cache. Move dirty/save/reset out of plan manager. Separate runtime user data from `public/sample.plan` while preserving explicit development reset. | Controlled promise tests: edit during save; saves queued in order; document replacement/reset during save; undo to saved state; quota/server failure; static build without HTTP endpoints; recovery and isolated standalone cache. | Old persistence orchestration/timers removed once all save/reset UI calls use the controller. |
| 5. Cut over React/runtime composition | Add typed runtime/context and store hooks. Migrate App/Header/Viewport and specialized inspector sections. Route selection via one union; keep validated local input drafts. Remove unreferenced domain/factory/universal-inspector paths after import audit. | Representative edit workflows and subscriptions pass; importing domain works without DOM/Three; two runtimes remain isolated; lifecycle survives repeated mounting. All supported opening/column/finish controls remain reachable. | Delete container/tokens/bootstrap/useService and split old service contracts only after imports are zero. Delete manager facade after its last caller migrates. |
| 6. Extract engine lifecycle/resources/picking | Introduce headless scene assembly, SceneEngine facade, resource leases/pools, typed pick registry, visibility predicate, overlays, and shared interaction controller. Migrate furniture first, then walls/openings/rooms/columns. | Node scene assembly without WebGL; transform retains root/geometry identity; removal disposes owned geometry once; shared material survives removal of one user; removed meshes cannot be picked; editor/viewer visibility parity. Browser GPU counts plateau after warmup during repeated edits. | Remove old userData identity paths and monolithic ownership sections when corresponding node tests pass; diagnostic labels may remain. |
| 7. Extract geometry/material stages | Move existing wall subdivision/UV/trim and room shape helpers; split procedural drawing from material/shader assembly; normalize keys and add bounded zero-reference retention. Preserve current calculations before optimizations. | Golden geometry fixtures for L/T junctions, short walls, multiple openings, split boundaries, columns, cavities, UV orientation and material groups; seeded browser images for supported patterns; shared texture release and catalog-change invalidation. | Delete old service implementations after staged modules are active; adapt old entry points temporarily without duplicate algorithms. |
| 8. Unify viewer and artifact packaging | Move viewer onto shared runtime/picker/formatters. Generate standalone HTML from a stable shell, compiled entries/CSS, and an explicit asset/plan manifest. Add artifact-provider adapters for exports and eliminate runtime template fetch. Generate templates only into build output. | Open both exports with networking disabled; import/edit/save/export in standalone editor; readonly viewer rejects mutations; subpath hosting; dangerous labels embedded safely; root/working plan selection documented; two builds have stable size and do not edit tracked files. | Remove generated templates from source control, template fetch/string stitching paths, and duplicated viewer picking only when offline and parity gates pass. |
| 9. Measured performance and boundaries | Add on-demand rendering; profile input-to-frame and textures; optimize the measured bottleneck. Enforce imports with ESLint restrictions/dependency rules and CI, with temporary exceptions removed at cutover. | Static idle scene stops rendering; damping/walkthrough/drag/async textures keep working. Record reference desktop and actual iPad measurements; no regression in correctness or browser snapshots. | Remove old animation/rebuild fallback paths after parity; prohibit new legacy service imports. |

Order: `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9`. Build and export safety work from steps 0–1 should not wait for architecture work. Extract pure geometry helpers earlier only when independently covered; do not combine behavior changes with extraction.

## Important implementation contracts

- **Save success:** the required persistence adapter confirms the captured payload; a best-effort backup has its own outcome. Persisted schema version and save revision/content token have different purposes.
- **Wall split:** reject a split through a hosted opening/cavity footprint initially rather than silently assigning it by center. Preserve world location, wall-side orientation, finishes, room adjacency, and column-source references. Support undo as one operation. Remove obsolete opening records during export as well as obsolete walls.
- **Reconciliation:** material edits do not rebuild geometry; transforms do not replace furniture root groups. Topology changes rebuild the affected dependency neighborhood, falling back to a full rebuild only through an explicit, measured compatibility path.
- **Column conversion:** authored geometry and source references are authoritative; importing/rendering repeatedly cannot generate new column IDs or overwrite user finishes. Do not automatically convert native canonical documents with legacy heuristics.
- **HTML packaging:** escape `<` and line separators in every embedded JSON payload, including plan, catalog, and asset manifest. Validate a unique insertion location and use a callback for string replacement or a structured assembler; raw replacement strings also interpret dollar-prefixed replacement tokens. Test by parsing and opening the artifact.
- **No recursive templates:** importing the generated full-editor HTML with `?raw` directly into the editor that generates it creates an entry/template dependency cycle. Compile entry bundles first, assemble artifacts second, and supply artifact data through a host adapter. Standalone export must reconstruct from its packaged payload rather than embed a template that embeds another template. Repeated builds/exports must have stable size. Base URLs and offline texture/model assets belong to the asset adapter.
- **Resource safety:** resource sharing and disposal must land together. A mesh-removal traversal must never dispose pooled material/texture references that remain in use elsewhere.
- **Single authority during transition:** facades translate requests and snapshots; they cannot maintain another store. No dual writes, hidden sync effect, or permanent old/new renderer path.

## Intended module boundaries

```text
src/domain/           model, units, catalog metadata, codec, migrations, operations
src/application/      document/selection/view stores, history, persistence controller
src/engine/           Three scene nodes, geometry, materials, picking, camera/render loop
src/adapters/         browser/HTTP/embedded storage, assets, artifact export
src/ui/               React shells, store hooks, inspector sections and controls
src/viewer/           readonly shell using shared application/engine behavior
src/runtime/          explicit composition and lifetime ownership
scripts/              deterministic artifact builds
tests/                domain, store, scene, browser and offline artifact fixtures
```

Domain has no outbound dependency on these other layers. Application depends on domain and narrow persistence ports. Engine consumes readonly domain data/change sets and emits typed hits; it does not mutate stores or save documents. Adapters implement ports. UI/shells call application operations and manage local presentation. Runtime wires the graph explicitly. Enforce these rules progressively on migrated directories, then remove exceptions.

## Completion criteria and risk controls

1. Every supported format and editable feature passes semantic round-trip tests; no deleted entity reappears. Legacy metadata preservation has explicit fixture assertions.
2. Successful saves acknowledge the right content and target; edit/save/reset/undo races cannot lose dirty state or overwrite newer data. Recovery is document scoped.
3. Rendering and picking do not mutate the document. One change set drives reconciliation; only affected dependencies rebuild. All resource owners and unsubscribe paths have lifecycle checks.
4. Editor, readonly viewer, and standalone editor share domain/engine behavior and pass representative browser and offline export tests, including touch input, both wall sides, openings, finishes, and room isolation.
5. Clean installation/build is reproducible, generated artifacts do not modify tracked inputs, and the dependency graph rejects forbidden imports. Removed layers have no callers.
6. Performance changes report measurements on a specified scene/device. Initial targets are behavioral: stable resource counts after warmup, preserved transform mesh identity, and no GPU renders while fully idle. Numeric latency/memory budgets should be set from the captured baseline and actual target iPad, not invented here.

The largest risks are undocumented legacy metadata, heuristic column classification, wall orientation/UV changes, shared GPU ownership, and standalone packaging. Isolate each behind fixtures and an adapter before deleting its old path. Keep each step independently revertible in Git; preserve original input fixtures and explicit legacy export until migration tests cover the supported formats. Avoid a long-lived alternate architecture or runtime feature switch as a substitute for finishing a cutover.

The next implementation change should be step 0 plus the narrow step 1 correctness repairs. Do not begin by deleting `PlanManagerService`, rewriting wall geometry, or creating a visitor class for every element.
