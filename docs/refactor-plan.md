# HView object-oriented refactor plan

Revised 15 October 2026 on branch `refactor`. Source audit: commit `76e318ef7e0c65ee696be764cce4791e8817b8cd`, performed 14 October.

Publication note, 15 October: fetching the remote revealed that `main` is now at `808356368beb927f7523ff1fb7ce1d151df0b5f9`, with column/picking/test changes (#1) and persistence/offline export/surface-layer changes (#2) absent from the supplied workspace. The source audit at the end of this document describes `76e318e`, not current `main`. Current `main` includes tests, column migration modules, and persistence/export repairs. Before implementation, reassess the initial repair tasks against those commits and reuse their regression coverage. The class-based target remains the proposal; findings from the older snapshot must not be treated as newly reproduced defects on current `main`.

## Objective

Make the repository readable as a coherent object-oriented program. A reader should find an architectural object's rules on its class, follow an edit through a named command, and find the corresponding rendering behavior through explicit polymorphic dispatch. Fixing bugs and splitting large services into files is insufficient.

The earlier plan made immutable records and procedural operations the target. That does not meet the user's requirement for classes, behavioral ownership, and established patterns. This revision replaces that target. The verified audit findings below remain valid; the proposed implementation changes substantially.

## The domain class model

```text
PlanDocument                         aggregate; owns element identity and relationships
  PlanElement                        abstract identity + polymorphic visitation
    Wall                             segment, hosted-feature constraints, finishable faces
    Column                           footprint, vertical extent, face finishes, source references
    Room                             boundary, floor/ceiling surfaces, room relationships
    Opening                          abstract wall-hosted location and aperture
      Door                           hinge, swing, opening angle
      SlidingDoor                    sliding configuration
      Window                         sill/glazing; preserves standard/French variants
    Furniture                        abstract placement, dimensions, finishable parts
      BasinCabinet                   basin/carcass constraints and named surfaces
      Luminaire                      validated emission configuration and placement
      Shelving                       shelf configuration and enclosure constraints
      StandardFurniture              catalog-backed ordinary furniture/model assets
```

`PlanElement` does not force walls, rooms, and hosted openings to pretend they have the same transform. Shared base members are identity, display name, and `accept(visitor)`. Concrete classes own their actual geometry semantics.

`PlanDocument` owns an indexed collection of these objects and enforces relationships. Openings have one authoritative representation: an indexed `Opening` object with a `WallLocation`; wall-to-opening lookup is a derived index, not another editable copy. Walls, rooms, columns, and furniture are likewise stored once. A `WallTopology` object provides derived adjacency and room-side queries for a particular document snapshot.

Classes encapsulate state. Constructors validate inputs; collections and value objects cannot expose mutable internals. Entities and the aggregate are immutable: methods return validated replacements. Examples of behavior belong on classes:

- `Luminaire.withIntensity(value)` validates the supported intensity range and returns a luminaire.
- `Shelving.withShelfConfiguration(config)` checks tier count/spacing and cabinet constraints.
- `Door.withOpenAngle(angle)` owns angle limits and hinge/swing behavior.
- `Wall.withFinish(surface, finish)` accepts the wall's actual surface identities.
- `Wall.validateHostedFeature(aperture)` checks aperture bounds against wall extent.
- `PlanDocument.replaceFurniture(id, replacement)` preserves identity/placement and validates replacement relationships.
- `PlanDocument.splitWall(id, distance)` checks hosted-feature intersections and updates wall, opening, room, and column references atomically.

Cross-object consistency belongs to the aggregate, not to a React handler, renderer, or furniture subclass. Focused collaborators can perform topology calculations without becoming independent owners of document state.

Use small domain value objects where validation is repeated: `Dimensions`, `Transform`, `WallLocation`, and typed `SurfaceFinish` variants. Units and entity IDs are explicit types. All internal lengths use meters, rotations radians; catalog centimeters, grout millimeters, and UI degrees have named conversions. Value objects must justify themselves through invariants, not merely wrap every primitive.

Furniture subclasses represent different behavior. Individual sofa/chair models remain catalog entries instantiated as `StandardFurniture`; they do not require empty subclasses. Lighting classification comes from canonical asset metadata, never from broad `category === 'fixture'` checks that would treat sockets as lights.

The existing domain classes are not activated unchanged: they combine public mutable DTO fields, Three.js construction, and UI property metadata. Recover their useful behavior and surface definitions into the class model above, retain exactly one geometry implementation, and remove the obsolete wrappers/factory after migration.

## Patterns and their actual jobs

| Pattern | Concrete participants | Responsibility |
| --- | --- | --- |
| Aggregate and value objects | `PlanDocument`, `Wall`, `Opening`, `Dimensions`, `SurfaceFinish` | Keep object rules and cross-object invariants enforceable through class APIs. |
| Factory | `PlanElementFactory`, `AssetCatalog` | Construct the correct concrete entity from validated canonical input. Catalog aliases are resolved once at import. |
| Visitor | `PlanElementVisitor<R>`; `SceneNodeFactory`, `InspectorPresenter`, `PlanEncoder` | Dispatch external rendering, inspection, and encoding to concrete element behavior without repeated name/type heuristics. |
| Command | `EditorCommand`; `ReplaceFurniture`, `SetLightIntensity`, `SplitWall`, `ApplyRoomFinish` | Represent a meaningful user action and invoke domain behavior in one atomic edit. |
| Memento | `EditHistory`, immutable `PlanDocument` snapshots | Undo/redo restores complete consistent document snapshots, with bounded history. |
| Observer | `EditorSession.subscribe`, stable snapshots consumed with React hooks | Publish one completed edit with affected IDs, separate from selection/view notifications. |
| Strategy | `PatternTextureGenerator` implementations; `FurnitureGeometryBuilder<T>` implementations | Select interchangeable rendering algorithms through typed construction. |
| Adapter | `LegacyPlanReader`, `BrowserPlanStorage`, `HttpPlanStorage`, `EmbeddedPlanSource` | Keep legacy format and platform behavior outside domain classes. |
| Facade | `SceneEngine`, `EditorSession` | Offer concise application entry points while each collaborator retains a specific responsibility. |

No generic command bus, global service locator, or framework for registering every class is required. The command receiver is `EditorSession`; constructors wire concrete collaborators. Visitor interfaces are a deliberate closed contract for domain behavior families, while asset catalog entries can grow without changing that contract.

Domain objects do not create Three.js meshes or React controls. Visitor implementations live in the consuming layer. This preserves class-based polymorphism without giving every entity three unrelated implementation dependencies.

## Readable collaborations

The public editing code should express a user's action:

```ts
editor.execute(new SetLightIntensity(selectedLightId, 1.4));
editor.execute(new ApplyRoomFinish(selectedRoomId, finish));
editor.execute(new SplitWall(selectedWallId, distance));
```

`SetLightIntensity` resolves the required `Luminaire`, calls its validated behavior, and returns a replacement document plus the changed IDs. `EditorSession` publishes that result once and records its previous/next snapshots in `EditHistory`. It does not implement lighting rules, mesh updates, JSON conversion, or HTTP calls.

`ApplyRoomFinish` resolves interior wall faces and column faces through `WallTopology` and surface capabilities, invokes the corresponding objects' finish methods, and produces one document. The opposite face of a neighboring room stays unchanged. The operation cannot partially commit.

`SplitWall` asks the aggregate to perform a structural operation. Initially reject splitting through an opening/cavity footprint. Preserve world placement, side orientation, trims, source column references, and room relationships. One command produces one history entry and one dependency change set.

On loading, `PlanCodec` validates and normalizes the external file, then `PlanElementFactory` constructs domain objects. On rendering, `element.accept(sceneNodeFactory)` produces the correct node. On selection, `element.accept(inspectorPresenter)` selects focused React sections. On export, `element.accept(planEncoder)` produces canonical serialized data. There is no parallel DTO model being edited alongside the domain objects.

Each collaboration has one entry point, one owner, and typed return values. No caller has to know which callbacks to fire after changing a field.

## Renderer class model

`SceneEngine` coordinates canvas attachment, document reconciliation, and view changes. It delegates camera/navigation, picking, and overlays to focused classes. A `SceneNode<T>` owns the stable Three.js root, resource leases, pick registrations, and reconciliation of one domain element.

Concrete node families are `WallSceneNode`, `OpeningSceneNode`, `FurnitureSceneNode`, `RoomSceneNode`, and `ColumnSceneNode`. `SceneNodeFactory` is a visitor; it binds typed domain classes to their node/builders in one place. `FurnitureSceneNode<Luminaire>` receives a luminaire geometry builder; it does not inspect asset-name substrings or choose a domain class again. There is no need for a second parallel taxonomy of three factories and fallback string checks.

`WallMeshBuilder` owns a readable construction sequence: outline/junctions, hosted voids/recesses, face classification/UVs, then trim attachments. Extract and test the existing algorithms behind those stages. General CSG is not required for the class design and should be introduced only for an identified unsupported shape.

`MaterialPool` owns reference-counted leases of materials/textures. `PatternTextureGenerator` strategies own each supported procedural pattern and use shared canvas drawing helpers. Drawing algorithms can contain ordinary functions; they belong behind a clear class contract. Normalize cache keys with all finish/render options and catalog revision. Seed procedural variation for visual regression tests.

Node reconciliation distinguishes changes: transforms retain geometry/root identity, finish edits update leases, dimensions/hosted features rebuild geometry, topology updates rebuild affected neighboring nodes. Include dependency closure: wall junction neighbors, openings, room surfaces, trim/recess attachments, and column cutouts. Stable roots let gizmos remain attached while children are replaced.

Dispose owned geometry once; release shared materials/textures rather than disposing another node's resources. Include model assets, lines, labels, environment render targets, and all lifetime registrations. Pool retention for zero-reference resources is bounded.

`PickRegistry` maps leaf meshes to typed element/subsurface targets and owns candidate registration. `PickingController` applies the shared hit-visibility policy. Layers handle whole-object exclusions; a visibility predicate handles shader-clipped parts, cutaway height, ancestor visibility, isolation, and invisible finishes. A WeakMap does not enumerate candidates or free GPU resources. Both shells use the same controller.

Render scheduling is a later, measured change: render during damping, movement, dragging, animation, and async asset completion; invalidate on resize/selection/settings changes; stop GPU renders when fully idle. These rules remain the scheduler's responsibility.

## Application, UI, and persistence classes

Saving requirement, 15 October: saving is manual. Do not reintroduce debounced autosave, automatic edit backups, or unload writes during the refactor. A modal loading widget blocks all application input, including viewport navigation/manipulation, for the complete save operation. Success or failure releases the lock; failure retains dirty edits and offers retry. Persistence queues below protect explicit calls; they are not automatic save triggers.

`EditorSession` owns the current immutable `PlanDocument`, command execution, and edit publication. It uses `EditHistory` for undo/redo. `SelectionModel` owns a single identity/subtarget selection; `ViewportState` owns view settings. They are not additional document models. A delete or split validates/remaps selection by ID against the committed document.

`InspectorPresenter` implements the visitor and supplies the appropriate focused sections: transforms, surfaces, luminaire settings, wall structure, door settings, column faces. React components render those sections and submit commands. Local text drafts remain UI state; there is no generic `setProperty(key: string, value: any)` bypassing class invariants. Inspector metadata does not live on domain classes as React-specific widget definitions.

`PlanCodec` performs symmetric canonical encoding/decoding. `LegacyPlanReader` handles dictionary/array shapes, upstream units and aliases; migrations preserve unknown source metadata in immutable codec-owned extensions. HView schema versions are independent from upstream `v`. The factory receives validated input and constructs real classes; deserialization cannot produce unvalidated plain objects cast as instances. Decoding must not mutate or alias its input.

Move column inference from `ThreeSceneService` to a deterministic legacy normalization collaborator, run once before publication. Preserve authored columns, finishes, stable identities, chimneys and source wall links. Structural commands update affected topology afterward. Ambiguous tiny wall clusters produce diagnostics; canonical documents do not run legacy guesses. The renderer never writes `plan.columns`.

`PersistenceController` takes a captured session/content identity and serialized payload, queues writes through a `PlanStorage` adapter, and acknowledges that exact snapshot only when the required target confirms it. Browser backup and HTTP success are distinct outcomes. Dirty state compares current document content identity with confirmed saved content identity; monotonic event revisions alone mishandle undo back to a saved document.

Tests cover edits during save, ordered queued writes, undo/redo, document reset/replacement during save, quota failures, static hosting without development endpoints, and document-scoped recovery. A stale save acknowledgment cannot clear a newer edit, and an older payload cannot overwrite a newer queued save. Standalone embedded input takes precedence over unrelated cached plans. Failed unload beacons do not establish save success.

`ApplicationRuntime` constructs and owns the session, renderer, presenters, and adapters through explicit constructors. React accesses a typed runtime context. The readonly viewer uses the same document, codec, engine, picking, and presentation logic, with no editor mutation capability. Runtime disposal tears down subscriptions, timers, DOM listeners, frame callbacks, and GPU resources.

## Implementation sequence

| Delivery | Build and replace | Proof required |
| --- | --- | --- |
| 1. Confirm current baseline and remaining integrity repairs | Start from current `main`; reuse the tests and fixes in #1/#2. Verify pinned test/build dependencies and baseline fixtures. Recheck asset-key precedence, save acknowledgment/failure behavior, empty-column export, HTML injection, and interaction subscriptions; repair only remaining defects. | Existing fixes remain covered, remaining reproductions pass expected-behavior tests, builds succeed from a locked install, and repeated mounting leaves one interaction subscription. |
| 2. Implement one class-based vertical slice | Build the domain base, `Luminaire`, factory/codec path, `SetLightIntensity`, session/history, scene factory/node, and inspector presentation for a fixture. Keep the prototype independent of production state until its lifecycle is complete. | Follow one light from file to actual domain instance, edit, render, undo, save, and reload. Domain validation is exercised through public APIs; UI/engine do not mutate fields. |
| 3. Complete the domain and switch document ownership | Implement remaining concrete classes and aggregate/topology rules. Migrate codec and every manager mutation to commands/domain methods. Switch the running editor's authority to `EditorSession`. Extract column normalization. | All supported entity types/features round-trip; aggregate references stay valid; rendering a frozen document makes no writes; room finish/split/deletion/history gates pass. |
| 4. Complete renderer ownership | Replace each active builder/rebuild path with node reconciliation and material leases; extract wall pipeline and texture strategies without altering calculations. Replace editor/viewer picking. | Stable roots for transforms; geometry/UV/material group fixtures; seeded browser image checks; shared resources survive another node's removal; removed nodes cannot be picked; memory plateaus after warmup. |
| 5. Complete presentation/composition/export | Route all inspectors through presenters and commands, replace global DI, use one runtime in both shells, and make standalone packaging deterministic. | Both standalone products work offline; readonly viewer rejects mutation; subpath hosting works; lifecycle cleanup is complete; generated artifacts do not change tracked inputs. |
| 6. Readability and measured optimization | Enforce domain/UI/engine import boundaries; remove obsolete public APIs, DTO projections, factories, listener channels, unused domain classes, and generated templates. Profile render scheduling/material work. | Every pattern has one identifiable dispatch/construction site; no old imports remain; an edit is traceable without name heuristics, direct DTO mutation, or manually firing callbacks. Browser behavior and builds remain covered. |

Delivery 2 demonstrates the architecture; it is not a second editable production model. Delivery 3 requires a cohesive ownership switch. During renderer/presentation migration, any temporary legacy DTO projection is a read-only, on-demand projection from domain objects, never a mutable store, and is deleted with its last consumer.

## Concrete replacement list

| Existing responsibility | Target classes | What must disappear |
| --- | --- | --- |
| Mutable domain wrappers plus active DTOs | `PlanDocument` aggregate and behavioral `PlanElement` subclasses | Wrapper `fromEntity` copies, public mutable entity fields, and competing editable DTO state. |
| Repeated asset/domain classification | `AssetCatalog`, `PlanElementFactory`, `SceneNodeFactory` visitor | Duplicate alias maps, broad fixture-as-light inference, name-based reload selection, factory chains. |
| Manager mutations/listeners/selection/save | `EditorSession`, commands, `EditHistory`, `SelectionModel`, `PersistenceController` | Raw setter mutations, overlapping callback protocols, dirty boolean, save/reset implementation inside plan manager. |
| Domain rendering methods and scene monolith | Nodes, typed geometry builders, `SceneEngine` | Domain Three.js imports, renderer writes to document, category-wide rebuilding for ordinary edits, undocumented userData ownership. |
| Material/canvas monolith | `MaterialPool`, texture strategies | Inline unmanaged materials, unbounded unreleased caches, copied canvas initialization, patterns buried in scene mutation. |
| Inspector-specific business rules | Domain class methods, commands, `InspectorPresenter` | UI topology math, multiple ways to edit the same object, string-keyed generic property mutation. |
| Token-based service lookup and viewer wiring | `ApplicationRuntime`, platform adapters | Global container/tokens/useService, separate viewer interaction/domain behavior, discarded unsubscribe callbacks. |

The original implementations remain available in Git; they do not remain as permanent runtime alternatives. The final design must make construction, editing, inspection, rendering, encoding, and disposal traceable through named classes. A new class must own behavior, an invariant, an algorithm, or a resource lifetime; a forwarding class with no responsibility is not progress.

## Compatibility and verification constraints

Preserve sliding doors, French windows, chimneys, all wall edge/baseboard finishes, named furniture parts, invisible materials, authored columns, wall-native cavities and legacy recess furniture, light configurations, and asset replacement transforms/dimensions. File length is a review signal, not an arbitrary splitting rule.

Characterize legacy round trips with documented numeric tolerances and explicit extension-field assertions. Test removals and empty collections. Reject unsupported future HView versions clearly. Legacy split cleanup must verify lineage rather than deleting any parent with a suffixed child. Keep explicit legacy export available until supported formats are covered.

The root sample is the baseline template and public sample the current development working file; preserve those roles until adapters move user data out of distributable assets. Make standalone build input explicit.

Standalone packaging uses a stable shell and separately compiled JS/CSS/data/assets. Escape `<` and Unicode line separators in plan, catalog, and asset JSON; avoid replacement-string token interpretation. Validate a unique injection location. Do not import generated full-editor HTML into the editor entry that generated it: that creates recursive bundling. Supply artifact data through a host adapter and reconstruct standalone exports from packaged payload. Two consecutive builds/exports must have stable size and require no runtime template fetch, fonts, texture, or model download.

Reuse current `main`'s unit and Playwright suites; they were absent from the older supplied checkout used for the source audit. Extend coverage for domain constructors/behavior, factory/visitor dispatch, command atomicity/history, controlled-promise save races, scene ownership/visibility, browser workflows, and offline artifacts. Use browser measurements for GPU memory and actual target iPad behavior. Do not claim the source audit's build checks prove browser parity.

## Verified source audit

The following findings were verified before this revision. They establish regressions and compatibility requirements; they are not a substitute for the class-based architecture above.

### Repository findings

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

### Checks performed on 14 October

- `./node_modules/.bin/tsc --noEmit`: passed.
- Vite production build to a scratch output directory: passed; main JS is 1,261.65 kB minified / 328.56 kB gzip and triggers a chunk-size warning.
- Standalone build in an isolated source copy: passed using the existing externally installed tsx loader; viewer HTML 17.43 MB, editor HTML 17.88 MB, 30 texture assets embedded.
- Node audit harness using bundled actual parser/exporter/manager/persistence code: reproduced the four correctness defects and parser aliasing above.
- Root sample parses to 60 walls, 12 rooms, 119 furniture items, and zero explicit columns before renderer detection. This is a fixture baseline, not a target column count.

No browser behavior, GPU memory benchmark, screenshots, or E2E tests were run. The standalone build check is not proof that a clean `npm ci && npm run build` is reproducible: tsx is not declared in this project's dependencies, and the build script imports transitive esbuild.
