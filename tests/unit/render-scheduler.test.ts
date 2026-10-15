import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenderScheduler } from '../../src/engine/RenderScheduler';

afterEach(() => vi.unstubAllGlobals());
describe('render scheduling', () => {
  function fixture() {
    const pending = new Map<number, FrameRequestCallback>(); let sequence = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++sequence, callback); return sequence; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
    const render = vi.fn(); let active = false;
    const scheduler = new RenderScheduler(render, () => active);
    const frame = (time = 16) => { const [id, callback] = [...pending][0]; pending.delete(id); callback(time); };
    return { scheduler, pending, render, frame, activate: () => { active = true; }, stop: () => { active = false; } };
  }
  it('coalesces updates and sleeps when there is no active input', () => {
    const { scheduler, pending, render, frame } = fixture();
    expect(pending.size).toBe(0); scheduler.invalidate(); scheduler.invalidate(); expect(pending.size).toBe(1);
    frame(); expect(render).toHaveBeenCalledOnce(); expect(pending.size).toBe(0);
  });
  it('keeps drawing during navigation and stops on release', () => {
    const { scheduler, pending, frame, activate, stop } = fixture();
    activate(); scheduler.invalidate(); frame(); expect(pending.size).toBe(1);
    stop(); frame(32); expect(pending.size).toBe(0);
  });
  it('cancels pending work on disposal and ignores later invalidations', () => {
    const { scheduler, pending } = fixture(); scheduler.invalidate(); scheduler.dispose(); scheduler.invalidate(); expect(pending.size).toBe(0);
  });
  it('pauses pending draws during context loss and redraws after restoration', () => {
    const { scheduler, pending, render, frame } = fixture();
    scheduler.invalidate(); scheduler.suspend(); scheduler.invalidate();
    expect(pending.size).toBe(0);
    scheduler.resume(); scheduler.resume();
    expect(pending.size).toBe(1);
    frame(); expect(render).toHaveBeenCalledOnce(); expect(pending.size).toBe(0);
    scheduler.dispose(); scheduler.resume(); expect(pending.size).toBe(0);
  });
});
