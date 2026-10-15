const STORAGE_KEY = 'hview_current_plan';
const STORAGE_TIME_KEY = 'hview_current_plan_timestamp';
export class BrowserSnapshotStore {
  private readonly key: string;
  private readonly timeKey: string;
  constructor() {
    const offline = typeof window !== 'undefined' &&
      (Boolean(window.__STANDALONE_MODE__) || window.location.protocol === 'file:');
    const path = typeof window !== 'undefined' ? window.location.pathname : undefined;
    // Downloaded/hosted standalone documents on the same origin need separate working copies.
    const suffix = offline && path && path !== '/' ? `:${encodeURIComponent(path)}` : '';
    this.key = STORAGE_KEY + suffix;
    this.timeKey = STORAGE_TIME_KEY + suffix;
  }
  read(): string | null { return typeof window === 'undefined' ? null : localStorage.getItem(this.key); }
  write(json: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      localStorage.setItem(this.key, json);
    } catch (err) {
      console.warn('[DocumentStorage] Failed to cache plan:', err);
      return false;
    }
    try {
      localStorage.setItem(this.timeKey, Date.now().toString());
    } catch {
      // The plan itself was saved; timestamp metadata is optional.
    }
    return true;
  }
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(this.key);
      localStorage.removeItem(this.timeKey);
    } catch {
      // Blocked storage is also handled by loadPlan's fallback path.
    }
  }
}
