import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ReplaceFurniture } from '../src/application/commands/FurnitureCommands';
import { DocumentExports } from '../src/application/DocumentExports';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { EXPORT_TEMPLATES_ID, setScriptContent } from '../src/services/export/StandaloneHtml';
import { createEditor, legacyData } from './support/editor';

function script(html: string, id: string): string {
  const match = html.match(new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script\\s*>`, 'i'));
  assert.ok(match, `Missing ${id}`);
  return match[1].trim();
}

for (const [id, otherId] of [
  ['plan.data', 'planXdata'],
  ['plan[data]', 'pland'],
  ['plan.+(data)?$^|{1}\\copy', 'other'],
]) {
  test(`script content replacement matches the literal ID ${id}`, () => {
    const other = `<script id="${otherId}" type="application/json">{"keep":true}</script>`;
    const target = `<script id="${id}" type="application/json">old</script>`;
    const content = '{"value":"$&"}';
    assert.equal(setScriptContent(other + target, id, content),
      other + `<script id="${id}" type="application/json">\n${content}\n</script>`);
  });
}

test('script matching reports a missing literal ID instead of changing a similar ID', () => {
  assert.throws(() => setScriptContent('<script id="planXdata">old</script>', 'plan.data', 'new'),
    /Missing standalone data block: plan\.data/);
});

test('built editor re-exports editors and viewers repeatedly with network unavailable', async (t) => {
  let source = readFileSync('dist/hview_editor.html', 'utf8');
  let blob: Blob | undefined;
  let clicked = 0;
  const link = { href: '', download: '', click: () => clicked++, remove: () => { } };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network unavailable'); });
  t.mock.method(URL, 'createObjectURL', (value: Blob) => { blob = value; return 'blob:export'; });
  t.mock.method(URL, 'revokeObjectURL', () => { });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: {
      getElementById: (id: string) => ({ textContent: script(source, id) }),
      createElement: () => link,
      body: { appendChild: () => { }, removeChild: () => { } },
    }
  });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as any).document;
  });

  const manager = createEditor(undefined, new PlanCodec());
  const title = '</script><script>bad()</script> $& $` $\'';
  manager.documents.load({ plan: { items: { item_1: { name: title, assetKey: 'sofa', pc: { x: 100, y: 200 } } } } });
  const service = new DocumentExports(manager, manager.codec);
  const templatesJson = script(source, EXPORT_TEMPLATES_ID);
  const textures = script(source, 'embedded-textures');
  const catalog = script(source, 'tile-catalog-data');
  const templates = legacyData(templatesJson);
  assert.equal(script(templates.editor, EXPORT_TEMPLATES_ID), '');
  assert.equal(script(gunzipSync(Buffer.from(templates.viewer.slice('gzip-base64:'.length), 'base64')).toString(), 'embedded-textures'), '');
  assert.equal(script(templates.editor, 'editor-runtime'), '');

  for (const key of ['chair', 'bed_double', 'table']) {
    manager.execute(new ReplaceFurniture('item_1', key));
    await service.exportStandaloneEditor(undefined, 'edited');
    assert.equal(link.download, 'edited.html');
    const editor = await blob!.text();
    assert.equal(script(editor, EXPORT_TEMPLATES_ID), templatesJson);
    assert.equal(script(editor, 'embedded-textures'), textures);
    assert.equal(script(editor, 'tile-catalog-data'), catalog);
    assert.equal(script(editor, 'editor-runtime'), script(source, 'editor-runtime'));
    const plan = legacyData(script(editor, 'plan-data'));
    assert.equal(plan.plan.items.item_1.assetKey, manager.factory.catalog.canonicalKey(key));
    assert.equal(plan.plan.items.item_1.name, title);
    // Open the newly exported editor for the next offline export.
    source = editor;
    await service.exportStandaloneViewer();
    assert.equal(link.download, 'house_plan_ipad_viewer.html');
    const viewer = await blob!.text();
    assert.equal(legacyData(script(viewer, 'plan-data')).plan.items.item_1.assetKey, manager.factory.catalog.canonicalKey(key));
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
  t.mock.method(URL, 'revokeObjectURL', () => { });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: {
      getElementById: () => null,
      createElement: () => ({ click: () => { }, remove: () => { } }),
      body: { appendChild: () => { }, removeChild: () => { } },
    }
  });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as any).document;
  });
  const manager = createEditor(undefined, new PlanCodec());
  manager.documents.load({ plan: { items: {} } });
  const service = new DocumentExports(manager, manager.codec);
  await service.exportStandaloneEditor();
  await service.exportStandaloneViewer();
  assert.deepEqual(fetched, ['/hview_editor_template.html', '/ipad_viewer_template.html']);
  const editor = await downloads[0].text();
  assert.ok(legacyData(script(editor, EXPORT_TEMPLATES_ID)).viewer);
  assert.deepEqual(legacyData(script(editor, 'plan-data')).plan.items, {});
  assert.ok((await downloads[1].text()).includes('id="canvas-container"'));
});
