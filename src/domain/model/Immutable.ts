const snapshots = new WeakSet<object>();

/** Own a detached, recursively frozen snapshot. Previously owned values are shared. */
export function immutable<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (snapshots.has(value)) return value;
  const result = Array.isArray(value)
    ? value.map(immutable)
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutable(entry)]));
  Object.freeze(result);
  snapshots.add(result);
  return result as T;
}

export function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

export function positive(value: number, label: string): number {
  if (finite(value, label) <= 0) throw new Error(`${label} must be positive`);
  return value;
}

export function identifier(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Element ID is required');
  return value;
}
