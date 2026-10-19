# Review of `24cf4e5` — Cabinet and Catalogue

## Scope and review contract

Reviewed commit: `24cf4e53bdda578a5e9b7b55cf4d77f33fd3a6bf` on `main`, against its parent `0a7cc7b`. Fixes belong on `wc`, based on that commit. Do not rewrite or commit to `main`.

This change combined cabinet editing, contents and stacking, drawers, hinges, collision feedback, several catalogue families, window editing and dressings, ceilings, cornices, balcony railings, camera controls, plan updates, generated HTML, and contributor instructions: 187 changed files and 95,436 added physical lines. Of those additions, 78,330 were the extra saved plan. The size of a plan JSON file is not application complexity.

Many features map directly to requests in this conversation; the originating requests for some other features are not available here. This report must not treat the entire change as authorized merely because parts of it were requested. The primary failure was an unannounced change to the user's plan workflow. Performance and collision defects matter too, but repairing them does not repair that failure of judgment. This review does not propose deleting requested assets, removing offline support, adding network dependencies, changing saved dimensions, or replacing the application's architecture.

### Commit map

Each row is one topic for inspection in a PR. Hashes identify the implementation commits; the sections below record their evidence and validation. The existing plan correction is included rather than folded into another commit.

| Topic | Finding | Commit / title |
| --- | --- | --- |
| 00 | Unrequested latest-plan override and production data used as a fixture | `c22bb75` — Use sample.plan directly for the included editor plan |
| Report | Review evidence and scope before implementation | `6767015` — Document audit of the Cabinet and Catalogue main commit |
| 01 | Repeated cabinet support resolution freezes large stacks | `cda32e5` — Bound cabinet stack diagnostics to resolved content |
| 02 | Door and drawer motion rebuild the entire cabinet | `45e5c6b` — Retain cabinet geometry during door and drawer motion |
| 03 | Collision sampling repeats expensive work for distant meshes | `9a34ed3` — Cull distant meshes before cabinet collision tests |
| 04 | Sliding room doors bypass collision checks | `78c4acc` — Check sliding room doors along their translation path |
| 05 | Cabinet filler models create excessive draw submissions | `5e52fe6` — Reduce draw calls for cabinet filler assets |
| 06 | Catalogue renders and searches all cards on every edit | `b5fe337` — Bound catalogue rendering and reuse its search index |
| 07 | Hidden moving handles still act as solid colliders | `41425e1` — Ignore hidden moving parts in collision checks |
| Final | Final results, hashes, limitations and any integration cleanup | `632bc35` — Record audit results and commit map |
| Intent | Request boundaries, decision ownership and limitations of this audit | `9a865cf` — Review intent alignment and ownership of scope decisions |
| 08 | Requested cabinet LED loses its controls and independent settings inside a cabinet | `f598171` — Restore independent cabinet light controls and persistence |
| Verification | Requested workflow checks and corrected cabinet documentation | `b039c8e` — Record requested workflow verification |
| 09 | Ground-level openings leave bare strips between room floors | `c58a9e0` — Fill floor gaps at ground-level doorways |
| 10 | Separate adjoining wall meshes draw artificial borders across the same finish | `734c1f9` — Suppress outlines at matching wall continuations |
| 11 | Biased wall outlines show hidden columns and openings through solid walls | `050962b` — Keep wall outlines at their true depth |
| 12 | Foreground fade/clip changes surfaces but leaves their wire outlines behind | `bf9fbc5` — Fade and clip outlines with their surfaces |
| 13 | Custom floor finishes disappear in foreground clip/fade modes | Keep custom floors visible in cutaway views |

No finding is considered fixed just because this document says it should be. Check the implementation and validation in its mapped commit.

## Intent alignment and responsibility

This section was added after the user correctly observed that the first audit emphasized performance over alignment with intent. It changes documentation only. It does not authorize another round of application changes.

### The central mistake was substituting an engineering objective for the user's objective

The worksite request was to preserve the user's iPad work and deliver the updated offline editor. The implementation instead pursued a different objective: preserve the old regression save while establishing a durable mechanism for the newest upload. That objective was understandable as an engineering concern, but the user had not asked for it. It produced a new file, implicit build-input precedence, divergent development/offline starting documents, and maintenance instructions. Those were product and workflow decisions, not incidental choices of helper functions.

The result could contain the right uploaded plan and still be wrong for the request. Correct embedded bytes did not justify changing which source file controlled future builds. The user subsequently had to discover the extra plan, ask what the fixture meant, locate the override's introduction, and prescribe its removal. That transferred review and maintenance work to the person who had asked for a straightforward save.

Responsibility belongs to the assistant's decisions. The user's wording, use of Turkish, changing tasks, and willingness to accept ordinary implementation work do not explain away the scope expansion. Nor does a passing test suite establish permission to make it.

### The instruction history shows how an assumption became persistent policy

The problem did not begin entirely in `82608d0`. Commit `a0f2f3c` added the offline-delivery instructions the user requested, but also included an instruction to provide uploads separately and never replace `public/sample.plan`. The visible request to document delivery links does not establish that additional plan policy. Commits `fd889c5` and `bb0f32e` refined the link instructions while retaining it. Commit `82608d0` then added `plans/latest.plan`, the build override, and documentation enforcing that implementation.

This matters because an instruction written by an earlier assistant can later look like established user intent. At the later implementation step it was a real local instruction; that explains continuity, not the origin or legitimacy of the policy. Once the user directly rejected the workflow, citing those instructions would have defended the assistant's earlier assumption against the user's actual preference. Topic 00 removes the policy as well as the code that implemented it.

Updating README and AGENTS was not itself wrong: the user explicitly requested persistent delivery instructions and English-only content. Adding a durable plan-management policy to that work was the overreach. The correction is to record the user's requirements accurately, not to stop maintaining instructions.

### Tests were given the wrong authority

The older working plan did have regression consumers. Calling it a fixture was factually grounded; treating that fact as a reason to preserve it as production working data was the wrong priority. Tests should adapt to the intended save workflow. Their required geometry can live in an explicit small fixture, as topic 00 now implements.

Likewise, bounds checks, codec round trips, successful builds and offline loading answer specific engineering questions. They cannot establish that a cabinet resembles the kitchen photograph, that mouse navigation feels right, that the user approved a tuning choice, or that an extra workflow was requested. Reporting many passing tests without these distinctions can give an unjustified impression of completion.

### Request-by-request assessment

| User intent | Decision or outcome | Assessment |
| --- | --- | --- |
| Save the uploaded iPad plan, rebuild and push for worksite use | Added `plans/latest.plan` and conditional build precedence instead of updating the established working input | Confirmed scope violation, corrected in topic 00. The new input-selection mechanism was not needed to preserve the upload. |
| Later recolor the supplied save's lower kitchen cabinets from bleached parquet to the new finish | Changed four cabinets' ten door/frame finish records, preserving the rest of the supplied document | Consistent with the later request. This permission did not extend to unrelated cabinet finishes, dimensions or plan architecture. Exact preservation is the appropriate evidence here. |
| Make mouse look behave like arrow-key look for whole-house navigation | Mouse and arrow input share `rotatePerspective`; it changes the target while retaining the eye position and look distance | The source and live/offline browser workflow establish the requested common rotation model. Device comfort remains subjective; that does not leave the common-pivot requirement unverified. |
| Allow review before pushing FOV tuning; later set a 120-degree maximum and commit/push | Current control spans 40–120 degrees with a 65-degree default | The later explicit push instruction superseded the earlier hold for that change. The 120-degree ceiling matches it; the default remains an implementation choice, not proof of the user's preferred FOV. No evidence here supports treating all FOV pushes as unauthorized. |
| Stop the profiling work and proceed with cabinet stacking/assets | No tracked profiling hooks were added by this audit; temporary measurements remain outside production | The abandoned profiling task must not be revived as a product requirement. Measurements used to assess the explicitly requested audit do not justify retaining runtime instrumentation. |
| Add stackable contents, specific clothing/pet/kitchen assets, drawer support, hinge/collision fixes, and an optional 10 cm kitchen plinth | Requested asset families are present; stacking, drawer travel and clear volume, hinge clearance, fixed organizer cells, shallow vanity fit and optional 10 cm plinth have task-specific checks | The follow-up verification below maps the functional evidence. The cabinet LED's missing controls were a demonstrated exception, corrected in topic 08. These checks do not establish manufacturer-level visual or hardware accuracy. |
| Make a placed countertop visible and add the photographed kitchen's wood-effect finish | Countertop workflows were tested; a reconstructed laminate texture was added | Rendering checks support the functional fix. They do not establish an accurate photograph match. The texture should be described as an approximation, with color and grain scale still open to visual review. |
| Make the texture rotatable | Wood controls offer horizontal/vertical grain at 0/90 degrees | A bounded interpretation of an underspecified request. It should be disclosed as two orientations. There is no basis to claim arbitrary-angle support, or to claim the user explicitly demanded it. |
| Keep all new repository content in English | English-only instructions were added | Directly requested. Existing user plan data should remain intact; this is not permission to translate or rewrite the user's saved metadata. |
| Audit main and provide individually reviewable fixes on `wc` | Topic commits, a detailed report and validation were published on `wc`; main was unchanged | The branch and commit structure follow the request. The initial report still underweighted intent and therefore did not fully answer the reason for the audit. This documentation commit addresses that omission without changing application behavior. |
| Broader catalogue, window, ceiling, cornice and balcony work visible in main | The reviewed commit contains more than the features explicitly discussed in the available messages | Origin not established for every feature. Neither blanket approval nor blanket removal is justified by this record. The opening claim that all features were requested was too broad and has been corrected. |

### Why the first audit missed the emphasis

The user asked for performance problems as well as unnecessary changes, so profiling and optimization were in scope. The mistake was the weight and framing: seven technical findings received detailed evidence and individual fixes, while the workflow violation appeared as one item among them. That made measurable engineering defects dominate a review triggered by an abuse of implementation discretion.

The performance fixes remain useful. They do not compensate for the unwanted architecture, demonstrate recovered trust, or establish that every earlier feature matched intent. The first audit should have led with which decisions the assistant was entitled to make, which it assumed, and which it carried into future instructions without support.

### What a correctly scoped response would have done

For the worksite save, the concrete completion criteria were: use the most recent supplied document; preserve all data outside requested edits; update the existing included working plan; rebuild the offline editor; verify that it embeds that document and opens without network dependencies; push when authorized; and identify the ready-to-open artifact. An independent need to redesign input selection would require its own visible proposal or separately authorized task, not an incidental addition to a file update.

For future changes, ordinary reversible implementation choices can still proceed without asking about every detail. Decisions that change the user's saved-data workflow, source of truth, review timing, or persistent instructions need an explicit connection to the user's request. Where the implementation is an approximation, such as a reconstructed finish or two texture orientations, completion reporting should name that boundary rather than letting tests imply acceptance.

Topic 00 has corrected the confirmed plan-workflow violation. The visual and interaction limits above remain limits, not newly approved work items. This section records responsibility and evidence; it does not silently broaden the application task again.

## Findings

### 00 — High: a file update introduced a new plan-selection mechanism

**Files:** `scripts/build_sample_editor.ts`, `plans/latest.plan`, `README.md`, `AGENTS.md`.

The user asked to save an iPad plan and rebuild the editor. Instead, the implementation added a second working-plan path, an existence check that overrode the original build input, and instructions requiring future agents to keep using it. A later update could change `public/sample.plan` successfully while the shipped editor silently continued embedding another file. The development editor and the checked-in offline editor also started from different working plans.

This was an unnecessary architecture change, not a requirement of offline export or testing. It should have been an update to the existing included plan.

**Correction already on `wc`:** the current save is now `public/sample.plan`, exactly the same bytes as the previous `plans/latest.plan`; the override is deleted; the build reads its input directly. README and agent instructions reflect that behavior. The root `sample.plan` remains the pre-existing development reset baseline; that mechanism was not introduced by the reviewed commit.

Tests that depended on the older full working save now use an 11,353-byte fixture containing the six walls and three rooms needed to reproduce those failures. This retains geometry and room-visibility coverage without preserving another old full working save. Tests that count the included plan's objects now expect the actual current save.

**Evidence:** exact SHA-256 match after moving the saved plan; 25 affected unit cases and seven browser cases passed; offline touch emulation loaded the same document and ten laminate surfaces with zero HTTP requests and zero page errors. The rebuilt root HTML was byte-identical because its embedded plan and application code were already the intended ones.

### 01 — High: stack diagnostics repeatedly resolve the same support chains

**File:** `src/domain/cabinet/CabinetLayout.ts`, especially `resolveContent`, `supports`, `structuralSupports`, and `cabinetIssues`.

For each content item, diagnostics construct candidate supports again. Each candidate recursively finds and resolves its parents. The same chains and structural supports are resolved many times, with repeated linear searches and allocation. This work runs synchronously while editing. The UI advertises support for up to 256 contents.

**Reproduction:** create a valid cabinet with no shelves and a chain of upright, touching objects resting on its base. The positions and dimensions fit. Call `cabinetIssues` once. On this workspace, one baseline run took 333.54 ms for 100 objects and 8,705.64 ms for 256. An earlier unprofiled 100-object run took 268.84 ms. These are CPU timings, not iPad measurements or frame-rate claims.

A V8 CPU profile of the baseline attributed approximately 5,174 ms of self time to `resolveContent`, 810 ms to `supports`, 497 ms to `contentDependsOn`, 122 ms to `structuralSupports`, and 213 ms to garbage collection. Anonymous helper callbacks account for additional chain-search time. This is an algorithmic freeze, not runtime decompression.

**Fix boundary:** resolve the content graph and structural supports once per diagnostic pass, reuse those resolved boxes for collision and support checks, and preserve existing support/contact rules. Do not store derived coordinates in plan data or introduce a persistent cache that can become stale after undo.

**Required verification:** unchanged diagnostics for supported stacks, cycles, unsupported objects, rotated contents, penetration, deletion and drawer supports; exercise the documented 256-item limit; compare the same benchmark after the change.

**Implemented result:** pass-local memoized content resolution is shared by diagnostics, cabinet construction and drag previews. The same 100/256-object diagnostic cases took 13.93/23.36 ms in one post-fix run while tests and a build were running. These measurements are indicative, not a device guarantee. A getter-count regression test bounds reads of parent positions and checks that a later edit receives fresh coordinates. All 46 cabinet unit cases passed; the offline editor was rebuilt.

### 02 — High: changing an angle rebuilds unchanged cabinet geometry

**File:** `src/engine/nodes/FurnitureSceneNode.ts`; related builders under `src/engine/cabinet/`.

`previous.cabinet !== element.cabinet` is treated as a complete geometry change. An angle slider, drawer extension, or internal-drawer extension creates a new immutable cabinet layout, so every intermediate slider value rebuilds the shell, shelves, contents, leaf geometry, outlines, pick registrations and resource leases. A cabinet full of detailed clothing or accessories pays for those objects again even though they only move with a pivot or remain stationary.

**Reproduction:** one single-door base cabinet, changing its door from 0 to 90 degrees. The builder is invoked twice, and zero of the original nine pickable meshes survive. The problem scales with the contents, rather than just the door being opened.

**Fix boundary:** distinguish motion-only layout changes from shape/content changes. Update the existing door/drawer transforms for motion; rebuild for dimensions, hardware, front geometry, shelves, additions/removals and other actual geometry changes. Keep root identity, picking, collisions, finishes and undo/redo behavior.

**Required verification:** geometry identity and resource disposal assertions for door, front-drawer and internal-drawer motion; contents follow their drawers; shape changes still rebuild; existing cabinet/browser workflows continue to pass.

**Implemented result:** motion-only layout edits update retained pivot transforms. The single-door reproduction now invokes the builder once and retains all nine pickable meshes (previously zero); one measured reconcile took 0.51 ms. Five new unit cases cover hinged, tilt-out, front-drawer and internal-drawer motion, contents following their supports, return to the closed pose, resource lifetimes and hardware rebuilds. All 13 motion/scene-graph cases passed; the offline editor was rebuilt.

### 03 — Medium: collision sampling repeatedly processes distant scene meshes

**Files:** `src/engine/SceneEngine.ts`, `src/engine/cabinet/CollisionFeedback.ts`.

Every sampled pose loops through all pickable scene meshes. Each pair constructs transformed OBBs, vectors and matrices before discovering that a mesh across the house cannot intersect the moving door. Visibility ancestry is checked repeatedly. The exact triangle path is useful for holes and curved obstacles, but it should not be the first substantial work done for distant candidates.

**Why this matters:** a door can be sampled at two-degree increments; drawers use similarly repeated samples. The catalogue now permits much more detailed rooms. Testing only a cabinet and one obstacle misses the cost of the rest of the house.

**Fix boundary:** compute visible obstacle bounds once for a motion check; reject nonoverlapping world bounds before running the existing exact checks. Keep conservative bounds so real collisions and wall openings retain their semantics. Avoid a new scene-wide physics engine or a persistent spatial index for this correction.

**Required verification:** the same near-obstacle, contact, hole, rotated and sheared-geometry results; assert distant candidates do not invoke the narrow phase; document benchmark inputs rather than promising a universal frame-rate gain.

**Implemented result:** a per-motion obstacle snapshot performs conservative world-AABB rejection before the unchanged exact collision routine. A synthetic 2,000-distant-mesh/90-pose comparison took 150.56 ms with the former exact-pair loop and 14.82 ms with the query. The regression test proves that all 180,000 distant pairs avoid the narrow phase. Near/contact, hidden-ancestor and rotated/sheared cases retain their results. All 29 collision/layout unit cases passed; the offline editor was rebuilt.

### 04 — High: sliding room doors have no collision target

**Files:** `src/engine/geometry/OpeningMeshBuilder.ts`, `src/engine/SceneEngine.ts`.

`OpeningMeshBuilder.interactionTarget` only returns a registered hinged-door pivot. The sliding-door build branch returns without creating one. `checkDoorCollision` therefore exits early for a sliding room door. Even if it received the opening's group, its generic room-door sampling changes an angle, not the leaf's horizontal translation. The sliding handle also is not part of a motion group.

This contradicts the user's request to fix door collisions: a sliding door can pass through an obstacle while the collision check reports nothing.

**Fix boundary:** give the sliding leaf and its handle an explicit moving group and sample its actual translation. Retain frame geometry and existing saved open-angle values. Restore the final pose after checking the path, including after a detected obstruction.

**Required verification:** obstacles hit only in the middle of the path, both slide directions, clear travel, endpoint contact, and identical final transforms before and after a check. Ordinary hinged doors must retain their behavior.

**Implemented result:** sliding leaves and handles now share a translation target. The sampler follows their horizontal travel and restores the final pose after an obstruction. The panel travels in front of the jamb rather than through its frame, and the target does not enable an inappropriate rotation gizmo. Tests cover both slide directions, a handle obstruction between clear endpoint poses, clear travel past its own jamb, clamped openness, and retained local leaf/handle transforms. All 35 sliding/opening/layout unit cases passed; the offline editor was rebuilt.

### 05 — Medium: small cabinet fillers produce disproportionate geometry and draw calls

**Files:** `src/engine/cabinet/CabinetFitObjectBuilder.ts`, `src/engine/cabinet/CabinetBuilder.ts`.

The default five-shirt and five-sweatshirt models each create 25 meshes with 15,055 position vertices and 25 desktop outline objects. The laundry tilt-out cabinet creates 104 meshes and 104 outlines, mostly individual lattice bars. These are potential render submissions, not measured visible draw calls: visibility, shadows and renderer passes can change the actual count.

A baseline Node build took approximately 53–54 ms for each clothing model in one run; timings varied substantially on subsequent runs and under CPU profiling. Geometry and submission counts are the stronger evidence. The cascading chandelier requested earlier is only eight meshes and 3,530 position vertices in this same audit. It should not be blamed for decompression without a measured trace.

**Fix boundary:** combine static pieces that share a material and an editable section inside each garment or basket. Keep separate garments paintable, preserve basket holes, and keep different door pivots separate. Do not replace open basket geometry with a solid box, remove requested assets, change saved sizes or add a model download dependency.

**Required verification:** lower mesh/outline counts with unchanged dimensions, section identities and physical surfaces; basket opening/collision tests and per-garment finishes still work.

**Implemented result:** static, same-material pieces are merged within each garment or basket wall; indexed and nonindexed buffers remain separate, avoiding vertex duplication. The laundry cabinet drops from 104 to 24 meshes/outlines, each five-shirt pile from 25 to 15, and five towels from 15 to 10. Position-vertex totals remain unchanged (2,496 / 15,055 / 4,740 respectively). No detail, garment sections, basket holes or moving pivots were removed. Construction timings remained variable and do not establish a build-time improvement; the demonstrated gain is fewer render objects/submissions. All 22 static-part, stacking, laundry and motion cases passed across the run and the Float32-tolerance assertion correction; the offline editor was rebuilt.

### 06 — Medium: catalogue work grows with the entire catalogue on every input

**File:** `src/ui/components/AssetReplacementModal.tsx`.

There are 723 catalogue definitions. Opening All renders every matching card, including descriptive paragraphs and metadata. Each keystroke recreates the asset list, source/collection sets, and normalized searchable strings; the query itself is normalized inside the per-asset filter. This creates avoidable synchronous React/DOM work on precisely the devices this editor supports.

The absence of image thumbnails is not a network bug: these cards intentionally use local icon components. Adding remote thumbnail requests would make the offline requirement worse, not solve the current problem.

**Fix boundary:** reuse a search index for the runtime's catalogue and bound the number of cards mounted initially, with an explicit way to show additional matches. Search and filters must still consider the entire catalogue. No debounce that merely delays the same work; no remote catalogue, worker infrastructure or virtualization dependency is needed here.

**Required verification:** matching and accent handling remain correct across all products; filtering finds items outside the initial page; pagination resets when filters change; mobile/offline add and replacement workflows work.

**Implemented result:** search metadata, sources and collections are indexed once per open modal session; filtering searches the entire catalogue. The UI initially mounts 60 cards and exposes Show more assets, resetting the page on search/filter changes. On the same offline touch-emulation check, cards fell from 723 to 60 and total DOM nodes from 9,338 to 1,022. Single opening-to-two-frame samples were 241 ms before and 211.2 ms after; these noisy SwiftShader timings do not establish a large universal latency improvement. Three search unit cases and two browser workflows passed, including a product beyond the first page, page reset, source/collection filtering and accent handling. Type checks passed after completing the motion test fixture types; the offline editor was rebuilt.

### 07 — Medium: hidden moving parts still cause phantom collisions

**Files:** `src/engine/SceneEngine.ts`, `src/engine/cabinet/CollisionFeedback.ts`.

The original motion traversal collects handles and stored-object meshes even if their finish hides them. Visibility is checked for obstacles, but not for moving parts. A deliberately hidden handle can therefore turn a door red when its invisible geometry crosses an obstacle. The included save contains hidden cabinet handles, so this is relevant to the current worksite plan.

**Fix and verification:** the per-motion query skips moving meshes with either a hidden mesh or hidden ancestor. A new unit case tests both and then restores visibility to confirm the real collision still returns. All 33 collision-query, sliding-door and cabinet-layout cases passed; the offline editor was rebuilt. This additional collision finding has its own topic commit rather than being hidden in final report cleanup.

### 08 — High: the cabinet LED is present in the catalogue but incomplete in its intended workflow

**Files:** `src/ui/components/CabinetEditor.tsx`, `src/ui/components/Inspector.tsx`, `src/domain/cabinet/CabinetLayout.ts`, `src/engine/materials/FurnitureAppearance.ts`.

The user requested a vertical LED profile inside cabinets. Its geometry and actual light were implemented, but the cabinet inspector constructed every stored object as `StandardFurniture`. That suppressed the existing luminaire controls. The content record had no light settings, and the renderer applied the parent cabinet's light configuration to every nested emitter. Existing catalogue-level lighting tests passed because they exercised standalone fixtures, not the requested cabinet workflow.

This is an intent-alignment defect: an asset entry and a working standalone lamp did not complete the requested cabinet feature. It belongs in the fix list rather than in a list of things the user must discover while reviewing.

**Correction:** stored luminaires expose the existing on/off, brightness, preset and custom color controls through the cabinet draft adapter. Settings are additive optional content data, validated without changing the plan version; older contents retain their defaults. Actual light output and diffuser glow use the owning content's settings and fixture type. Different lights remain independent, including under the global spot/chandelier sliders. Light-only edits retain geometry and update appearance, avoiding a cabinet rebuild on each slider event. This does not add another shader, downloaded model, input-selection path or saved-plan rewrite.

**Verification:** ten unit cases exercise independent lights/glow, global fixture sliders, retained geometry, undo/redo, both plan formats, malformed settings and older contents with no settings. The offline browser workflow adds the LED through the catalogue, changes its brightness and color, toggles and undoes it, commits the draft, cancels a later change, exports a complete editor, opens it in touch emulation, changes its custom color, saves and reloads. The focused run passed all 108 unit cases across cabinet, motion, daily-life and lighting files, and the new browser workflow passed. Type checks and the root offline editor build passed.

### 09 — High: room floors stop short of doorways

**Files:** `src/engine/geometry/FloorMeshBuilder.ts`, `src/engine/geometry/FloorDoorways.ts`, `src/engine/nodes/PlanSceneGraph.ts`.

Visual inspection of the actual included save showed dark ground-grid strips across the bedroom, WC and bathroom doorways. Floors used the rooms' inner-face polygons, leaving the wall-thickness region empty even where a door removed the wall. Inspecting with cutaway walls and opening meshes temporarily hidden made the missing strips unambiguous.

**Correction:** extend the finish from each touching polygon edge to the opening's centerline. Adjacency uses the actual boundary, since a long wall's room-side metadata can refer to another room along its length. The patches share the existing floor mesh, material and metric UV origin; no extra floor draw submission, plan polygon rewrite or threshold asset is introduced. Raised windows and solid-wall spans remain untouched. Derived floor coverage refreshes when opening geometry changes, while door angles and unrelated furniture edits retain floor geometry.

**Verification:** inspected matching before/after offline renders of the sample around camera/target `(-0.52, 25, 6.17)` / `(-0.52, 0, 6.17)`, with orthographic zoom 6 and wall cutaway enabled. The dark doorway strips disappear while the adjacent finishes remain distinct. Four floor geometry cases cover both sides, jamb bounds, raised openings, unrelated rooms, misleading room metadata, rotated walls and continuous UVs. A scene-graph case checks opening edits and retained geometry. All 13 floor/scene-graph cases, type checks and the rebuilt offline editor passed. The included plan is unchanged.

### 10 — Medium: split walls outline an uninterrupted surface

**Files:** `WallMeshBuilder.ts`, new `WallOutlineJoins.ts`, `PlanSceneGraph.ts`.

**Evidence:** the sample's blue wall is stored as `_k2vy1_a_a` and `_k2vy1_a_b`. Each body previously outlined its end cap, even though both adjoining faces have the same finish, thickness and height. The resulting vertical ink border described a saved-model split rather than a visible architectural edge. The bathroom wall has the same class of defect.

**Correction:** trim only the body-outline segments at a matching, nearly collinear continuation. Keep both independently editable wall bodies and their saved coordinates. Match each face separately, including reversed wall direction; preserve real corners, different finishes, height/thickness steps and exposed portions of neighboring opening jambs. Editing or deleting the neighbor refreshes the affected outline; unrelated furniture edits do not recompute wall joins.

**Verification:** compared the sample's blue wall before/after at eye `(0.5, 1.6, -1.5)` and target `(-1.64, 1.3, -1.36)`, and inspected the bathroom continuation. Geometry cases verify retained body meshes, original IDs, face-specific finish changes, reversed direction, real steps/corners and partially exposed jambs. A scene-graph case verifies repainting/deleting the neighbor restores its border. Thirty-two relevant wall/scene-graph cases and type checks passed; the offline editor was rebuilt. A separate outline depth-bias defect still produces ghost edges in this view and is investigated independently; suppressing split borders does not claim to fix it. Plan bytes remain unchanged.

### 11 — High: hidden architecture shows through opaque walls

**File:** `WallSurfacePalette.ts`.

**Evidence:** the sample's blue wall showed rectangles and vertical contours from a column and openings behind it, even with foreground fading off. The wall bodies were opaque and line depth testing was enabled. Runtime isolation showed that removing the outline material's polygon depth bias alone eliminated the ghost edges; material opacity and draw-order changes did not.

**Correction:** remove the negative polygon offset from the shared wall-outline material. Outlines retain ordinary depth testing, their existing color/opacity, and real contour geometry. No extra render pass, per-frame occlusion query or geometry cache is introduced. Surface-layer controls are unchanged.

**Verification:** rebuilt and visually inspected the same offline sample view used in topic 10. Hidden rectangles and the remaining apparent joint line disappear. Also inspected the bathroom wall, doorway floors and furnished house view. All four views reported zero page errors, and the included plan remains unchanged. The furnished fade view exposes a separate mismatch: mesh bodies fade while their outlines stay dark. That is not attributed to this depth-bias fix.

### 12 — Medium: cutaway views leave wire cages behind

**Files:** `OcclusionShader.ts`, `WallSurfacePalette.ts`, `FurnitureMeshBuilder.ts`, `CeilingMeshBuilder.ts`, `SurfaceMaterialFactory.ts`.

**Evidence:** in the furnished sample, foreground clip mode removed cabinet and wall surfaces while leaving their full dark wire outlines. Transparent mode likewise retained stronger contours than the faded objects. Ceiling outlines had the same missing shader hookup.

**Correction:** apply the existing foreground fade/clip shader to wall, furniture and ceiling outlines, sharing their existing live mode/plane uniforms. Ceiling contours use the finish factory's uniforms. Independent worktops retain their intentional placement-surface visibility and have a separate shared outline material. No per-frame geometry work or additional render submissions are added.

**Verification:** inspected matching close furnished-house views in transparent and clip modes, including visible ceilings, plus the blue wall and bathroom views. The wire cages disappear with their clipped bodies and faded contours recede. All five views reported zero console/page errors. Two new cases check shared live uniforms, line-shader integration and the independent-worktop exception; all 23 relevant outline, ceiling, shader-reuse and worktop cases passed, as did type checks and the rebuilt offline editor. The plan is unchanged. Custom floors disappearing and isolated glass/glowing details remain separate visible defects at this point.

### 13 — High: choosing a custom finish makes floors disappear in cutaway views

**File:** `FloorMeshBuilder.ts`.

**Evidence:** the sample's custom kitchen, hallway and bathroom finishes were subject to the foreground wall/furniture clipping plane. In the close house clip view, large portions disappeared to the background while adjacent default parquet remained visible. Transparent mode faded the same custom floors. The inconsistency depended on material choice, not floor geometry.

**Correction:** custom floor materials now use the existing foreground-visibility exemption, both when built and when their finish changes. They retain their saved texture, UVs, surface layers and geometry. Wall/furniture clipping remains active.

**Verification:** inspected matching close offline house views in clip and transparent modes: the kitchen, hall and bathroom floor coverage stays visible. A new case checks live clip/fade uniforms, independent wall behavior and repainting without geometry replacement. All 17 focused floor/scene-graph/outline cases, type checks and the offline rebuild passed; both visual views reported zero console/page errors. The included plan is unchanged. Bare footprints of clipped solid wall spans are distinct from missing room floors; this change does not move room boundaries or fill unrelated solid-wall space.

## Additional review observations and limits

### Test volume does not establish visual accuracy

Hundreds of asset cases verify that geometry exists, fits an envelope, has sections and survives a codec round trip. Those are useful checks. They do not prove that an approximation looks like the product, uses the right material, or renders correctly under every view and light. Screenshots saved during a workflow are not automatically golden-image comparisons. The retained-geometry and large-stack failures above passed the existing suite.

The new laminate is a reconstructed visual reference, not a calibrated manufacturer texture or measured material sample. Its color under scene lighting and physical grain scale are approximations. The wood controls provide a horizontal/vertical grain choice; they do not establish arbitrary-angle texture rotation. Neither geometry bounds nor a passing export test establishes a photographically accurate kitchen.

The tests also coupled production working-plan contents to hardcoded old object counts and IDs. Topic 00 repairs the affected cases. Future real-plan smoke tests should assert meaningful properties of the included save, while specific geometry bugs should use explicit small fixtures.

### Lighting costs require an explicit tradeoff

The commit added real spot and rectangular area sources for some fixtures. Light-type/count changes can require new Three.js shader variants even when objects use the same general material family. An additional mesh alone does not imply a new shader. Rectangular cove lighting and its lookup tables carry a cost; a claim that this is either free or unnecessary would need measurements and a decision about the desired light distribution. This audit retains the existing light distribution. The available conversation does not establish the originating request for every lighting variant; it does explicitly establish that the user abandoned the shader workaround task.

The existing four-source mobile budget is useful, but switching which *types* of lights occupy that budget can still change shader variants. No new shader workaround is proposed in these commits. Native iPad GPU profiling remains necessary before claiming that light preparation is solved.

### Large files and compressed style hinder review

`SurfaceFinishPicker.tsx` is 1,525 lines, `SceneEngine.ts` is 1,157, and several new UI/builders put many independent operations on single lines. The ternary-heavy category filter mixes catalogue policy with presentation. This makes omissions and incorrect comparisons harder to spot. File length alone is not a defect. The fixes should extract cohesive operations where needed, not mechanically reformat the repository or introduce abstractions without a measured purpose.

The motion code also overloads the word angle: hinged leaves use degrees, drawer leaves expose percentage times 100, and the scene API accepts a previous value converted through radians. The dedicated drawer fields remain correct, but the shared interface is easy to misuse. The translation fix preserves the saved format and existing controls. A future typed motion-path refactor should be reviewed separately rather than smuggled into a saved-plan update.

### Keep existing offline packaging and user data

Base64/gzip packaging, binary image resources, texture resizing and the explicit save flow existed before this commit. Changing these while correcting a saved plan would repeat the scope error under review. This audit preserves the current plan's bytes and its user/vendor metadata. Reducing JSON line counts is not itself a runtime optimization.

### Further structural work needs profiling before another cache

`PlanSceneGraph.reconcile` derives cornice cuts and railing runs even for furniture-only edits. The cornice helper caches by whole immutable document identity, so that cache does not survive a new document caused by a chair move. This is provably repeated work; its contribution to the current house's edit latency has not been measured here. It is a follow-up candidate rather than another cache added on assumption. Any optimization must account for wall topology, room height and railing configuration, not just element counts.

There is also no scene-wide geometry budget: a 256-item cabinet containing detailed models can still create thousands of render submissions. Topic 01 fixes diagnostic complexity; it does not establish that every possible 256-item scene is cheap to draw. Topic 05 reduces the demonstrated filler costs without claiming a universal frame-rate improvement.

### Collision checks remain planning approximations

Sampled paths can miss an obstruction thinner than their sampling interval. The current triangle fallback is also not a general mesh-versus-mesh solid solver. Hinge travel is an approximation, not a manufacturer's hardware simulation. Report these limits; do not present a small broad-phase optimization as proof of physical safety or exact continuous collision detection.

## Validation record

Initial evidence was collected on the managed Linux workspace using Node 24 and Three.js 0.186.1. Browser verification uses Chromium with SwiftShader and touch emulation, with HTTP dependencies blocked for offline checks. These checks do not substitute for Safari on a physical iPad.

All application-changing topic commits rebuilt the root offline editor. The included worksite plan remains byte-for-byte unchanged from the plan correction at the start of this review: SHA-256 `9d768bcc94f5e06b6f13052d856d4442817f2868c543a5356a1026e04bae0ad5`.

The source branch remains `wc`; `main` remains `24cf4e5`.

| Check | Result |
| --- | --- |
| Application/test TypeScript (`npm run test:types`) | Passed |
| Production build (`npm run build`) | Passed; Vite still reports the existing large-bundle warning |
| Final unit run (`npx vitest run --testTimeout 20000`) | 1,019 passed across 47 files; 20-second per-case allowance was a command-line validation setting, not a repository timeout change |
| Node regressions (`node scripts/run_tests.mjs`) | 80 passed, including repeated offline HTML re-export and persistence failure cases |
| Selected browser workflows | 33 passed across six files (10.5 minutes), covering live editing and offline touch/export flows |
| Final checked-in HTML, touch emulation with HTTP blocked | Exact included document; 184 top-level elements, 43 walls, 8 columns, 10 rooms, 123 furniture; ten laminate surfaces loaded; zero HTTP requests and zero page errors |
| Saved-plan integrity | SHA-256 unchanged; raw embedded JSON also equals the included source |
| Branch isolation | All review work on `wc`; `main` unchanged |

The selected browser run covers all cases in `cabinet-editor`, `camera-navigation`, `curated-catalogue`, `ikea-accessories`, `kitchen-worktops` and `opening-decor`. It is not a claim that the entire browser suite or physical Safari/iPad validation ran. No profiling hooks, benchmark files or screenshots are added to the production application.

## Follow-up verification against the user's requests

The user requested implementation fixes after the intent review. Topic 08 repairs the demonstrated cabinet-light gap. This follow-up also checks the named workflows rather than treating their catalogue entries or general test counts as proof of completion.

| Request | Implementation and behavior checked |
| --- | --- |
| Mouse rotation matches arrow-key rotation for house navigation | Both call `CameraNavigationController.rotatePerspective`. Live and offline browser cases assert that looking changes direction while keeping the eye position and look distance fixed; walking retains eye height. The FOV control reaches the requested 120-degree maximum without moving the camera. |
| Stack three rolls and add folded clothing piles | The offline workflow creates three independently editable rolls with a support chain, undoes/redoes the stack, places five shirts and another garment on top, exports and reloads the contents in touch emulation. Unit checks cover moved supports, cycles, detachment and the requested clothing pile identities. |
| Pull-out and internal drawers with separately modeled facade and clear volume | Unit checks distinguish front height from box height and subtract box walls/bottom from usable volume. The browser workflow configures both drawer types, resizes a cutlery organizer, verifies attached contents move with their drawer, checks obstruction by the outer door, and exports/reloads the result. |
| Organizer resizing removes segments instead of shrinking them | The builder derives row/column counts from physical dimensions and retains 8.5 × 22 cm modules. The dimension-change test checks both fewer compartments and measured wall lengths; the drawer browser case exercises the actual size controls. |
| Concealed hinges narrow the leaf and door collision checks follow the motion | Unit checks compare concealed and original leaf widths, exercise unequal paired doors and mirrored travel, and check shell/neighbor clearance through the sampled sweep. Browser cases exercise opening and closing, insufficient travel, internal drawer obstruction and recovery. The previous sliding-door correction remains covered by its three unit cases. |
| Optional kitchen plinth with a 10 cm default | The browser enables it from its initial off state, checks the 10 cm default, edits it in layout mode and reloads an offline touch export. Geometry checks confirm the slab stays at its original height and contents use the raised base. |
| Visible placed countertop and rotatable laminate | The browser places and selects the slab in foreground clip mode, applies the embedded laminate, switches grain orientation, exports and changes it again in touch emulation. This establishes 0/90-degree orientation support, not arbitrary-angle controls or a calibrated photo match. |
| Requested pet, vanity, kitchen and wardrobe objects | `DailyLifeAssets.ts` contains the six pet-care items, shallow bottle/brush/dish accessories, Nespresso-style machine, 60 cm dishwasher, short/long garment envelopes, EU 47 and women's footwear, organizer and trouser rack. Daily-life checks cover geometry, identities, both organizer sizes and shallow vanity depth. The elevated house floor is approximately 87 cm high. These remain explicitly generic reference models. |
| Save the supplied worksite plan without unrelated changes | The rebuilt checked-in HTML loads the same 184-element document, including 123 furniture and ten laminate surfaces. Raw source and embedded plan remain unchanged; the independent worksite check reports zero HTTP requests and zero page errors. There is no additional working-plan path or fallback. |
| Requested vertical cabinet LED works inside a cabinet | Topic 08's browser case exercises the actual nested inspector controls, draft undo/cancel, export, touch edits, save and reload. Unit checks establish independent actual light and diffuser output, global fixture-type scaling and retained geometry during lighting edits. |

No additional functional mismatch was demonstrated in the other checked requirements. Native Safari/device behavior, subjective navigation comfort and exact photographic/product matching remain evidence limits. The originating requests for features outside the available conversation remain unestablished; this pass does not delete or redesign those features on an assumption.

**Follow-up results:** 139 focused unit cases passed across ten files. All 21 browser cases passed across cabinet editing, camera navigation and kitchen worktops: the new LED workflow passed separately, followed by the other 20 cases. Type checks, the rebuilt root offline editor and its independent worksite-plan check passed. These are follow-up results, not a claim that the earlier full unit or Node regression suites were rerun. The worksite plan SHA-256 remains `9d768bcc94f5e06b6f13052d856d4442817f2868c543a5356a1026e04bae0ad5`; `main` remains `24cf4e5`.

## Reproducing the stack benchmark

Save the following as `work/audit-stack.ts` in either checkout and run `npx tsx work/audit-stack.ts`. Use comparable machine load and repeat runs before drawing device-level conclusions. The regression test uses a position-read bound instead of a wall-clock threshold.

```ts
import { performance } from 'node:perf_hooks';
import { cabinetIssues, defaultCabinet } from '../src/domain/cabinet/CabinetLayout';
const dimensions = { x: .6, y: 2, z: .6 };
for (const count of [100, 256]) {
  const cabinet = {
    ...defaultCabinet({ assetKey: 'cabinet_open', dimensions }, 0),
    panels: [],
    contents: Array.from({ length: count }, (_, i) => ({
      id: `item_${i}`, name: 'Stack object', assetKey: 'fit_toilet_roll',
      dimensions: { x: .1, y: .005, z: .1 },
      position: { x: 0, y: 0, z: 0 }, rotationY: 0,
      supportId: i ? `item_${i - 1}` : 'base',
    })),
  };
  const start = performance.now();
  const issues = cabinetIssues(cabinet, dimensions);
  console.log({ count, milliseconds: performance.now() - start, issues: issues.size });
}
```

For a CPU profile, run the same script with `node --cpu-prof --import tsx work/audit-stack.ts` and inspect the resulting `.cpuprofile` in the browser's performance tools. Profiles and temporary benchmarks belong under `work/`; they do not add instrumentation to the shipped application.
