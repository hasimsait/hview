/** Retain vendor extensions, while recognized collections are encoded from elements. */
export function legacyMetadata(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const root = { ...input } as Record<string, unknown>;
  const nested = !!root.plan && typeof root.plan === 'object' && !Array.isArray(root.plan);
  const body = { ...(nested ? root.plan as Record<string, unknown> : root) };
  for (const key of ['walls', 'items', 'rooms1', 'rooms2', 'columns', 'v', 'total_height']) delete body[key];
  if (!nested) return body;
  delete root.columns;
  return { ...root, plan: body };
}
