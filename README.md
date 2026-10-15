# HView

A 3D interior viewer and editor built with TypeScript, React, and Three.js. Edit walls, columns, doors, furniture, lighting, and surface finishes; save a plan or export a self-contained HTML viewer/editor.

For a ready-to-open copy, download [hview_editor.html](hview_editor.html) using GitHub's **Download raw file** action and open it in your browser. It embeds the working `public/sample.plan` used for the bathroom regression, the current editor, textures, and offline export templates. Regenerate this portable snapshot with `npm ci && npm run build:sample-editor`. Browser storage preserves prior saves for the same file path; **Reset** restores the embedded working plan.

## Run

Use Node.js 20.19+ or 22.12+ and npm. Install the locked dependencies, then start Vite:

```sh
npm ci
npm run dev
```

The editor opens at http://localhost:3000. In the managed workspace, install with `npm ci --cache /workspace/.npm-cache`.

## Find the code

Read [the architecture guide](docs/architecture.md) for ownership, collaborations, and extension patterns. Start with these classes:

| Responsibility | Owner |
| --- | --- |
| Construct the editor's collaborators | `application/ApplicationRuntime` |
| Own the current document, history, and selection | `application/EditorSession` |
| Validate element identity and relationships | `domain/model/PlanDocument` |
| Own architectural and furniture behavior | `domain/elements/` |
| Describe a user edit | `application/commands/` |
| Load, save, and acknowledge a captured snapshot | `application/DocumentController` |
| Read/write the HView format and import legacy plans | `domain/codec/PlanCodec` |
| Reconcile elements into retained render objects | `engine/nodes/PlanSceneGraph` |
| Own browser/HTTP persistence | `platform/persistence/DocumentStorage` |

Paths in this table are relative to `src/`. There is one document authority and one edit entry point: `EditorSession.execute(command)`. Domain methods return immutable replacements; commands commit through the session. Rendering and UI controls consume that document. Transport data and legacy metadata are not editable models.

When adding a feature, put its rules on the owning class, expose the user action through a command, and update its codec and rendering/inspector visitors as needed. Cover edit → undo/redo → save/export → reload. Remove the superseded implementation in the same cutover.

## Save and export

Saving is explicit. **Save .plan** captures the current document and locks the application until persistence finishes. Failed saves retain dirty edits for retry. Editing does not trigger backup timers, autosave, or unload writes.

- The development server saves to `public/sample.plan` through `/api/save-plan`. The root `sample.plan` is the reset baseline.
- HView saves and **Export .plan** use the versioned `schemaVersion: 1` format. **Open .plan** also accepts historical RemPlanner files. **RemPlanner .plan** exports through the legacy adapter.
- Standalone editors save to browser storage scoped to their document path and reset to their embedded original plan. They can export updated plans and HTML files offline.
- Unknown vendor metadata is preserved, but recognized collections and relationships are exported from live domain objects.

## Build and test

```sh
npm run build                 # Type check, production app, standalone HTML files
npm run test:types            # Application and test TypeScript
npm test                      # Unit tests and Node regressions; build first
npm run test:coverage         # Domain/application/persistence/render-node coverage
npm run test:e2e              # Chromium workflows in a disposable checkout
npm run test:layers:browser   # GPU overlap and surface-layer control checks
```

See [tests/README.md](tests/README.md) for test scope and browser setup, and [tests/RESULTS.md](tests/RESULTS.md) for validation results. Standalone build artifacts are `dist/ipad_viewer.html` and `dist/hview_editor.html`; templates are generated from source, not tracked inputs.

## Coordinates and finishes

The domain uses meters, with X east/right, Y elevation, and Z south/depth. RemPlanner uses centimeters with its 2D Y coordinate mapped to world Z. The legacy codec owns those conversions. UI angles use degrees; furniture rotations use radians.

Surface layers resolve coincident finishes: higher signed integers cover lower ones. Values range from -1000 to 1000. Depth bias preserves ordinary physical occlusion and transparency. Layers survive saves and standalone exports.

Offline HTML includes textures and the catalog. Browser workflows verify operation with all external requests blocked. Native file opening and Safari/iPad behavior require device checks.
