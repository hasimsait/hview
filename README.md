# HView

A 3D interior viewer and editor built with TypeScript, React, and Three.js. Edit walls, columns, doors, furniture, lighting, and surface finishes; save a plan or export a self-contained HTML viewer/editor.

For a ready-to-open copy, download [hview_editor.html](hview_editor.html) using GitHub's **Download raw file** action and open it in your browser. It embeds the working `public/sample.plan` used for the bathroom regression, the current editor, textures, and offline export templates. Regenerate this portable snapshot with `npm ci && npm run build:sample-editor`. Browser storage preserves prior saves for the same file path; **Reset** restores the embedded working plan.

**Required for future changes:** Any change to application code, styles, assets, dependencies, build/export logic, or `public/sample.plan` must include a freshly generated root-level `hview_editor.html` in the same commit or PR. Run `npm run build:sample-editor`, verify the generated editor opens offline, and commit the updated HTML alongside the source changes before pushing. The checked-in HTML must reflect the current source and working plan; do not leave an outdated build in the repository or edit the generated HTML by hand.

**Required delivery:** End every final HView response with a direct, clickable **workspace file download link** to the latest complete offline editor HTML. Do not substitute a GitHub link, including raw files or releases. This also applies to documentation-only changes, which can reuse the current HTML. Preserve uploaded user plans and provide a separate editor copy when embedding them. See [AGENTS.md](AGENTS.md) for the persistent instructions for future agent sessions.

For a checkout at `/workspace/hview`, the final response must end with:

```markdown
[Download the latest offline editor](/workspace/hview/hview_editor.html)
```

Verify that the file exists and reflects the latest application build, then link it directly. Substitute the actual absolute checkout path if different. No output-directory copy, upload, or publication is needed to link an existing workspace file. If an optional copy fails, use the verified original HTML instead of withholding the link or asking the user for linking instructions, subject to any explicit higher-priority runtime path restrictions. Documentation-only changes reuse the current HTML without rebuilding it.

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

Portable HTML includes the full finish catalog and requires no server, asset folder, or network connection. Export builds resize photos to at most 512 pixels, choose the smaller JPEG/WebP encoding per image, preserve transparency, and store identical images once. Original source images remain unchanged. CSS previews and rendering share binary image resources and object URLs; compatible rendering textures also share decoded images. Base64 texture strings and consumed data scripts leave the DOM after ingestion.

Editor/viewer JavaScript and plan JSON are gzip-compressed inside the HTML. A small bundled Safari 15-compatible decoder starts the application without network access or browser decompression APIs. Compressed source bytes remain available for Reset and offline re-export; the inflated application script is removed after execution. Every exported HTML uses the same packaging. Offline editors reuse their embedded application code for another editor export and unpack the embedded viewer only when requested. Unknown plan/vendor metadata is retained.

On touch devices, the renderer limits pixel density, omits furniture contour meshes and shadow/transmission passes, and uses at most four nearby fixture lights in night mode. Daylight uses the sun and ambient fill. Desktop rendering retains its existing quality settings. Shader preparation happens before the initial view, and a restored GPU context triggers preparation and redraw automatically.

For iPhone Shortcuts that open HTML through a `data:` URL, the editor never reads the payload-sized pathname for storage keys and never attempts origin-based browser storage. Edits live in the tab; **Save HTML** downloads a new self-contained copy with those edits. **Reset** restores the embedded plan in memory. Ordinary file/hosted copies retain their existing browser saves. No server, service worker, database, or asset fetch is required for a portable copy.

## Build and test

```sh
npm run build                 # Type check, production app, standalone HTML files
npm run build:sample-editor   # Regenerate the required checked-in hview_editor.html
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
