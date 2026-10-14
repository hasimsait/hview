import { isStandalonePlanSource, withPlanRequestTimeout } from './PlanRequest';
import { IPlanPersistenceService, PlanSaveStatus, PlanSaveStatusListener } from '@core/types/services';

const STORAGE_KEY = 'hview_current_plan';
const STORAGE_TIME_KEY = 'hview_current_plan_timestamp';

function validatePlanJson(json: string): void {
  const value = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Plan JSON must be an object');
  }
}

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
  private planEpoch = 0;
  private serverSaveQueue: Promise<void> | null = null;
  private cachedSnapshot: string | null = null;
  private needsServerSync = false;
  private readonly storageKey: string;
  private readonly storageTimeKey: string;

  constructor() {
    const offline = typeof window !== 'undefined' &&
      ((window as any).__STANDALONE_MODE__ || window.location.protocol === 'file:');
    const path = typeof window !== 'undefined' ? window.location.pathname : undefined;
    // Downloaded/hosted standalone documents on the same origin need separate working copies.
    const suffix = offline && path && path !== '/' ? `:${encodeURIComponent(path)}` : '';
    this.storageKey = STORAGE_KEY + suffix;
    this.storageTimeKey = STORAGE_TIME_KEY + suffix;
    // Synchronous emergency persistence on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.latestPlanJson) {
          // Closing a stale tab must not replace another tab's newer working copy.
          try {
            if (this.cachedSnapshot !== null && localStorage.getItem(this.storageKey) !== this.cachedSnapshot) return;
          } catch {
            // A blocked read must not prevent retrying a locally unsaved snapshot.
          }
          this.writeCache(this.latestPlanJson);
          try {
            if (!this.isOffline() && this.needsServerSync && !this.serverSaveQueue && typeof navigator !== 'undefined' && navigator.sendBeacon) {
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
    this.notifyStatusListener(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: PlanSaveStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      this.notifyStatusListener(listener);
    }
  }

  private notifyStatusListener(listener: PlanSaveStatusListener): void {
    try {
      listener(this.status);
    } catch (err) {
      console.warn('[PlanPersistenceService] Save status subscriber failed:', err);
    }
  }

  private isOffline(): boolean {
    return isStandalonePlanSource();
  }

  private readEmbeddedPlan(): string | null {
    if (typeof window === 'undefined') return null;
    const candidates: string[] = [];
    try {
      const raw = (window as any).__PLAN_DATA__;
      if (raw) candidates.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
    } catch (err) {
      console.warn('[PlanPersistenceService] Could not serialize embedded plan:', err);
    }
    const script = typeof document !== 'undefined' ? document.getElementById('plan-data') : null;
    if (script?.textContent) candidates.push(script.textContent);
    for (const embedded of candidates) {
      try {
        validatePlanJson(embedded);
        return sanitizePlanJson(embedded);
      } catch (err) {
        console.warn('[PlanPersistenceService] Could not read embedded plan:', err);
      }
    }
    return null;
  }

  /** A newly loaded/imported plan supersedes previous queued snapshots. */
  setCurrentPlan(planJson: string): void {
    validatePlanJson(planJson);
    this.planEpoch++;
    this.saveGeneration++;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.latestPlanJson = sanitizePlanJson(planJson);
    this.needsServerSync = false;
    this.writeCache(this.latestPlanJson);
    this.setStatus('idle');
  }

  /** Stage every edit synchronously, before the server autosave debounce. */
  cachePlan(planJson: string): boolean {
    validatePlanJson(planJson);
    this.latestPlanJson = sanitizePlanJson(planJson);
    this.needsServerSync = true;
    this.saveGeneration++;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.setStatus('saving');
    return this.writeCache(this.latestPlanJson);
  }

  private writeCache(json: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(this.storageKey, json);
      this.cachedSnapshot = json;
    } catch (err) {
      console.warn('[PlanPersistenceService] Failed to cache plan:', err);
      return false;
    }
    try {
      localStorage.setItem(this.storageTimeKey, Date.now().toString());
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

  private async withServerLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.serverSaveQueue;
    let release!: () => void;
    const queued = new Promise<void>((resolve) => { release = resolve; });
    this.serverSaveQueue = queued;
    if (previous) await previous;
    try {
      return await operation();
    } finally {
      if (this.serverSaveQueue === queued) this.serverSaveQueue = null;
      release();
    }
  }

  private invalidateCache(): void {
    this.cachedSnapshot = null;
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.storageTimeKey);
    } catch {
      // Blocked storage is also handled by loadPlan's fallback path.
    }
  }

  async savePlan(planJson: string): Promise<boolean> {
    let cached: boolean;
    try {
      cached = this.cachePlan(planJson);
    } catch (err) {
      console.warn('[PlanPersistenceService] Invalid plan JSON:', err);
      this.saveGeneration++;
      this.setStatus('error');
      return false;
    }
    const cleanJson = this.latestPlanJson!;
    const generation = this.saveGeneration;
    const epoch = this.planEpoch;

    // Standalone HTML owns its embedded plan and browser working copy, not a
    // hosting site's /sample.plan. Do not report an unrelated host API as saved.
    if (this.isOffline()) {
      this.needsServerSync = false;
      this.finishSave(generation, cached);
      return cached;
    }

    const ok = await this.withServerLock(async () => {
      // New documents and newer edits supersede snapshots still waiting to write.
      if (epoch !== this.planEpoch || generation !== this.saveGeneration) return false;
      try {
        const result = await withPlanRequestTimeout(async (signal) => {
          const res = await fetch('/api/save-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: cleanJson,
            signal,
          });
          if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
          return res.json();
        });
        if (result?.success !== true) throw new Error('Server did not acknowledge saving the plan');
        if (generation === this.saveGeneration) this.needsServerSync = false;
        if (!cached && generation === this.saveGeneration) this.invalidateCache();
        return true;
      } catch (err) {
        console.warn('[PlanPersistenceService] Failed to save plan to server:', err);
        return false;
      }
    });
    this.finishSave(generation, ok);
    return ok;
  }

  async loadPlan(): Promise<string> {
    const generation = this.saveGeneration;
    // Browser edits are the working copy. Never replace them with a stale
    // server template when reconnecting after an offline save.
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(this.storageKey);
        if (cached && cached.trim().startsWith('{')) {
          validatePlanJson(cached);
          this.latestPlanJson = sanitizePlanJson(cached);
          this.cachedSnapshot = cached;
          return this.latestPlanJson;
        }
      } catch (err) {
        console.warn('[PlanPersistenceService] Could not read cached plan:', err);
      }

      // A downloaded editor can start from its embedded plan without network.
      const embedded = this.readEmbeddedPlan();
      if (embedded) {
        this.latestPlanJson = embedded;
        return embedded;
      }
    }

    if (this.isOffline()) throw new Error('Unable to load an offline plan from storage or embedded data.');
    try {
      const text = await withPlanRequestTimeout(async (signal) => {
        const res = await fetch(`/sample.plan?t=${Date.now()}`, {
          cache: 'no-cache',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
          signal,
        });
        if (!res.ok) throw new Error(`Failed to load plan: HTTP ${res.status}`);
        const text = await res.text();
        validatePlanJson(text);
        return text;
      });
      if (generation !== this.saveGeneration && this.latestPlanJson) return this.latestPlanJson;
      this.latestPlanJson = sanitizePlanJson(text);
      this.writeCache(this.latestPlanJson);
      return this.latestPlanJson;
    } catch (err) {
      console.warn('[PlanPersistenceService] Could not fetch /sample.plan:', err);
    }
    if (generation !== this.saveGeneration && this.latestPlanJson) return this.latestPlanJson;
    throw new Error('Unable to load plan from disk or storage.');
  }

  async resetToTemplate(): Promise<string> {
    const generation = ++this.saveGeneration;
    const epoch = this.planEpoch;
    if (this.saveTimeout !== null) clearTimeout(this.saveTimeout);
    this.setStatus('saving');
    try {
      if (this.isOffline()) {
        const embedded = this.readEmbeddedPlan();
        if (!embedded) throw new Error('No embedded plan available to reset');
        if (!this.writeCache(embedded)) throw new Error('Could not store the reset plan');
        this.latestPlanJson = embedded;
        this.needsServerSync = false;
        this.setStatus('idle');
        return embedded;
      }
      // Resets and saves share one queue in both directions.
      const planJson = await this.withServerLock(async () => {
        if (epoch !== this.planEpoch) throw new Error('Reset superseded by a newly loaded plan');
        const data = await withPlanRequestTimeout(async (signal) => {
          const res = await fetch('/api/reset-plan', { method: 'POST', signal });
          if (!res.ok) throw new Error(`Failed to reset plan: ${res.statusText}`);
          return res.json();
        });
        if (data?.success === false) throw new Error('Server rejected the reset');
        if (typeof data?.plan !== 'string') throw new Error('Reset response is missing its plan');
        validatePlanJson(data.plan);
        return sanitizePlanJson(data.plan);
      });
      if (generation === this.saveGeneration) {
        this.latestPlanJson = planJson;
        this.needsServerSync = false;
        if (!this.writeCache(planJson)) this.invalidateCache();
        this.setStatus('idle');
      }
      return planJson;
    } catch (err) {
      if (generation === this.saveGeneration) this.setStatus('error');
      throw err;
    }
  }
}
