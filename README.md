# HView - 3D Architectural Interior Viewer & Editor

HView is a high-performance 3D architectural interior visualization and interactive design studio built with React 19, Three.js, and TypeScript. It enables real-time architectural planning, furniture placement, surface finish customization (PBR tiles, wood veneers, 100 curated wall paints, acoustic lambri slats, and parquet), dynamic day/night lighting, and lossless bidirectional synchronization with `.plan` files.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (tested on `v20.x` and `v26.x`)
- **npm**: `v9.0.0` or higher

---

## Quick Start & Installation

```bash
# 1. Install all required dependencies
npm install

# 2. Start the development server with live persistence
npm run dev

# 3. Build production web bundle and standalone offline HTML distributions
npm run build
```

When running `npm run dev`, open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available NPM Scripts

Test commands, coverage scope, browser setup, and confirmed regression failures
are documented in [tests/README.md](tests/README.md).

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server on port 3000 with HMR and the `/api/save-plan` local persistence endpoint. |
| `npm run build` | Runs TypeScript type checking (`tsc`), compiles the Vite production bundle, and generates both standalone offline HTML distributions in `dist/`. |
| `npm run build:viewer` | Bundles and regenerates the standalone offline iPad HTML viewer and editor (`dist/ipad_viewer.html` and `dist/hview_editor.html`). |
| `npm test` | Runs the 71 regression tests after building the standalone HTML files. |
| `npm run test:layers:browser` | Checks surface overlap pixels and integer layer controls in headless Chromium (requires Chromium). |
| `npm run preview` | Serves the production build locally using Vite's preview server. |

---

## Node Modules & Dependencies Guide

### Production Dependencies (`dependencies`)

| Package | Version | Purpose in HView |
| :--- | :--- | :--- |
| **`three`** | `^0.186.1` | The core WebGL 3D rendering engine. Drives the scene graph, perspective/orthographic cameras, directional sun lights, ambient lighting, PBR materials (`MeshStandardMaterial`, `MeshPhysicalMaterial`), UV metric mapping, `OrbitControls` navigation, and `TransformControls` object gizmos. |
| **`react`** | `^19.0.0` | Powers the reactive UI layer, state management, modal dialogs, and property inspectors. |
| **`react-dom`** | `^19.0.0` | Renders React components into the DOM root (`#root`). |
| **`lucide-react`** | `^1.16.0` | Comprehensive library of crisp, accessible SVG UI icons (e.g., `Tablet`, `Download`, `Layers`, `Sun`, `Moon`, `Eye`, `Box`). |
| **`clsx`** | `^2.1.1` | Lightweight utility for conditionally joining CSS class names. |
| **`tailwind-merge`** | `^3.0.2` | Safely merges Tailwind CSS classes without conflict bugs across custom component themes. |

### Development & Build Tooling (`devDependencies`)

| Package | Version | Purpose in HView |
| :--- | :--- | :--- |
| **`vite`** | `^6.2.0` | Modern, lightning-fast frontend development server and bundler. Serves static assets, runs custom dev middleware for `.plan` persistence, and compiles production assets. |
| **`@vitejs/plugin-react`** | `^4.3.4` | Enables Fast Refresh (HMR) and JSX/TSX compilation for React in Vite. |
| **`typescript`** | `^5.8.2` | Provides static typing, interface contracts (`@core/types/plan.ts`, `@core/types/services.ts`), and strict build verification. |
| **`tailwindcss`** | `^3.4.17` | Utility-first CSS styling engine used for all modern dark-glassmorphism UI components. |
| **`postcss`** | `^8.5.3` | CSS post-processing pipeline for Tailwind. |
| **`autoprefixer`** | `^10.4.20` | Automatically appends vendor prefixes to CSS rules for cross-browser support (Safari, Chrome, Firefox). |
| **`esbuild`** | `^0.25.12` | High-speed JavaScript and TypeScript bundler. Used by `scripts/build_standalone_viewer.ts` to bundle the 3D engine, Three.js, and React into standalone IIFE scripts in milliseconds. |
| **`@types/three`** | `^0.186.0` | TypeScript definitions for Three.js APIs and addons. |
| **`@types/react`** | `^19.0.10` | TypeScript definitions for React. |
| **`@types/react-dom`**| `^19.0.4` | TypeScript definitions for React DOM. |
| **`@types/node`** | `^22.13.9` | TypeScript declarations for Node.js standard libraries (`fs`, `path`, `url`). |

---

## Standalone Offline iPad & Mobile Distributions

For job-site presentation to craftsmen where no web server can be deployed, HView builds two 100% self-contained single-file HTML distributions in `dist/`:

1. **Craftsman Tap-to-Inspect Viewer** (`dist/ipad_viewer.html`):
   - Touch-optimized 3D navigation (1-finger orbit, 2-finger pan, pinch zoom).
   - Tap any wall, acoustic lambri panel, floor, cabinet, or door to open the **Craftsman Specification Drawer** displaying exact dimensions, paint codes, and material names.
   - Wall Cutaway mode to inspect interior rooms without obstruction.
   - Room Navigator chips to jump between spaces.

2. **Standalone Full Editor** (`dist/hview_editor.html`):
   - Complete React 19 editor packed into a single HTML file with all sidebars, 100 wall paint swatches, wood species, and acoustic lambri pickers.
   - Inlined base64 textures and tile catalog.
   - Changes automatically persist across reloads in browser storage scoped to the document path. Updated `.plan` or `.html` files can be exported directly from the header on the iPad. Standalone saves use local storage, and reset restores the file’s embedded original plan without contacting a hosting API.
   - Editor and viewer export templates are embedded alongside shared textures, so downloaded editors can export fresh HTML files offline. Re-exported editors retain this capability without recursively duplicating templates.

> **Tip for iPad Users**: Apple sandboxes Safari from opening local `file:///` URLs directly from the Files app. To open in a full browser:
> - Long-press the file in **Files** -> **Share** -> choose **Microsoft Edge**, **Chrome**, or **Documents by Readdle**.
> - Or drop the HTML file onto [Netlify Drop](https://app.netlify.com/drop) and tap **"Add to Home Screen"** in Safari for a borderless native app experience.

---

## ⚠️ MANDATORY ARCHITECTURAL CONTRACT: PERSISTENCE & SERIALIZATION

> [!IMPORTANT]
> ### RULE FOR ALL DEVELOPERS AND AGENTS: ALL EDITS MUST PERSIST
> **Any and all current and future editor capabilities must be fully serializable and append to the `.plan` file.**
> 
> When adding new features (e.g., custom sizing, rotation, elevation, material finishes, section finishes, wall modifications, opening adjustments, ceiling tiles, lighting parameters, or any new interactive controls):
> 
> 1. **Bidirectional Serialization in Services**:
>    - **[`PlanExportService.ts`](src/services/plan/PlanExportService.ts)**: You **MUST** update `exportPlan()` to serialize the new properties into the JSON structure.
>    - **[`PlanParserService.ts`](src/services/plan/PlanParserService.ts)**: You **MUST** update `parse()` to restore those properties back into the strongly-typed `PlanDocument` model.
> 2. **State & Auto-Save Trigger**:
>    - In **[`PlanManagerService.ts`](src/services/plan/PlanManagerService.ts)**, every mutation method **MUST** set `this.isDirty = true` and invoke `this.notifyPlanChange()`.
>    - Each mutation immediately caches its serialized working copy in browser storage. Server saves remain debounced and are sent in order; only the latest snapshot can update save status or clear the dirty flag.
> 3. **Working Plan vs Base Template**:
>    - **`public/sample.plan`**: The active, editable working plan served during development and runtime.
>    - **`sample.plan`** (root): The pristine baseline template. It is copied to `public/sample.plan` on initial launch if no working plan exists, and can be restored via the reset action.
> 4. **No Ephemeral Edits**:
>    - Never store user modifications only in temporary Three.js mesh state or component local state without syncing them to `PlanDocument` and saving to `public/sample.plan`.

---

## Surface layers

In the surface finish picker, use **Surface layer** to resolve coincident finishes. Layer 0 is the default; higher integers cover lower integers on the same plane. For example, C at 3 covers B at 2, while B covers A at 1 and D at 0 wherever they overlap. Plus/minus buttons and signed integer entry support values from -1000 to 1000.

Choose a finish before adjusting its layer. Changing the finish or color preserves its layer; resetting the finish returns to the default. Layers are saved with wall faces/edges, floors, columns, and furniture finishes/sections and retained in exported standalone HTML.

Layer priority uses small ranked depth offsets rather than moving geometry or disabling depth testing. Physically nearer objects still occlude the surfaces. Transparent finishes retain their intended transparency.

## Core Architecture & Patterns

The codebase strictly enforces **Separation of Concerns** and **Dependency Injection (DI)**:

```
src/
├── core/
│   ├── di/                 # Dependency injection container & service registration
│   │   ├── bootstrap.ts    # Service container setup
│   │   ├── container.ts    # Lightweight IoC container
│   │   └── tokens.ts       # Service injection tokens (TOKENS)
│   └── types/
│       ├── plan.ts         # Strongly-typed domain models (Furniture, Wall, Room, Column, etc.)
│       └── services.ts     # Service contracts & interfaces
├── services/
│   ├── export/
│   │   └── StandaloneViewerExportService.ts # Single-file HTML generator & downloader
│   ├── plan/
│   │   ├── PlanManagerService.ts       # Central domain manager, state transitions, dirty tracking
│   │   ├── PlanParserService.ts        # Parses RemPlanner JSON -> 3D PlanDocument
│   │   ├── PlanExportService.ts        # Serializes 3D PlanDocument -> RemPlanner JSON
│   │   └── PlanPersistenceService.ts   # Debounced disk persistence (/api/save-plan) & localStorage
│   ├── rendering/
│   │   ├── ThreeSceneService.ts        # Scene graph, camera, lighting, environment, rendering loop
│   │   ├── WallGeometryService.ts      # Wall extrusions, mitered corners, column cutouts
│   │   ├── OpeningGeometryService.ts   # Doors, windows, coupe doors, hinges & swings
│   │   ├── ProceduralAssetFactory.ts   # Procedural 3D assets (sofas, tables, fixtures, appliances)
│   │   ├── AssetRegistryService.ts     # Asset definitions, procedural & GLB loaders
│   │   └── SurfaceFinishService.ts     # PBR materials (tiles, wood, plaster, lambri, ceilings)
│   ├── tile-catalog/
│   │   └── TileCatalogService.ts       # Ceramic & porcelain tile catalog manager
│   └── interaction/
│       └── InteractionService.ts       # Raycasting, selection, TransformControls (move/rotate/elevate)
├── viewer/
│   ├── main.ts             # Lightweight touch-optimized standalone viewer engine
│   └── styles.css          # Glassmorphism touch UI styles for standalone viewer
└── ui/
    ├── App.tsx             # Root UI layout, reactive coordination
    ├── context/DIContext.ts# React DI hook (`useService(TOKENS.ServiceName)`)
    └── components/         # Modals, Inspectors, Header toolbar, Viewport3D
```

---

## Coordinate Systems & Units

- **3D World Space (Three.js)**:
  - Metric units: **Meters** ($1.0 = 100\,\text{cm}$).
  - Axes:
    - $+X$: Right / East
    - $+Y$: Up (Elevation from floor)
    - $+Z$: Down / South (Depth in floor plan)
- **RemPlanner 2D Coordinates (`.plan` JSON)**:
  - Metric units: **Centimeters** ($100 = 1.0\,\text{m}$).
  - Coordinates:
    - `pc.x`: $X \times 100$
    - `pc.y`: $Z \times 100$ (RemPlanner 2D $Y$ maps to 3D world $Z$)
    - `f0offset`: $Y \times 100$ (Elevation above ground in cm)
    - `angle`: Rotation degrees ($180 - \text{rotationY} \times \frac{180}{\pi}$).
    - `width`, `height`, `self_height`: Width ($X$), Depth ($Z$), Height ($Y$) in cm.
