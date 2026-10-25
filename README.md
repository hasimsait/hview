# HView

A 3D interior viewer and editor built with TypeScript, React, and Three.js. Edit walls, columns, doors, furniture, lighting, and surface finishes; save a plan or export a self-contained HTML viewer/editor.

For a ready-to-open copy, download [hview_editor.html](hview_editor.html) using GitHub's **Download raw file** action and open it in your browser. It embeds `public/sample.plan` together with the current editor, textures, and offline export templates. Regenerate this portable snapshot with `npm ci && npm run build:sample-editor`. Browser storage preserves prior saves for the same file path; **Reset** restores the embedded working plan.

Contributor requirements for English-only content, preserving user plans, rebuilding the checked-in editor, and delivering the offline HTML are in [AGENTS.md](AGENTS.md).

## Run

Use Node.js 20.19+ or 22.12+ and npm. Install the locked dependencies, then start Vite:

```sh
npm ci
npm run dev
```

The editor opens at http://localhost:3000. In the managed workspace, install with `npm ci --cache /workspace/.npm-cache`.

## Guides

- [Editor guide](docs/editor-guide.md): catalogue placement, windows, finishes, ceilings, railings and lighting.
- [Cabinet layout editor](docs/cabinet-editor.md): shelves, stacking, drawers, hinges and collision feedback.
- [Architecture](docs/architecture.md): code ownership, commands, scene nodes, persistence and extension points.
- [Catalogue references](docs/catalogue-sources.md): maintained product data, source links and reference dimensions.
- [Testing](tests/README.md): commands, coverage scope and browser setup.

## Save and export

Saving is explicit. **Save .plan** captures the current document and locks the application until persistence finishes. Failed saves retain dirty edits for retry. Editing does not trigger backup timers, autosave, or unload writes.

- `public/sample.plan` is the included working plan and the direct input to `npm run build:sample-editor`. Update that file when replacing the included plan; do not add another plan override or fallback. Small geometry regression cases live under `tests/fixtures/` independently of working-plan updates.
- The development server saves to `public/sample.plan` through `/api/save-plan`. The root `sample.plan` is the reset baseline.
- HView saves and **Export .plan** use the versioned `schemaVersion: 1` format. **Open .plan** also accepts historical RemPlanner files. **RemPlanner .plan** exports through the legacy adapter.
- Standalone editors save to browser storage scoped to their document path and reset to their embedded original plan. They can export updated plans and HTML files offline.
- Unknown vendor metadata is preserved, but recognized collections and relationships are exported from live domain objects.

Portable HTML includes the full catalogue, textures and export templates. It requires no server, asset folder or network connection.

For paint comparisons, use **Lighting → PBR Neutral**, turn daylight off, and compare **White light preview → 2700 K / 6500 K** at a fixed exposure. For each single-source comparison, choose **Match white balance to preview** to represent adaptation to that room light. White balance applies a relative Bradford transform before tone mapping, preserving the original 6500 K view; it does not change physical lamp colors or output. For mixed lamps, keep one fixed white balance. Preview temperature, white balance, exposure and the ACES comparison affect the current viewport only; they reset on reload and do not alter the plan.

A fixture's own Kelvin, total lumens and brightness settings are saved in the plan and offline exports. **Use 806 lm** sets the total output of that fixture; multiply by the bulb count when appropriate. Kelvin colors approximate a Planckian source at constant nominal luminance, not a particular LED's spectrum. RGB paint colors cannot predict spectral color shifts under arbitrary LEDs. The renderer does not simulate indirect light bouncing between room surfaces. On an iPhone, disable True Tone, Night Shift and auto-brightness for a consistent comparison.

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

See [tests/README.md](tests/README.md) for test scope and browser setup. Standalone build artifacts are `dist/ipad_viewer.html` and `dist/hview_editor.html`; templates are generated from source, not tracked inputs.

## Coordinates and finishes

The domain uses meters, with X east/right, Y elevation, and Z south/depth. RemPlanner uses centimeters with its 2D Y coordinate mapped to world Z. The legacy codec owns those conversions. UI angles use degrees; furniture rotations use radians.

Surface layers resolve coincident finishes: higher signed integers cover lower ones. Values range from -1000 to 1000. Depth bias preserves ordinary physical occlusion and transparency. Layers survive saves and standalone exports.

Offline HTML includes textures and the catalog. Browser workflows verify operation with all external requests blocked. Native file opening and Safari/iPad behavior require device checks.
