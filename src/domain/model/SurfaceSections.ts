import type { SurfaceFinishConfig } from './PlanData';

/** Stable surface identity; display capitalization never creates another finish. */
export function surfaceSection(label: string, assetKey?: string): string {
  const key = label.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (assetKey === 'wall_recess') {
    if (key === 'girinti_wall') return 'recess_wall';
    if (key === 'corners' || key === 'recess_sides') return 'sides';
  }
  return key;
}

/** A layout adds individually paintable boards and doors; older whole-cabinet finishes remain their fallback. */
export function cabinetSurfaceFinish(section: string, sections?: Readonly<Record<string, SurfaceFinishConfig>>): SurfaceFinishConfig | undefined {
  const key = surfaceSection(section);
  if (sections?.[key]) return sections[key];
  if (/^door_\d+$/.test(key)) return sections?.doors ?? sections?.lids ?? sections?.cabinet ?? sections?.body ?? sections?.frame;
  if (['frame', 'back_panel', 'shelves', 'dividers', 'laundry_basket', 'plinth'].includes(key)) return sections?.cabinet ?? sections?.body ?? sections?.frame;
  return undefined; // Worktops, handles and stored objects keep their own finishes.
}

export function normalizeSectionFinishes(sections: Record<string, SurfaceFinishConfig> | undefined, assetKey: string): Record<string, SurfaceFinishConfig> | undefined {
  if (!sections || Object.keys(sections).every(key => key === surfaceSection(key, assetKey))) return sections;
  const result: Record<string, SurfaceFinishConfig> = {};
  // Explicit canonical values take precedence when an old file contains aliases too.
  for (const [key, finish] of Object.entries(sections)) if (key === surfaceSection(key, assetKey)) result[key] = finish;
  for (const [key, finish] of Object.entries(sections)) result[surfaceSection(key, assetKey)] ??= finish;
  return result;
}
