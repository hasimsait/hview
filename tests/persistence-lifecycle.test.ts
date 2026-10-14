import assert from 'node:assert/strict';
import { test, TestContext } from 'node:test';
import { PlanPersistenceService } from '../src/services/plan/PlanPersistenceService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const stored = new Map<string, string>();
  const unload: (() => void)[] = [];
  const pending: ((response: Response) => void)[] = [];
  const globals = ['window', 'localStorage'] as const;
  const originals = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const storage = {
    setItem: (key: string, value: string) => { stored.set(key, value); },
    getItem: (key: string) => stored.get(key) ?? null,
    removeItem: (key: string) => { stored.delete(key); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __STANDALONE_MODE__: false, __PLAN_DATA__: { embedded: true },
    location: { protocol: 'https:' }, setTimeout: globalThis.setTimeout,
    addEventListener: (_event: string, handler: () => void) => unload.push(handler),
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => globals.forEach((key, index) => {
    if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!);
    else delete (globalThis as any)[key];
  }));
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => pending.push(resolve)));
  return { service: new PlanPersistenceService(), stored, storage, unload, pending };
}

test('newer local edits survive loading a stale server plan', async (t) => {
  const { service, stored, pending } = setup(t);
  stored.set('hview_current_plan', '{"edited":true}');
  const load = service.loadPlan();
  assert.equal(await load, '{"edited":true}');
  assert.equal(pending.length, 0);
});

test('blocked storage still allows the embedded offline plan to load', async (t) => {
  const { service, storage, pending } = setup(t);
  t.mock.method(storage, 'getItem', () => { throw new DOMException('Blocked', 'SecurityError'); });
  const load = service.loadPlan();
  assert.deepEqual(JSON.parse(await load), { embedded: true });
  assert.equal(pending.length, 0);
});

test('older save completion cannot change the status of a newer pending save', async (t) => {
  const { service, pending } = setup(t);
  const first = service.savePlan('{"revision":1}');
  const second = service.savePlan('{"revision":2}');
  pending[0](new Response('{"success":true}'));
  await first;
  const status = service.getSaveStatus();
  pending[1](new Response('{"success":true}'));
  await second;
  assert.equal(status, 'saving');
});

test('overlapping saves cannot send an older write concurrently with a newer write', async (t) => {
  const { service, pending } = setup(t);
  const first = service.savePlan('{"revision":1}');
  const second = service.savePlan('{"revision":2}');
  const concurrent = pending.length;
  pending[0](new Response('{"success":true}'));
  await first;
  await Promise.resolve();
  pending[1](new Response('{"success":true}'));
  await second;
  assert.equal(concurrent, 1);
});

test('reloading before the autosave debounce expires persists the latest edit', async (t) => {
  const { service, stored, unload, pending } = setup(t);
  const manager = new PlanManagerService(new PlanParserService(), new PlanExportService(), service);
  manager.loadPlan({ plan: { items: { item_1: { name: 'sofa', pc: { x: 0, y: 0 } } } } });
  const save = manager.saveCurrentPlan();
  pending[0](new Response('{"success":true}'));
  await save;
  manager.replaceFurnitureAsset('item_1', 'chair');
  unload[0]();
  assert.equal(JSON.parse(stored.get('hview_current_plan')!).plan.items.item_1.assetKey, 'chair');
});

test('a failed older write releases the queue and cannot mark a newer save failed', async (t) => {
  const { service, pending } = setup(t);
  const first = service.savePlan('{"revision":1}');
  const second = service.savePlan('{"revision":2}');
  pending[0](new Response('', { status: 500 }));
  await first;
  assert.equal(service.getSaveStatus(), 'saving');
  assert.equal(pending.length, 2);
  pending[1](new Response('{"success":true}'));
  assert.equal(await second, true);
  assert.equal(service.getSaveStatus(), 'saved');
});

test('an edit during a save invalidates its completion and idle timer', async (t) => {
  const { service, pending, stored } = setup(t);
  const save = service.savePlan('{"revision":1}');
  service.cachePlan('{"revision":2}');
  pending[0](new Response('{"success":true}'));
  await save;
  assert.equal(service.getSaveStatus(), 'saving');
  t.mock.timers.tick(5000);
  assert.equal(service.getSaveStatus(), 'saving');
  assert.equal(stored.get('hview_current_plan'), '{"revision":2}');
});

test('reset waits for earlier writes and replaces the snapshot used on unload', async (t) => {
  const { service, pending, stored, unload } = setup(t);
  const save = service.savePlan('{"old":true}');
  const reset = service.resetToTemplate();
  assert.equal(pending.length, 1);
  pending[0](new Response('{"success":true}'));
  await save;
  assert.equal(pending.length, 2);
  pending[1](new Response(JSON.stringify({ plan: '{"template":true}' })));
  assert.equal(await reset, '{"template":true}');
  unload[0]();
  assert.equal(stored.get('hview_current_plan'), '{"template":true}');
  assert.equal(service.getSaveStatus(), 'idle');
});

test('unload cannot bypass queued writes with a competing beacon', async (t) => {
  const { service, pending, unload, stored } = setup(t);
  const beacon = t.mock.fn(() => true);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: beacon } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as any).navigator;
  });
  const save = service.savePlan('{"revision":1}');
  service.cachePlan('{"revision":2}');
  unload[0]();
  assert.equal(beacon.mock.callCount(), 0);
  assert.equal(stored.get('hview_current_plan'), '{"revision":2}');
  pending[0](new Response('{"success":true}'));
  await save;
});

test('missing local and embedded data falls back to the server', async (t) => {
  const { service, pending, stored } = setup(t);
  delete (globalThis as any).window.__PLAN_DATA__;
  const load = service.loadPlan();
  pending[0](new Response('{"server":true}'));
  assert.equal(await load, '{"server":true}');
  assert.equal(stored.get('hview_current_plan'), '{"server":true}');
});

test('server success after a quota error invalidates a stale local snapshot', async (t) => {
  const { service, pending, storage, stored } = setup(t);
  stored.set('hview_current_plan', '{"revision":1}');
  t.mock.method(storage, 'setItem', () => { throw new DOMException('Full', 'QuotaExceededError'); });
  const save = service.savePlan('{"revision":2}');
  pending[0](new Response('{"success":true}'));
  assert.equal(await save, true);
  assert.equal(stored.has('hview_current_plan'), false);
  delete (globalThis as any).window.__PLAN_DATA__;
  const load = service.loadPlan();
  pending[1](new Response('{"revision":2}'));
  assert.equal(await load, '{"revision":2}');
});
