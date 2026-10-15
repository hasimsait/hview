import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReplaceFurniture } from '../src/application/commands/FurnitureCommands';
import type { IDocumentStorage } from '../src/core/types/services';
import { createEditor } from './support/editor';

function setup() {
  const saves: { json: string; resolve: (saved: boolean) => void }[] = [];
  const storage: IDocumentStorage = { savePlan: json => new Promise(resolve => saves.push({ json, resolve })), loadPlan: async () => '{}', resetToTemplate: async () => '{}', getSaveStatus: () => 'idle', onSaveStatusChange: () => () => { } };
  const editor = createEditor(storage);
  const raw = { plan: { items: { item: { name: 'sofa', pc: { x: 100, y: 200 } } } } };
  editor.documents.load(raw);
  const edit = (asset: string) => editor.execute(new ReplaceFurniture('item', asset));
  return { editor, saves, edit, raw };
}
test('saving captures a snapshot and cannot acknowledge a later edit', async () => {
  const { editor, saves, edit } = setup(); edit('chair');
  const saved = editor.documents.save(); edit('bed');
  assert.equal(editor.codec.decode(saves[0].json).requireFurniture('item').assetKey, 'chair');
  saves[0].resolve(true); assert.equal(await saved, true); assert.equal(editor.isDirty, true);
  const retry = editor.documents.save();
  assert.equal(editor.codec.decode(saves[1].json).requireFurniture('item').assetKey, 'bed_double');
  saves[1].resolve(true); await retry; assert.equal(editor.isDirty, false);
});
test('repeat save requests share the active operation and do not post another write', async () => {
  const { editor, saves, edit } = setup(); edit('chair');
  const first = editor.documents.save(); edit('bed'); const second = editor.documents.save();
  assert.equal(first, second); assert.equal(saves.length, 1);
  saves[0].resolve(true); await second; assert.equal(editor.isDirty, true);
});
test('failed saves preserve history and dirty state for explicit retry', async () => {
  const { editor, saves, edit } = setup(); edit('chair');
  const first = editor.documents.save(); saves[0].resolve(false);
  assert.equal(await first, false); assert.equal(editor.isDirty, true); assert.equal(editor.history.canUndo, true);
  const second = editor.documents.save(); saves[1].resolve(true); await second; assert.equal(editor.isDirty, false);
});
test('a previous document save never changes the imported document baseline', async () => {
  const { editor, saves, edit, raw } = setup(); edit('chair');
  const first = editor.documents.save(); editor.documents.load(raw); edit('table');
  saves[0].resolve(true); await first; assert.equal(editor.isDirty, true);
  editor.undo(); assert.equal(editor.isDirty, false);
});
test('undo back to the saved snapshot is clean and redo restores dirty state', async () => {
  const { editor, saves, edit } = setup(); edit('chair');
  const first = editor.documents.save(); saves[0].resolve(true); await first;
  edit('bed'); editor.undo(); assert.equal(editor.isDirty, false);
  editor.redo(); assert.equal(editor.isDirty, true);
});
test('edits never schedule a persistence write', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, saves, edit } = setup(); edit('chair'); t.mock.timers.tick(60_000);
  assert.equal(saves.length, 0); assert.equal(editor.isDirty, true);
});
