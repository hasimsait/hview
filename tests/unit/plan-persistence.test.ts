// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPersistenceService } from '../../src/services/plan/PlanPersistenceService';

const json = JSON.stringify({ plan: { walls: {}, items: {} } });

describe('plan persistence', () => {
  let service: PlanPersistenceService;
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear();
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    service = new PlanPersistenceService();
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
    delete (window as any).__STANDALONE_MODE__; delete (window as any).__PLAN_DATA__;
    document.body.innerHTML = '';
  });
  it('backs up locally and reports saving, saved, then idle', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    const listener = vi.fn(); service.onSaveStatusChange(listener);
    expect(await service.savePlan(json)).toBe(true);
    expect(localStorage.getItem('hview_current_plan')).toBe(json);
    expect(fetchMock).toHaveBeenCalledWith('/api/save-plan', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, signal: expect.any(AbortSignal) }));
    expect(listener.mock.calls.map(call => call[0])).toEqual(['idle', 'saving', 'saved']);
    await vi.advanceTimersByTimeAsync(3000);
    expect(service.getSaveStatus()).toBe('idle');
  });
  it('sanitizes superseded walls before saving to disk and local storage', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    await service.savePlan(JSON.stringify({ plan: { walls: { w: {}, w_a: {}, w_b: {} } } }));
    const saved = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(saved.plan.walls)).toEqual(['w_a', 'w_b']);
    expect(JSON.parse(localStorage.getItem('hview_current_plan')!)).toEqual(saved);
  });
  it('keeps the local backup and reports failure on HTTP errors', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    expect(await service.savePlan(json)).toBe(false);
    expect(service.getSaveStatus()).toBe('error');
    expect(localStorage.getItem('hview_current_plan')).toBe(json);
  });
  it('uses local persistence as success in standalone offline mode', async () => {
    (window as any).__STANDALONE_MODE__ = true;
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(await service.savePlan(json)).toBe(true);
    expect(localStorage.getItem('hview_current_plan')).toBe(json);
    await vi.advanceTimersByTimeAsync(3000);
    expect(service.getSaveStatus()).toBe('idle');
  });
  it('continues server persistence when local storage is full', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    expect(await service.savePlan(json)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not report an offline save as successful when storage is full', async () => {
    const previous = '{"previous":true}';
    localStorage.setItem('hview_current_plan', previous);
    (window as any).__STANDALONE_MODE__ = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError'); });
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const saved = await service.savePlan(json);
    expect(localStorage.getItem('hview_current_plan')).toBe(previous);
    expect(saved, 'neither disk nor localStorage accepted the edited plan').toBe(false);
    expect(service.getSaveStatus()).toBe('error');
  });
  it('preserves the cached working copy without replacing it with a server template', async () => {
    localStorage.setItem('hview_current_plan', '{"old":true}');
    fetchMock.mockResolvedValue(new Response(json));
    expect(await service.loadPlan()).toBe('{"old":true}');
    expect(localStorage.getItem('hview_current_plan')).toBe('{"old":true}');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['network', 'http', 'html'])('falls back to cached plan after %s failure', failure => {
    localStorage.setItem('hview_current_plan', json);
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
    else fetchMock.mockResolvedValue(new Response(failure === 'html' ? '<html>wrong</html>' : '', { status: failure === 'http' ? 404 : 200 }));
    return expect(service.loadPlan()).resolves.toBe(json);
  });
  it('falls back to inlined standalone data', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    (window as any).__PLAN_DATA__ = JSON.parse(json);
    expect(await service.loadPlan()).toBe(json);
  });
  it('falls back to the embedded plan script', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const script = document.createElement('script'); script.id = 'plan-data'; script.type = 'application/json'; script.textContent = json;
    document.body.append(script);
    expect(await service.loadPlan()).toBe(json);
  });
  it('rejects loading when every source is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(service.loadPlan()).rejects.toThrow('Unable to load plan');
  });
  it('updates the backup to the original plan after a successful reset', async () => {
    localStorage.setItem('hview_current_plan', json);
    localStorage.setItem('hview_current_plan_timestamp', '123');
    fetchMock.mockResolvedValue(Response.json({ plan: json }));
    expect(await service.resetToTemplate()).toBe(json);
    expect(localStorage.getItem('hview_current_plan')).toBe(json);
    expect(localStorage.getItem('hview_current_plan_timestamp')).not.toBe('123');
    expect(service.getSaveStatus()).toBe('idle');
  });
  it('keeps the backup when template reset fails', async () => {
    localStorage.setItem('hview_current_plan', json);
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await expect(service.resetToTemplate()).rejects.toThrow('Failed to reset');
    expect(localStorage.getItem('hview_current_plan')).toBe(json);
    expect(service.getSaveStatus()).toBe('error');
  });
  it('stops notifications after unsubscribe', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }));
    const listener = vi.fn(); const unsubscribe = service.onSaveStatusChange(listener);
    unsubscribe(); await service.savePlan(json);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
