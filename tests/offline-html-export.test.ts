import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { StandaloneViewerExportService } from '../src/services/export/StandaloneViewerExportService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';
import { EXPORT_TEMPLATES_ID, setScriptContent } from '../src/services/export/StandaloneHtml';

function script(html: string, id: string): string {
  const match = html.match(new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script\\s*>`, 'i'));
  assert.ok(match, `Missing ${id}`);
  return match[1].trim();
}

test('built editor re-exports editors and viewers repeatedly with network unavailable', async (t) => {
  let source = readFileSync('dist/hview_editor.html', 'utf8');
  let blob: Blob | undefined;
  let clicked = 0;
  const link = { href: '', download: '', click: () => clicked++ };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
  t.mock.method(URL, 'createObjectURL', (value: Blob) => { blob = value; return 'blob:export'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: (id: string) => ({ textContent: script(source, id) }),
    createElement: () => link,
    body: { appendChild: () => {}, removeChild: () => {} },
  } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as any).document;
  });

  const exporter = new PlanExportService();
  const manager = new PlanManagerService(new PlanParserService(), exporter);
  manager.loadPlan({ plan: { items: { item_1: { name: 'sofa', pc: { x: 100, y: 200 } } } } });
  const service = new StandaloneViewerExportService(manager, exporter);
  const templatesJson = script(source, EXPORT_TEMPLATES_ID);
  const textures = script(source, 'embedded-textures');
  const catalog = script(source, 'tile-catalog-data');
  const templates = JSON.parse(templatesJson);
  assert.equal(script(templates.editor, EXPORT_TEMPLATES_ID), '');
  assert.equal(script(templates.viewer, 'embedded-textures'), '');

  for (const key of ['chair', 'bed_double', 'table']) {
    manager.replaceFurnitureAsset('item_1', key);
    const title = '</script><script>bad()</script> $& $` $\'';
    manager.updateFurniture('item_1', { rawItem: { name: title } });
    await service.exportStandaloneEditor(undefined, 'edited');
    assert.equal(link.download, 'edited.html');
    const editor = await blob!.text();
    assert.equal(script(editor, EXPORT_TEMPLATES_ID), templatesJson);
    assert.equal(script(editor, 'embedded-textures'), textures);
    assert.equal(script(editor, 'tile-catalog-data'), catalog);
    const plan = JSON.parse(script(editor, 'plan-data'));
    assert.equal(plan.plan.items.item_1.assetKey, key);
    assert.equal(plan.plan.items.item_1.name, title);
    // Open the newly exported editor for the next offline export.
    source = editor;
    await service.exportStandaloneViewer();
    assert.equal(link.download, 'house_plan_ipad_viewer.html');
    const viewer = await blob!.text();
    assert.equal(JSON.parse(script(viewer, 'plan-data')).plan.items.item_1.assetKey, key);
    assert.equal(script(viewer, 'embedded-textures'), textures);
    assert.equal(script(viewer, 'tile-catalog-data'), catalog);
    assert.ok(viewer.includes('id="canvas-container"'));
  }
  assert.equal(clicked, 6);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('plan injection targets the data block and preserves literal replacement characters', () => {
  const template = '<script>const marker = "/* __PLAN_DATA_PLACEHOLDER__ */";</script>' +
    '<script id="plan-data" type="application/json">/* __PLAN_DATA_PLACEHOLDER__ */</script>';
  const json = JSON.stringify({ name: '$& $` $\'' });
  const html = setScriptContent(template, 'plan-data', json);
  assert.equal(script(html, 'plan-data'), json);
  assert.ok(html.startsWith('<script>const marker = "/* __PLAN_DATA_PLACEHOLDER__ */";</script>'));
});

test('hosted exports load generated templates that carry offline re-export data', async (t) => {
  const downloads: Blob[] = [];
  const fetched: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: RequestInfo | URL) => {
    fetched.push(String(path));
    return new Response(readFileSync(`dist${path}`, 'utf8'));
  });
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => { downloads.push(blob); return 'blob:export'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: () => null,
    createElement: () => ({ click: () => {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
  } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as any).document;
  });
  const exporter = new PlanExportService();
  const manager = new PlanManagerService(new PlanParserService(), exporter);
  manager.loadPlan({ plan: { items: {} } });
  const service = new StandaloneViewerExportService(manager, exporter);
  await service.exportStandaloneEditor();
  await service.exportStandaloneViewer();
  assert.deepEqual(fetched, ['/hview_editor_template.html', '/ipad_viewer_template.html']);
  const editor = await downloads[0].text();
  assert.ok(JSON.parse(script(editor, EXPORT_TEMPLATES_ID)).viewer);
  assert.deepEqual(JSON.parse(script(editor, 'plan-data')).plan.items, {});
  assert.ok((await downloads[1].text()).includes('id="canvas-container"'));
});
