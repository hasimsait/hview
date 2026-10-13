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
  private lastSavedJson: string | null = null;

  constructor() {
    // Synchronous emergency persistence on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.lastSavedJson) {
          try {
            localStorage.setItem(STORAGE_KEY, this.lastSavedJson);
            localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
            // Attempt sendBeacon to Vite dev server
            if (navigator.sendBeacon) {
              const blob = new Blob([this.lastSavedJson], { type: 'application/json' });
              navigator.sendBeacon('/api/save-plan', blob);
            }
          } catch (e) {
            // Ignore unload errors
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

  async savePlan(planJson: string): Promise<boolean> {
    const cleanJson = sanitizePlanJson(planJson);
    this.lastSavedJson = cleanJson;
    this.setStatus('saving');

    // 1. Instant client-side backup in localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, cleanJson);
        localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
      }
    } catch (err) {
      console.warn('[PlanPersistenceService] Failed to cache plan in localStorage:', err);
    }

    // 2. Persist to disk via Vite dev server endpoint
    try {
      const res = await fetch('/api/save-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cleanJson,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      this.setStatus('saved');

      // Revert status to idle after 3 seconds
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = window.setTimeout(() => {
        if (this.status === 'saved') {
          this.setStatus('idle');
        }
      }, 3000);

      return true;
    } catch (err) {
      // In standalone offline mode or file:/// protocol, localStorage is primary storage
      if (typeof window !== 'undefined' && ((window as any).__STANDALONE_MODE__ || window.location.protocol === 'file:')) {
        this.setStatus('saved');
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = window.setTimeout(() => {
          if (this.status === 'saved') this.setStatus('idle');
        }, 2000);
        return true;
      }
      console.warn('[PlanPersistenceService] Failed to save plan to server disk:', err);
      // Even if server failed, localStorage succeeded
      this.setStatus('error');
      return false;
    }
  }

  async loadPlan(): Promise<string> {
    try {
      // 1. Fetch public/sample.plan with cache-busting to bypass browser HTTP cache
      const res = await fetch(`/sample.plan?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
        },
      });

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const cleanText = sanitizePlanJson(text);
          this.lastSavedJson = cleanText;
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, cleanText);
              localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
            } catch {}
          }
          return cleanText;
        }
      }
    } catch (err) {
      console.warn('[PlanPersistenceService] Could not fetch /sample.plan from server:', err);
    }

    // 2. Fallback to localStorage if server fetch failed
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached && cached.trim().startsWith('{')) {
        const cleanCached = sanitizePlanJson(cached);
        this.lastSavedJson = cleanCached;
        return cleanCached;
      }

      // 3. Fallback to inlined plan in document if available (standalone offline HTML mode)
      if ((window as any).__PLAN_DATA__) {
        const raw = (window as any).__PLAN_DATA__;
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const cleanText = sanitizePlanJson(text);
        this.lastSavedJson = cleanText;
        return cleanText;
      }
      const embeddedScript = document.getElementById('plan-data');
      if (embeddedScript && embeddedScript.textContent && embeddedScript.textContent.trim().startsWith('{')) {
        const cleanText = sanitizePlanJson(embeddedScript.textContent.trim());
        this.lastSavedJson = cleanText;
        return cleanText;
      }
    }

    throw new Error('Unable to load plan from disk or storage.');
  }

  async resetToTemplate(): Promise<string> {
    this.setStatus('saving');
    try {
      const res = await fetch('/api/reset-plan', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Failed to reset plan: ${res.statusText}`);
      }
      const data = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TIME_KEY);
      }
      this.setStatus('idle');
      return data.plan;
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }
}
