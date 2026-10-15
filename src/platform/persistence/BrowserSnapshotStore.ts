import { isOpaquePlanSource } from '../../services/plan/PlanRequest';

const STORAGE_KEY = 'hview_current_plan';
const STORAGE_TIME_KEY = 'hview_current_plan_timestamp';
export class BrowserSnapshotStore {
  private readonly key: string;
  private readonly timeKey: string;
  private readonly opaque = isOpaquePlanSource();
  constructor() {
    const offline = typeof window !== 'undefined' &&
      (Boolean(window.__STANDALONE_MODE__) || window.location.protocol === 'file:');
    // In WebKit a data URL's pathname contains the complete base64 HTML. Do
    // not even read it: these documents cannot use localStorage in any case.
    const scopedProtocol = typeof window !== 'undefined' && ['http:', 'https:', 'file:'].includes(window.location.protocol);
    const path = !this.opaque && offline && scopedProtocol ? window.location.pathname : undefined;
    // Downloaded/hosted standalone documents on the same origin need separate working copies.
    const suffix = path && path !== '/' ? `:${this.pathKey(path)}` : '';
    this.key = STORAGE_KEY + suffix;
    this.timeKey = STORAGE_TIME_KEY + suffix;
  }
  private pathKey(path: string): string {
    if (path.length <= 1024) return encodeURIComponent(path);
    // Bound keys for unusual hosted/file paths too, without allocating another
    // URL-sized string. Ordinary paths retain their existing saved-copy keys.
    let first = 0x811c9dc5, second = 0x9e3779b9;
    for (let index = 0; index < path.length; index++) {
      first = Math.imul(first ^ path.charCodeAt(index), 0x01000193);
      second = Math.imul(second ^ path.charCodeAt(index), 0x85ebca6b);
    }
    return `path-${path.length}-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
  }
  read(): string | null { return typeof window === 'undefined' || this.opaque ? null : localStorage.getItem(this.key); }
  write(json: string): boolean {
    if (typeof window === 'undefined' || this.opaque) return false;
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
    if (typeof window === 'undefined' || this.opaque) return;
    try {
      localStorage.removeItem(this.key);
      localStorage.removeItem(this.timeKey);
    } catch {
      // Blocked storage is also handled by loadPlan's fallback path.
    }
  }
}
