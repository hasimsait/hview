import { IPlanPersistenceService, PlanSaveStatus, PlanSaveStatusListener } from '@core/types/services';

const STORAGE_KEY = 'hview_current_plan';
const STORAGE_TIME_KEY = 'hview_current_plan_timestamp';

function sanitizePlanJson(rawJson: string): string {
  try {
    const raw = JSON.parse(rawJson);
    const planObj = raw.plan || raw;
    if (planObj && planObj.walls && typeof planObj.walls === 'object' && !Array.isArray(planObj.walls)) {
      const wallKeys = Object.keys(planObj.walls);
      const wallKeySet = new Set(wallKeys);
      let changed = false;
      for (const k of wallKeys) {
        if (wallKeySet.has(`${k}_a`) || wallKeySet.has(`${k}_b`)) {
          delete planObj.walls[k];
          changed = true;
        }
      }
      if (changed) return JSON.stringify(raw);
    }
  } catch {}
  return rawJson;
}

export class PlanPersistenceService implements IPlanPersistenceService {
  private status: PlanSaveStatus = 'idle';
  private listeners = new Set<PlanSaveStatusListener>();
  private saveTimeout: number | null = null;
  private latestPlanJson: string | null = null;
  private saveGeneration = 0;
  private serverSaveQueue: Promise<void> | null = null;

  constructor() {
    // Synchronous emergency persistence on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.latestPlanJson) {
          this.writeCache(this.latestPlanJson);
          try {
            if (!this.serverSaveQueue && typeof navigator !== 'undefined' && navigator.sendBeacon) {
              const blob = new Blob([this.latestPlanJson], { type: 'application/json' });
              navigator.sendBeacon('/api/save-plan', blob);
            }
          } catch {
            // Unload cannot wait for server confirmation.
          }
        }
      });
    }
  }

  getSaveStatus(): PlanSaveStatus {
    return this.status;
  }

  onSaveStatusChange(listener: PlanSaveStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: PlanSaveStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /** Stage every edit synchronously, before the server autosave debounce. */
  cachePlan(planJson: string): boolean {
    this.latestPlanJson = sanitizePlanJson(planJson);
    this.saveGeneration++;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.setStatus('saving');
    return this.writeCache(this.latestPlanJson);
  }

  private writeCache(json: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      console.warn('[PlanPersistenceService] Failed to cache plan:', err);
      return false;
    }
    try {
      localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
    } catch {
      // The plan itself was saved; timestamp metadata is optional.
    }
    return true;
  }

  private finishSave(generation: number, ok: boolean): void {
    if (generation !== this.saveGeneration) return;
    this.setStatus(ok ? 'saved' : 'error');
    if (ok) {
      this.saveTimeout = globalThis.setTimeout(() => {
        if (generation === this.saveGeneration && this.status === 'saved') {
          this.setStatus('idle');
        }
      }, 3000) as unknown as number;
    }
  }

  async savePlan(planJson: string): Promise<boolean> {
    const cached = this.cachePlan(planJson);
    const cleanJson = this.latestPlanJson!;
    const generation = this.saveGeneration;

    // Send writes in invocation order. A delayed older request must finish
    // before a newer snapshot can reach the server.
    const previous = this.serverSaveQueue;
    let release!: () => void;
    const queued = new Promise<void>((resolve) => { release = resolve; });
    this.serverSaveQueue = queued;
    if (previous) await previous;

    let ok = false;
    try {
      const res = await fetch('/api/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cleanJson,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      ok = true;
      if (!cached && generation === this.saveGeneration && typeof window !== 'undefined') {
        // A successful server save must not reload an older browser snapshot
        // when quota errors prevented updating it.
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_TIME_KEY);
        } catch {
          // Blocked storage is also handled by loadPlan's fallback path.
        }
      }
    } catch (err) {
      const offline = typeof window !== 'undefined' &&
        ((window as any).__STANDALONE_MODE__ || window.location.protocol === 'file:');
      ok = cached && !!offline;
      if (!ok) console.warn('[PlanPersistenceService] Failed to save plan to server:', err);
    } finally {
      if (this.serverSaveQueue === queued) this.serverSaveQueue = null;
      release();
    }
    this.finishSave(generation, ok);
    return ok;
  }

  async loadPlan(): Promise<string> {
    // Browser edits are the working copy. Never replace them with a stale
    // server template when reconnecting after an offline save.
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached && cached.trim().startsWith('{')) {
          JSON.parse(cached);
          this.latestPlanJson = sanitizePlanJson(cached);
          return this.latestPlanJson;
        }
      } catch (err) {
        console.warn('[PlanPersistenceService] Could not read cached plan:', err);
      }

      // A downloaded editor can start from its embedded plan without network.
      const raw = (window as any).__PLAN_DATA__;
      const embeddedScript = typeof document !== 'undefined' ? document.getElementById('plan-data') : null;
      const embedded = raw ? (typeof raw === 'string' ? raw : JSON.stringify(raw)) : embeddedScript?.textContent;
      if (embedded?.trim().startsWith('{')) {
        try {
          JSON.parse(embedded);
          this.latestPlanJson = sanitizePlanJson(embedded);
          return this.latestPlanJson;
        } catch (err) {
          console.warn('[PlanPersistenceService] Could not read embedded plan:', err);
        }
      }
    }

    try {
      const res = await fetch(`/sample.plan?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          JSON.parse(text);
          this.latestPlanJson = sanitizePlanJson(text);
          this.writeCache(this.latestPlanJson);
          return this.latestPlanJson;
        }
      }
    } catch (err) {
      console.warn('[PlanPersistenceService] Could not fetch /sample.plan:', err);
    }
    throw new Error('Unable to load plan from disk or storage.');
  }

  async resetToTemplate(): Promise<string> {
    const generation = ++this.saveGeneration;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.setStatus('saving');
    try {
      // A prior write must not land after the reset and restore old edits.
      if (this.serverSaveQueue) await this.serverSaveQueue;
      const res = await fetch('/api/reset-plan', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to reset plan: ${res.statusText}`);
      }
      const data = await res.json();
      if (generation === this.saveGeneration) {
        this.latestPlanJson = sanitizePlanJson(data.plan);
        this.writeCache(this.latestPlanJson);
        this.setStatus('idle');
      }
      return data.plan;
    } catch (err) {
      if (generation === this.saveGeneration) this.setStatus('error');
      throw err;
    }
  }
}
