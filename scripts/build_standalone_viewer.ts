import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildStandaloneViewer() {
  console.log('🚀 Building standalone iPad 3D viewer...');

  const rootDir = path.resolve(__dirname, '..');
  const srcViewerMain = path.join(rootDir, 'src', 'viewer', 'main.ts');
  const srcViewerCss = path.join(rootDir, 'src', 'viewer', 'styles.css');
  const tilesJsonPath = path.join(rootDir, 'public', 'textures', 'tiles', 'tiles.json');
  const publicDir = path.join(rootDir, 'public');
  const distDir = path.join(rootDir, 'dist');
  const templateOutputPath = path.join(publicDir, 'ipad_viewer_template.html');
  const distOutputPath = path.join(distDir, 'ipad_viewer.html');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle JavaScript using esbuild
  console.log('📦 Bundling viewer JavaScript with esbuild...');
  const buildResult = await esbuild.build({
    entryPoints: [srcViewerMain],
    bundle: true,
    format: 'iife',
    globalName: 'HViewViewer',
    minify: true,
    write: false,
    target: ['safari15', 'chrome100', 'firefox100'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const bundledJs = buildResult.outputFiles[0].text;
  console.log(`✅ JS bundled successfully: ${(bundledJs.length / 1024).toFixed(1)} KB`);

  // 2. Read Stylesheet
  const cssContent = fs.readFileSync(srcViewerCss, 'utf-8');

  // 3. Read Tile Catalog JSON
  let tilesJsonContent = '[]';
  if (fs.existsSync(tilesJsonPath)) {
    tilesJsonContent = fs.readFileSync(tilesJsonPath, 'utf-8');
  }

  // 4. Encode textures to base64
  console.log('🖼️ Inlining textures to base64 for 100% offline support...');
  const texturesMap: Record<string, string> = {};
  const texturesBaseDir = path.join(rootDir, 'public', 'textures');

  function scanTextures(dir: string) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanTextures(fullPath);
      } else if (/\.(jpg|jpeg|png)$/i.test(item)) {
        const mime = item.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const b64 = fs.readFileSync(fullPath).toString('base64');
        const dataUri = `data:${mime};base64,${b64}`;

        // Relative path from /public, e.g. /textures/wood/wood_natural_oak.jpg
        const relPath = fullPath.replace(publicDir, '');
        texturesMap[relPath] = dataUri;
      }
    }
  }

  scanTextures(texturesBaseDir);
  console.log(`✅ Inlined ${Object.keys(texturesMap).length} texture files.`);

  // 5. Construct HTML Template
  const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>House Plan 3D Viewer</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="tap-indicator" class="tap-indicator"></div>

  <!-- Top Navigation Bar -->
  <div class="top-bar">
    <div class="brand-badge">
      <span class="brand-dot"></span>
      <span>HVIEW 3D</span>
    </div>
    <div class="top-controls">
      <button id="btn-orbit" class="tool-btn active" title="3D Orbit Mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <span>3D Orbit</span>
      </button>
      <button id="btn-topdown" class="tool-btn" title="Floor Plan Mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        <span>Floor Plan</span>
      </button>
      <button id="btn-walkthrough" class="tool-btn" title="Walkthrough Mode">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span>Walkthrough</span>
      </button>
      <button id="btn-cutaway" class="tool-btn" title="Cutaway Walls">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        <span>Cutaway</span>
      </button>
      <button id="btn-ceiling" class="tool-btn" title="Toggle Ceilings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21h18M3 10l9-7 9 7v11H3z"></path></svg>
        <span>Ceiling</span>
      </button>
      <button id="btn-lighting" class="tool-btn" title="Toggle Lighting">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <span>Lighting</span>
      </button>
      <button id="btn-reset" class="tool-btn" title="Reset Camera">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
        <span>Reset</span>
      </button>
    </div>
  </div>

  <!-- Bottom Floating Room Navigator Bar -->
  <div id="room-bar" class="bottom-bar"></div>

  <!-- Craftsman Specification Drawer (Tap-to-Inspect) -->
  <div id="spec-drawer" class="spec-drawer">
    <div class="drawer-drag-handle"></div>
    <div class="drawer-header">
      <div class="drawer-title-group">
        <div id="drawer-category" class="drawer-category">Craftsman Specification</div>
        <div id="drawer-title" class="drawer-title">Item Name</div>
      </div>
      <button id="drawer-close" class="drawer-close" aria-label="Close specification">✕</button>
    </div>
    <div class="drawer-grid">
      <div class="spec-cell">
        <div class="spec-label">Dimensions</div>
        <div id="drawer-dimensions" class="spec-value">-</div>
      </div>
      <div class="spec-cell">
        <div class="spec-label">Room / Zone</div>
        <div id="drawer-room" class="spec-value">-</div>
      </div>
      <div class="spec-cell full-width">
        <div class="spec-label">Specified Finish / Material</div>
        <div id="drawer-finish" class="spec-value">-</div>
      </div>
      <div class="spec-cell full-width">
        <div class="spec-label">Details & Notes</div>
        <div id="drawer-details" class="spec-value">-</div>
      </div>
    </div>
    <div class="craftsman-hint">Tap any element on the 3D model to inspect its specifications</div>
  </div>

  <!-- Inlined Data -->
  <script id="embedded-textures" type="application/json">
${JSON.stringify(texturesMap)}
  </script>
  <script id="tile-catalog-data" type="application/json">
${tilesJsonContent}
  </script>
  <script id="plan-data" type="application/json">
/* __PLAN_DATA_PLACEHOLDER__ */
  </script>
  <script>
    try {
      window.__EMBEDDED_TEXTURES__ = JSON.parse(document.getElementById('embedded-textures').textContent);
      window.__TILE_CATALOG__ = JSON.parse(document.getElementById('tile-catalog-data').textContent);
    } catch (e) {
      console.warn('Failed to parse embedded data:', e);
    }
  </script>

  <!-- Bundled Viewer Logic -->
  <script>
${bundledJs}
  </script>
</body>
</html>`;

  // Write template for browser-side export service
  fs.writeFileSync(templateOutputPath, htmlTemplate, 'utf-8');
  console.log(`✅ Template written to: ${templateOutputPath}`);

  // 6. Generate pre-built standalone HTML file with current sample.plan
  let samplePlanJson = '{}';
  const samplePlanPath = path.join(rootDir, 'sample.plan');
  const publicSamplePlanPath = path.join(rootDir, 'public', 'sample.plan');

  if (fs.existsSync(samplePlanPath)) {
    samplePlanJson = fs.readFileSync(samplePlanPath, 'utf-8');
  } else if (fs.existsSync(publicSamplePlanPath)) {
    samplePlanJson = fs.readFileSync(publicSamplePlanPath, 'utf-8');
  }

  const standaloneHtml = htmlTemplate.replace('/* __PLAN_DATA_PLACEHOLDER__ */', samplePlanJson);
  fs.writeFileSync(distOutputPath, standaloneHtml, 'utf-8');
  console.log(`🎉 Standalone iPad viewer generated: ${distOutputPath} (${(standaloneHtml.length / 1024 / 1024).toFixed(2)} MB)`);

  // 7. Bundle FULL React Editor into standalone HTML file
  console.log('📦 Bundling FULL React Editor into standalone HTML file...');
  const editorBuildResult = await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'main.tsx')],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['safari15', 'chrome100', 'firefox100'],
    loader: { '.css': 'empty' },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const editorBundledJs = editorBuildResult.outputFiles[0].text;
  console.log(`✅ Full Editor JS bundled: ${(editorBundledJs.length / 1024).toFixed(1)} KB`);

  // Find compiled Tailwind CSS from dist/assets
  let tailwindCss = '';
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
    if (cssFiles.length > 0) {
      tailwindCss = fs.readFileSync(path.join(assetsDir, cssFiles[0]), 'utf-8');
    }
  }

  const fullEditorHtmlTemplate = `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>HView - 3D House Planner & Editor (Standalone)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
${tailwindCss}
  </style>
</head>
<body class="h-full w-full overflow-hidden select-none font-['Inter',sans-serif]">
  <div id="root" class="h-full w-full"></div>

  <!-- Embedded Data for 100% Offline Standalone Operation -->
  <script id="embedded-textures" type="application/json">
${JSON.stringify(texturesMap)}
  </script>
  <script id="tile-catalog-data" type="application/json">
${tilesJsonContent}
  </script>
  <script id="plan-data" type="application/json">
/* __PLAN_DATA_PLACEHOLDER__ */
  </script>
  <script>
    window.__STANDALONE_MODE__ = true;
    try {
      window.__EMBEDDED_TEXTURES__ = JSON.parse(document.getElementById('embedded-textures').textContent);
      window.__TILE_CATALOG__ = JSON.parse(document.getElementById('tile-catalog-data').textContent);
      window.__PLAN_DATA__ = JSON.parse(document.getElementById('plan-data').textContent);
    } catch (e) {
      console.warn('Failed parsing embedded data:', e);
    }
  </script>

  <!-- Bundled Full React Editor Application -->
  <script>
${editorBundledJs}
  </script>
</body>
</html>`;

  const editorTemplateOutputPath = path.join(publicDir, 'hview_editor_template.html');
  fs.writeFileSync(editorTemplateOutputPath, fullEditorHtmlTemplate, 'utf-8');

  const fullEditorDistPath = path.join(distDir, 'hview_editor.html');
  const fullEditorHtml = fullEditorHtmlTemplate.replace('/* __PLAN_DATA_PLACEHOLDER__ */', samplePlanJson);
  fs.writeFileSync(fullEditorDistPath, fullEditorHtml, 'utf-8');
  console.log(`🎉 Standalone FULL Editor generated: ${fullEditorDistPath} (${(fullEditorHtml.length / 1024 / 1024).toFixed(2)} MB)`);
}

buildStandaloneViewer().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
