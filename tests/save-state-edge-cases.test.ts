import assert from 'node:assert/strict';
import { test, TestContext } from 'node:test';
import { PlanPersistenceService } from '../src/services/plan/PlanPersistenceService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';
import { restoreInitialPlan } from '../src/services/plan/PlanBootstrap';

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const stored = new Map<string, string>();
  const unload: (() => void)[] = [];
  const pending: { url: string; body?: string; resolve: (response: Response) => void; reject: (reason: Error) => void }[] = [];
  const globals = ['window', 'localStorage', 'document', 'navigator'] as const;
  const originals = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const browser = { location: { protocol: 'https:', pathname: '/' }, __STANDALONE_MODE__: false,
    __PLAN_DATA__: undefined as unknown, addEventListener: (_event: string, cb: () => void) => unload.push(cb) };
  let embedded = '';
  const beacon = t.mock.fn(() => true);
  for (const [key, value] of Object.entries({
    window: browser,
    localStorage: { setItem: (key: string, value: string) => stored.set(key, value), getItem: (key: string) => stored.get(key) ?? null, removeItem: (key: string) => stored.delete(key) },
    document: { getElementById: () => ({ textContent: embedded }) },
    navigator: { sendBeacon: beacon },
  })) Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => globals.forEach((key, index) => {
    if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!);
    else delete (globalThis as any)[key];
  }));
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', (url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((resolve, reject) => {
    pending.push({ url: String(url), body: options?.body as string | undefined, resolve, reject });
  }));
  const service = new PlanPersistenceService();
  const manager = new PlanManagerService(new PlanParserService(), new PlanExportService(), service);
  const plan = (name: string) => ({ plan: { items: { f: { name, pc: { x: 0, y: 0 } } } } });
  return { service, manager, stored, pending, browser, unload, beacon, plan, embed: (json: string) => { embedded = json; } };
}

const saved = () => new Response('{"success":true}');

test('importing another plan replaces the cached snapshot used on unload', async (t) => {
  const { manager, stored, unload, pending, plan } = setup(t);
  manager.loadPlan(plan('sofa'));
  const save = manager.saveCurrentPlan();
  pending[0].resolve(saved());
  await save;
  manager.loadPlan(plan('chair'));
  unload[0]();
  assert.equal(JSON.parse(stored.get('hview_current_plan')!).plan.items.f.name, 'chair');
});

test('loading another plan invalidates the previous save status', async (t) => {
  const { manager, service, pending, plan } = setup(t);
  manager.loadPlan(plan('sofa'));
  const save = manager.saveCurrentPlan();
  manager.loadPlan(plan('chair'));
  pending[0].resolve(saved());
  await save;
  assert.equal(service.getSaveStatus(), 'idle');
  assert.equal(manager.hasUnsavedChanges(), false);
});

test('a delayed server load cannot replace an edit staged while it was loading', async (t) => {
  const { service, pending, stored } = setup(t);
  const load = service.loadPlan();
  service.cachePlan('{"new":true}');
  pending[0].resolve(new Response('{"new":false}'));
  assert.equal(await load, '{"new":true}');
  assert.equal(stored.get('hview_current_plan'), '{"new":true}');
});

test('invalid embedded global data falls back to a valid embedded script', async (t) => {
  const { service, browser, embed, pending } = setup(t);
  browser.__PLAN_DATA__ = '{broken';
  embed('{"script":true}');
  const load = service.loadPlan();
  if (pending.length) pending[0].resolve(new Response('', { status: 404 }));
  assert.equal(await load, '{"script":true}');
});

test('an HTTP 200 page without a save acknowledgement does not count as a server save', async (t) => {
  const { service, pending } = setup(t);
  const save = service.savePlan('{"edit":true}');
  pending[0].resolve(new Response('<html>SPA fallback</html>'));
  assert.equal(await save, false);
  assert.equal(service.getSaveStatus(), 'error');
});

test('an explicit negative server acknowledgement is not success', async (t) => {
  const { service, pending } = setup(t);
  const save = service.savePlan('{"edit":true}');
  pending[0].resolve(new Response('{"success":false}'));
  assert.equal(await save, false);
});

test('throwing status subscribers cannot prevent a save or block later subscribers', async (t) => {
  const { service, pending } = setup(t);
  let observed = '';
  service.onSaveStatusChange((status) => { if (status === 'saving') throw new Error('UI failure'); });
  service.onSaveStatusChange((status) => { observed = status; });
  const save = service.savePlan('{"edit":true}');
  if (pending.length) pending[0].resolve(saved());
  assert.equal(await save, true);
  assert.equal(observed, 'saved');
});

test('reset and a later save use the same server write queue', async (t) => {
  const { service, pending } = setup(t);
  const reset = service.resetToTemplate();
  const save = service.savePlan('{"new":true}');
  const concurrent = pending.length;
  pending[0].resolve(new Response('{"plan":"{\\"template\\":true}"}'));
  await reset;
  await Promise.resolve();
  pending[1].resolve(saved());
  await save;
  assert.equal(concurrent, 1);
  assert.equal(pending[1].url, '/api/save-plan');
});

test('an edit made during reset survives the reset response', async (t) => {
  const { manager, pending, plan } = setup(t);
  manager.loadPlan(plan('sofa'));
  const reset = manager.resetToTemplate();
  manager.replaceFurnitureAsset('f', 'chair');
  pending[0].resolve(new Response(JSON.stringify({ plan: JSON.stringify(plan('sofa')) })));
  await reset;
  assert.equal(manager.getPlan()!.furniture[0].assetKey, 'chair');
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('malformed save JSON cannot replace a valid offline snapshot', async (t) => {
  const { service, browser, stored, pending } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  service.cachePlan('{"good":true}');
  const save = service.savePlan('{broken');
  if (pending.length) pending[0].reject(new Error('offline'));
  assert.equal(await save, false);
  assert.equal(stored.get('hview_current_plan'), '{"good":true}');
});

test('a rejected persistence promise leaves dirty state and returns failure', async (t) => {
  const { manager, service, plan } = setup(t);
  manager.loadPlan(plan('sofa'));
  manager.replaceFurnitureAsset('f', 'chair');
  t.mock.method(service, 'savePlan', async () => { throw new Error('Storage failure'); });
  assert.equal(await manager.saveCurrentPlan(), false);
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('corrupt local storage falls back to the embedded plan without network', async (t) => {
  const { service, browser, stored, pending } = setup(t);
  stored.set('hview_current_plan', '{corrupt');
  browser.__PLAN_DATA__ = { embedded: true };
  assert.equal(await service.loadPlan(), '{"embedded":true}');
  assert.equal(pending.length, 0);
});

test('queued writes of a previous document are skipped after importing a new one', async (t) => {
  const { manager, pending, plan, stored } = setup(t);
  manager.loadPlan(plan('sofa'));
  const first = manager.saveCurrentPlan();
  const second = manager.saveCurrentPlan();
  manager.loadPlan(plan('chair'));
  pending[0].resolve(saved());
  await first;
  assert.equal(await second, false);
  assert.equal(pending.length, 1);
  assert.equal(JSON.parse(stored.get('hview_current_plan')!).plan.items.f.name, 'chair');
});

test('failed reset releases a later save and cannot overwrite its status', async (t) => {
  const { service, pending } = setup(t);
  const reset = service.resetToTemplate();
  const save = service.savePlan('{"new":true}');
  const rejected = assert.rejects(reset, /reset/);
  pending[0].resolve(new Response('', { status: 500 }));
  await rejected;
  assert.equal(service.getSaveStatus(), 'saving');
  pending[1].resolve(saved());
  assert.equal(await save, true);
  assert.equal(service.getSaveStatus(), 'saved');
});

test('failed reset reschedules the cancelled autosave', async (t) => {
  const { manager, pending, plan } = setup(t);
  manager.loadPlan(plan('sofa'));
  manager.replaceFurnitureAsset('f', 'chair');
  const reset = manager.resetToTemplate();
  const rejected = assert.rejects(reset);
  pending[0].resolve(new Response('', { status: 500 }));
  await rejected;
  t.mock.timers.tick(600);
  assert.equal(pending[1].url, '/api/save-plan');
  assert.equal(JSON.parse(pending[1].body!).plan.items.f.assetKey, 'chair');
  pending[1].resolve(saved());
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(manager.hasUnsavedChanges(), false);
});

test('malformed reset data cannot replace the active plan or its cache', async (t) => {
  const { manager, pending, plan, stored } = setup(t);
  manager.loadPlan(plan('chair'));
  const reset = manager.resetToTemplate();
  const rejected = assert.rejects(reset);
  pending[0].resolve(new Response('{"plan":"{broken"}'));
  await rejected;
  assert.equal(manager.getPlan()!.furniture[0].assetKey, 'chair');
  assert.equal(JSON.parse(stored.get('hview_current_plan')!).plan.items.f.name, 'chair');
});

test('an imported plan during reset survives the reset response', async (t) => {
  const { manager, pending, plan, stored } = setup(t);
  manager.loadPlan(plan('sofa'));
  const reset = manager.resetToTemplate();
  manager.loadPlan(plan('chair'));
  pending[0].resolve(new Response(JSON.stringify({ plan: JSON.stringify(plan('sofa')) })));
  await reset;
  assert.equal(manager.getPlan()!.furniture[0].assetKey, 'chair');
  assert.equal(JSON.parse(stored.get('hview_current_plan')!).plan.items.f.name, 'chair');
});

test('a hung save times out and releases the next queued save', async (t) => {
  const { service, pending } = setup(t);
  const first = service.savePlan('{"revision":1}');
  const second = service.savePlan('{"revision":2}');
  t.mock.timers.tick(15000);
  assert.equal(await first, false);
  assert.equal(service.getSaveStatus(), 'saving');
  assert.equal(pending.length, 2);
  pending[1].resolve(saved());
  assert.equal(await second, true);
  assert.equal(service.getSaveStatus(), 'saved');
});

test('a hanging response body also times out instead of blocking saves forever', async (t) => {
  const { service, pending } = setup(t);
  const save = service.savePlan('{"new":true}');
  const response = saved();
  t.mock.method(response, 'json', () => new Promise(() => {}));
  pending[0].resolve(response);
  await Promise.resolve();
  t.mock.timers.tick(15000);
  assert.equal(await save, false);
  assert.equal(service.getSaveStatus(), 'error');
});

test('standalone documents on different paths have separate cached working copies', async (t) => {
  const { browser } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  browser.location.pathname = '/editor-a.html';
  const first = new PlanPersistenceService();
  first.cachePlan('{"document":"a"}');
  browser.location.pathname = '/editor-b.html';
  browser.__PLAN_DATA__ = { document: 'b' };
  const second = new PlanPersistenceService();
  assert.equal(await second.loadPlan(), '{"document":"b"}');
  second.cachePlan('{"document":"b-edited"}');
  browser.location.pathname = '/editor-a.html';
  assert.equal(await new PlanPersistenceService().loadPlan(), '{"document":"a"}');
});

test('a circular embedded global cannot prevent valid script fallback', async (t) => {
  const { service, browser, embed } = setup(t);
  const circular: any = {};
  circular.self = circular;
  browser.__PLAN_DATA__ = circular;
  embed('{"script":true}');
  assert.equal(await service.loadPlan(), '{"script":true}');
});

test('a throwing initial status subscriber is isolated', (t) => {
  const { service } = setup(t);
  assert.doesNotThrow(() => service.onSaveStatusChange(() => { throw new Error('Subscriber failure'); }));
  let observed = '';
  service.onSaveStatusChange((status) => { observed = status; });
  assert.equal(observed, 'idle');
});

test('a delayed URL load cannot replace edits made while it was loading', async (t) => {
  const { manager, plan, pending } = setup(t);
  manager.loadPlan(plan('sofa'));
  const load = manager.loadPlanFromUrl('/other.plan');
  manager.replaceFurnitureAsset('f', 'chair');
  pending[0].resolve(new Response(JSON.stringify(plan('sofa'))));
  await load;
  assert.equal(manager.getPlan()!.furniture[0].assetKey, 'chair');
  assert.equal(manager.hasUnsavedChanges(), true);
});

test('the most recently requested URL load wins even if an older request finishes first', async (t) => {
  const { manager, plan, pending } = setup(t);
  manager.loadPlan(plan('sofa'));
  const first = manager.loadPlanFromUrl('/older.plan');
  const second = manager.loadPlanFromUrl('/newer.plan');
  pending[0].resolve(new Response(JSON.stringify(plan('bed'))));
  await first;
  assert.equal(manager.getPlan()!.furniture[0].name, 'sofa');
  pending[1].resolve(new Response(JSON.stringify(plan('chair'))));
  await second;
  assert.equal(manager.getPlan()!.furniture[0].name, 'chair');
});

test('a hung URL load times out and preserves the active plan', async (t) => {
  const { manager, plan } = setup(t);
  manager.loadPlan(plan('chair'));
  const load = manager.loadPlanFromUrl('/hung.plan');
  const rejected = assert.rejects(load, /timed out/);
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(manager.getPlan()!.furniture[0].name, 'chair');
});

test('negative reset acknowledgement preserves the active plan', async (t) => {
  const { manager, plan, pending } = setup(t);
  manager.loadPlan(plan('chair'));
  const reset = manager.resetToTemplate();
  const rejected = assert.rejects(reset, /rejected/);
  pending[0].resolve(new Response(JSON.stringify({ success: false, plan: JSON.stringify(plan('sofa')) })));
  await rejected;
  assert.equal(manager.getPlan()!.furniture[0].name, 'chair');
});

test('closing a stale tab does not replace another tab’s newer cached snapshot', (t) => {
  const { service, stored, unload, beacon } = setup(t);
  service.cachePlan('{"revision":1}');
  const secondTab = new PlanPersistenceService();
  secondTab.cachePlan('{"revision":2}');
  unload[0]();
  assert.equal(stored.get('hview_current_plan'), '{"revision":2}');
  assert.equal(beacon.mock.callCount(), 0);
});

test('closing a tab after a confirmed server save does not send a redundant write', async (t) => {
  const { service, pending, unload, beacon } = setup(t);
  const save = service.savePlan('{"revision":1}');
  pending[0].resolve(saved());
  assert.equal(await save, true);
  unload[0]();
  assert.equal(beacon.mock.callCount(), 0);
});

test('standalone saves never write an unrelated hosting API', async (t) => {
  const { service, browser, pending, stored } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  assert.equal(await service.savePlan('{"standalone":true}'), true);
  assert.equal(pending.length, 0);
  assert.equal(stored.get('hview_current_plan'), '{"standalone":true}');
});

test('full standalone storage reports failure without treating a hosting API as recovery', async (t) => {
  const { service, browser, pending } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  t.mock.method(localStorage, 'setItem', () => { throw new DOMException('Full', 'QuotaExceededError'); });
  assert.equal(await service.savePlan('{"standalone":true}'), false);
  assert.equal(service.getSaveStatus(), 'error');
  assert.equal(pending.length, 0);
});

test('standalone reset restores its embedded baseline without touching the host', async (t) => {
  const { service, browser, pending, stored } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  browser.__PLAN_DATA__ = { original: true };
  service.cachePlan('{"edited":true}');
  assert.equal(await service.resetToTemplate(), '{"original":true}');
  assert.equal(stored.get('hview_current_plan'), '{"original":true}');
  assert.equal(pending.length, 0);
});

test('a standalone file with no valid data fails rather than loading an unrelated host plan', async (t) => {
  const { service, browser, pending } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  await assert.rejects(service.loadPlan(), /offline plan/);
  assert.equal(pending.length, 0);
});

test('the application bootstrap does not bypass standalone source isolation on failure', async (t) => {
  const { service, manager, browser, pending } = setup(t);
  browser.__STANDALONE_MODE__ = true;
  await assert.rejects(restoreInitialPlan(manager, service), /offline plan/);
  assert.equal(pending.length, 0);
  assert.equal(manager.getPlan(), null);
});

test('an import completed during initial loading is preserved by the application bootstrap', async (t) => {
  const { service, manager, pending, plan } = setup(t);
  const restore = restoreInitialPlan(manager, service);
  manager.loadPlan(plan('chair'));
  manager.replaceFurnitureAsset('f', 'bed');
  pending[0].resolve(new Response(JSON.stringify(plan('sofa'))));
  await restore;
  assert.equal(manager.getPlan()!.furniture[0].assetKey, 'bed');
  assert.equal(manager.hasUnsavedChanges(), true);
});
