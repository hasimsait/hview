import type { CabinetLayout } from './CabinetLayout';

export interface CabinetPlinth {
  height: number;
  setback: number;
}
export const DEFAULT_CABINET_PLINTH: Readonly<CabinetPlinth> = { height: .10, setback: .05 };
export function cabinetBaseHeight(layout: Pick<CabinetLayout, 'plinth'>): number { return layout.plinth?.height ?? 0; }
export function supportsCabinetPlinth(assetKey: string): boolean {
  return ['kitchen_box_door_double', 'cabinet_base_single', 'cabinet_base_double', 'cabinet_drawers_three', 'cabinet_drawers_deep'].includes(assetKey);
}

/** Keep stacked front proportions when the plinth changes the available body height. */
export function configureCabinetPlinth(layout: CabinetLayout, overallHeight: number, plinth?: CabinetPlinth): CabinetLayout {
  const previous = cabinetBaseHeight(layout), next = plinth?.height ?? 0;
  const scale = overallHeight > previous + .001 ? (overallHeight - next) / (overallHeight - previous) : 1;
  return { ...layout, plinth, frontSections: layout.frontSections?.map(section => ({ ...section,
    bottom: next + (section.bottom - previous) * scale,
    top: section.top === 'top' ? 'top' : next + (section.top - previous) * scale,
  })) };
}
