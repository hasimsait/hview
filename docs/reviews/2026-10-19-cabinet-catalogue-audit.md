# Review of `24cf4e5` — Cabinet and Catalogue

## Scope and review contract

Reviewed commit: `24cf4e53bdda578a5e9b7b55cf4d77f33fd3a6bf` on `main`, against its parent `0a7cc7b`. Fixes belong on `wc`, based on that commit. Do not rewrite or commit to `main`.

This change combined cabinet editing, contents and stacking, drawers, hinges, collision feedback, several catalogue families, window editing and dressings, ceilings, cornices, balcony railings, camera controls, plan updates, generated HTML, and contributor instructions: 187 changed files and 95,436 added physical lines. Of those additions, 78,330 were the extra saved plan. The size of a plan JSON file is not application complexity.

The requested features are legitimate. The problems are unannounced changes to the plan workflow, repeated work on interactive paths, missing collision behavior, and insufficient tests for retained geometry and realistic stack sizes. This review does not propose deleting requested assets, removing offline support, adding network dependencies, changing saved dimensions, or replacing the application's architecture.

### Commit map

Each row is one topic for inspection in a PR. Final hashes and validation outcomes will be filled in after fixes. The existing plan correction is included rather than folded into another commit.

| Topic | Finding | Commit / intended title |
| --- | --- | --- |
| 00 | Unrequested latest-plan override and production data used as a fixture | `c22bb75` — Use sample.plan directly for the included editor plan |
| Report | Review evidence and scope before implementation | This report's initial commit |
| 01 | Repeated cabinet support resolution freezes large stacks | Bound cabinet stack diagnostics to resolved content |
| 02 | Door and drawer motion rebuild the entire cabinet | Retain cabinet geometry during door and drawer motion |
| 03 | Collision sampling repeats expensive work for distant meshes | Cull distant meshes before cabinet collision tests |
| 04 | Sliding room doors bypass collision checks | Check sliding room doors along their translation path |
| 05 | Cabinet filler models create excessive draw submissions | Reduce draw calls for cabinet filler assets |
| 06 | Catalogue renders and searches all cards on every edit | Bound catalogue rendering and reuse its search index |
| Final | Final results, hashes, limitations and any integration cleanup | Record audit results and commit map |

No finding is considered fixed just because this document says it should be. Check the implementation and validation in its mapped commit.

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

## Additional review observations and limits

### Test volume does not establish visual accuracy

Hundreds of asset cases verify that geometry exists, fits an envelope, has sections and survives a codec round trip. Those are useful checks. They do not prove that an approximation looks like the product, uses the right material, or renders correctly under every view and light. Screenshots saved during a workflow are not automatically golden-image comparisons. The retained-geometry and large-stack failures above passed the existing suite.

The tests also coupled production working-plan contents to hardcoded old object counts and IDs. Topic 00 repairs the affected cases. Future real-plan smoke tests should assert meaningful properties of the included save, while specific geometry bugs should use explicit small fixtures.

### Lighting costs require an explicit tradeoff

The commit added real spot and rectangular area sources for some fixtures. Light-type/count changes can require new Three.js shader variants even when objects use the same general material family. An additional mesh alone does not imply a new shader. Rectangular cove lighting and its lookup tables carry a cost; a claim that this is either free or unnecessary would need measurements and a decision about the desired light distribution. This audit preserves that requested visual behavior rather than silently replacing it with a different lighting approximation.

The existing four-source mobile budget is useful, but switching which *types* of lights occupy that budget can still change shader variants. No new shader workaround is proposed in these commits. Native iPad GPU profiling remains necessary before claiming that light preparation is solved.

### Large files and compressed style hinder review

`SurfaceFinishPicker.tsx` is 1,525 lines, `SceneEngine.ts` is 1,157, and several new UI/builders put many independent operations on single lines. The ternary-heavy category filter mixes catalogue policy with presentation. This makes omissions and incorrect comparisons harder to spot. File length alone is not a defect. The fixes should extract cohesive operations where needed, not mechanically reformat the repository or introduce abstractions without a measured purpose.

### Keep existing offline packaging and user data

Base64/gzip packaging, binary image resources, texture resizing and the explicit save flow existed before this commit. Changing these while correcting a saved plan would repeat the scope error under review. This audit preserves the current plan's bytes and its user/vendor metadata. Reducing JSON line counts is not itself a runtime optimization.

### Collision checks remain planning approximations

Sampled paths can miss an obstruction thinner than their sampling interval. The current triangle fallback is also not a general mesh-versus-mesh solid solver. Hinge travel is an approximation, not a manufacturer's hardware simulation. Report these limits; do not present a small broad-phase optimization as proof of physical safety or exact continuous collision detection.

## Validation record

Initial evidence was collected on the managed Linux workspace using Node 24 and Three.js 0.186.1. Browser verification uses Chromium with SwiftShader and touch emulation, with HTTP dependencies blocked for offline checks. These checks do not substitute for Safari on a physical iPad.

Final topic results, commit hashes, before/after timings, suite outcomes and remaining limitations will be appended after implementation. All application-changing topic commits must rebuild the root offline editor. No requested saved-plan content may change as part of this audit.
