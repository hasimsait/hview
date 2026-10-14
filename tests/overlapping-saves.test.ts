import assert from 'node:assert/strict';
import { test, TestContext } from 'node:test';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';
import { IPlanPersistenceService } from '../src/core/types/services';

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saves: { json: string; resolve: (ok: boolean) => void }[] = [];
  const persistence: IPlanPersistenceService = {
    savePlan: (json) => new Promise<boolean>((resolve) => saves.push({ json, resolve })),
    loadPlan: async () => '',
    resetToTemplate: async () => '',
    getSaveStatus: () => 'idle',
    onSaveStatusChange: () => () => {},
  };
  const manager = new PlanManagerService(
    new PlanParserService(), new PlanExportService(), persistence,
  );
  const raw = { plan: { items: { item_1: { name: 'sofa', pc: { x: 100, y: 200 } } } } };
  manager.loadPlan(raw);
  const edit = (key: string) => manager.replaceFurnitureAsset('item_1', key);
  return { manager, saves, edit, raw };
}

test('older save cannot clear edits made while it was in flight', async (t) => {
  const { manager, saves, edit } = setup(t);
  edit('chair');
  const older = manager.saveCurrentPlan();
  edit('bed');
  saves[0].resolve(true);
  assert.equal(await older, true);
  assert.equal(manager.hasUnsavedChanges(), true);
  const latest = manager.saveCurrentPlan();
  assert.equal(JSON.parse(saves[1].json).plan.items.item_1.assetKey, 'bed');
  saves[1].resolve(true);
  assert.equal(await latest, true);
  assert.equal(manager.hasUnsavedChanges(), false);
});

test('older success cannot clear dirty state when the newer save fails', async (t) => {
  const { manager, saves, edit } = setup(t);
  edit('chair');
  const older = manager.saveCurrentPlan();
  edit('bed');
  const newer = manager.saveCurrentPlan();
  saves[1].resolve(false);
  assert.equal(await newer, false);
  saves[0].resolve(true);
  await older;
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('out-of-order save completions cannot clear a third unsaved edit', async (t) => {
  const { manager, saves, edit } = setup(t);
  edit('chair');
  const older = manager.saveCurrentPlan();
  edit('bed');
  const newer = manager.saveCurrentPlan();
  edit('table');
  saves[1].resolve(true);
  await newer;
  assert.equal(manager.hasUnsavedChanges(), true);
  saves[0].resolve(true);
  await older;
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('a successful save of the current revision clears dirty state', async (t) => {
  const { manager, saves, edit } = setup(t);
  edit('chair');
  const older = manager.saveCurrentPlan();
  edit('bed');
  const newer = manager.saveCurrentPlan();
  saves[1].resolve(true);
  await newer;
  assert.equal(manager.hasUnsavedChanges(), false);
  saves[0].resolve(true);
  await older;
  assert.equal(manager.hasUnsavedChanges(), false);
});

test('loading another plan invalidates saves of the previous plan', async (t) => {
  const { manager, saves, edit, raw } = setup(t);
  edit('chair');
  const older = manager.saveCurrentPlan();
  manager.loadPlan(raw);
  edit('bed');
  saves[0].resolve(true);
  await older;
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('edits never schedule saves, including edits made during a manual save', async (t) => {
  const { manager, saves, edit } = setup(t);
  edit('chair');
  t.mock.timers.tick(10_000);
  assert.equal(saves.length, 0);
  const older = manager.saveCurrentPlan();
  edit('bed');
  saves[0].resolve(true);
  await older;
  assert.equal(manager.hasUnsavedChanges(), true);
  t.mock.timers.tick(10_000);
  assert.equal(saves.length, 1);
  const latest = manager.saveCurrentPlan();
  saves[1].resolve(true);
  await latest;
  assert.equal(manager.hasUnsavedChanges(), false);
});
