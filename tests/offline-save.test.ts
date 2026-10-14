import assert from 'node:assert/strict';
import { test, TestContext } from 'node:test';
import { PlanPersistenceService } from '../src/services/plan/PlanPersistenceService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';
import { PlanSaveStatus } from '../src/core/types/services';

function setup(t: TestContext, protocol = 'file:', standalone = false) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const stored = new Map<string, string>();
  let full = false;
  let timestampFull = false;
  let serverAvailable = false;
  const globals = ['window', 'localStorage'] as const;
  const descriptors = globals.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { protocol }, __STANDALONE_MODE__: standalone,
    addEventListener: () => {}, setTimeout: globalThis.setTimeout,
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    setItem: (key: string, value: string) => {
      if (full || (timestampFull && key.endsWith('_timestamp'))) {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      }
      stored.set(key, value);
    },
    getItem: (key: string) => stored.get(key) ?? null,
  } });
  t.after(() => globals.forEach((name, index) => {
    const descriptor = descriptors[index];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as any)[name];
  }));
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => {
    if (!serverAvailable) throw new Error('Network unavailable');
    return new Response('{}');
  });
  const persistence = new PlanPersistenceService();
  const statuses: PlanSaveStatus[] = [];
  persistence.onSaveStatusChange((status) => statuses.push(status));
  return {
    persistence, stored, statuses,
    fillStorage: () => { full = true; },
    freeStorage: () => { full = false; },
    failTimestamp: () => { timestampFull = true; },
    enableServer: () => { serverAvailable = true; },
  };
}

for (const [label, protocol, standalone] of [
  ['local HTML', 'file:', false],
  ['standalone editor served over HTTPS', 'https:', true],
] as const) {
  test(`${label}: full storage plus unavailable network fails and leaves edits dirty`, async (t) => {
    const { persistence, stored, statuses, fillStorage } = setup(t, protocol, standalone);
    stored.set('hview_current_plan', '{"previous":true}');
    fillStorage();
    const manager = new PlanManagerService(new PlanParserService(), new PlanExportService(), persistence);
    manager.loadPlan({ plan: { items: { item_1: { name: 'sofa', pc: { x: 0, y: 0 } } } } });
    manager.replaceFurnitureAsset('item_1', 'chair');
    assert.equal(await manager.saveCurrentPlan(), false);
    assert.equal(manager.hasUnsavedChanges(), true);
    assert.equal(persistence.getSaveStatus(), 'error');
    assert.equal(statuses[0], 'idle');
    assert.equal(statuses.at(-1), 'error');
    assert.equal(statuses.includes('saved'), false);
    assert.equal(stored.get('hview_current_plan'), '{"previous":true}');
    t.mock.timers.tick(3000);
    // The pending autosave retry also fails; let its network rejection settle.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(persistence.getSaveStatus(), 'error');
  });
}

test('offline save succeeds when the plan is stored locally', async (t) => {
  const { persistence, stored } = setup(t);
  const json = '{"plan":{"items":{}}}';
  assert.equal(await persistence.savePlan(json), true);
  assert.equal(stored.get('hview_current_plan'), json);
  assert.equal(persistence.getSaveStatus(), 'saved');
  t.mock.timers.tick(3000);
  assert.equal(persistence.getSaveStatus(), 'idle');
});

test('server save succeeds even when local storage is full', async (t) => {
  const { persistence, fillStorage, enableServer } = setup(t);
  fillStorage();
  enableServer();
  assert.equal(await persistence.savePlan('{}'), true);
  assert.equal(persistence.getSaveStatus(), 'saved');
});

test('failed optional timestamp does not negate a stored plan', async (t) => {
  const { persistence, stored, failTimestamp } = setup(t);
  failTimestamp();
  assert.equal(await persistence.savePlan('{"plan":{}}'), true);
  assert.equal(stored.get('hview_current_plan'), '{"plan":{}}');
  assert.equal(persistence.getSaveStatus(), 'saved');
});

test('a failed save can recover after storage is freed', async (t) => {
  const { persistence, stored, fillStorage, freeStorage } = setup(t);
  fillStorage();
  assert.equal(await persistence.savePlan('{"new":1}'), false);
  freeStorage();
  assert.equal(await persistence.savePlan('{"new":2}'), true);
  assert.equal(stored.get('hview_current_plan'), '{"new":2}');
  assert.equal(persistence.getSaveStatus(), 'saved');
});
