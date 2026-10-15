import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSnapshotStore } from '../../src/platform/persistence/BrowserSnapshotStore';
import { DocumentStorage } from '../../src/platform/persistence/DocumentStorage';
import { isStandalonePlanSource } from '../../src/services/plan/PlanRequest';
import { createElementId } from '../../src/platform/ElementId';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Shortcut data URL startup', () => {
  it('creates element IDs when randomUUID is unavailable outside a secure context', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => {
      bytes.forEach((_, index) => { bytes[index] = index; }); return bytes;
    } });
    expect(createElementId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });
  function opaqueWindow() {
    const pathname = vi.fn(() => { throw new Error('The HTML-sized pathname must never be read'); });
    vi.stubGlobal('window', {
      __STANDALONE_MODE__: true, __PLAN_DATA__: { plan: { items: {} } }, origin: 'null',
      location: { protocol: 'data:', origin: 'null', get pathname() { return pathname(); } },
    });
    // Real opaque origins throw even when obtaining the storage property.
    vi.stubGlobal('localStorage', undefined);
    return pathname;
  }

  it('never reads or encodes the payload pathname and never accesses blocked storage', () => {
    const pathname = opaqueWindow(), encode = vi.spyOn(globalThis, 'encodeURIComponent');
    const store = new BrowserSnapshotStore();
    expect(store.read()).toBeNull(); expect(store.write('{}')).toBe(false);
    expect(() => store.clear()).not.toThrow();
    expect(pathname).not.toHaveBeenCalled(); expect(encode).not.toHaveBeenCalled();
    expect(Object.values(store).filter(value => typeof value === 'string').every(value => value.length < 100)).toBe(true);
  });

  it('loads and resets the embedded plan without a server or durable browser storage', async () => {
    const pathname = opaqueWindow(), fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const service = new DocumentStorage();
    const initial = await service.loadPlan();
    expect(JSON.parse(initial)).toEqual({ plan: { items: {} } });
    expect(await service.resetToTemplate()).toBe(initial);
    expect(await service.savePlan(initial)).toBe(false);
    expect(service.getSaveStatus()).toBe('error');
    expect(isStandalonePlanSource()).toBe(true);
    expect(pathname).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves existing scoped saved copies for ordinary standalone paths', () => {
    vi.stubGlobal('window', { __STANDALONE_MODE__: true, location: { protocol: 'https:', pathname: '/my house.html' } });
    const getItem = vi.fn(() => '{}'), setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });
    const store = new BrowserSnapshotStore();
    expect(store.read()).toBe('{}'); expect(store.write('{}')).toBe(true);
    expect(getItem).toHaveBeenCalledWith('hview_current_plan:%2Fmy%20house.html');
    expect(setItem).toHaveBeenCalledWith('hview_current_plan_timestamp:%2Fmy%20house.html', expect.any(String));
  });

  it('bounds keys for extremely long file paths without percent-encoding another huge copy', () => {
    vi.stubGlobal('window', { location: { protocol: 'file:', pathname: '/' + 'x'.repeat(1024 * 1024) } });
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem });
    const encode = vi.spyOn(globalThis, 'encodeURIComponent');
    const store = new BrowserSnapshotStore();
    expect(store.write('{}')).toBe(true);
    expect(setItem.mock.calls.every(([key]) => key.length < 100)).toBe(true);
    expect(encode).not.toHaveBeenCalled();
  });
});
