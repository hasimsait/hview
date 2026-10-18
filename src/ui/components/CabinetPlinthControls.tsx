import type { CabinetLayout } from '../../domain/cabinet/CabinetLayout';
import { configureCabinetPlinth, DEFAULT_CABINET_PLINTH } from '../../domain/cabinet/CabinetPlinth';
import type { Vector3D } from '../../domain/model/PlanData';

export function CabinetPlinthControls({ layout, size, onChange }: { layout: CabinetLayout; size: Vector3D; onChange: (layout: CabinetLayout) => void }) {
  const maxHeight = Math.min(.5, size.y - layout.panelThickness * 2 - .04);
  const maxSetback = Math.max(0, size.z - layout.panelThickness * 2);
  const update = (key: 'height' | 'setback', text: string) => {
    if (text === '' || !layout.plinth) return;
    const value = +text / 100, max = key === 'height' ? maxHeight : maxSetback;
    if (Number.isFinite(value) && value >= (key === 'height' ? .01 : 0) && value <= max) onChange(configureCabinetPlinth(layout, size.y, { ...layout.plinth, [key]: value }));
  };
  return <div className="space-y-2 text-xs text-slate-300">
    <label className="flex items-center gap-2"><input aria-label="Cabinet plinth" type="checkbox" checked={!!layout.plinth} disabled={!layout.plinth && maxHeight < .01} onChange={event => onChange(configureCabinetPlinth(layout, size.y, event.target.checked ? { height: Math.min(DEFAULT_CABINET_PLINTH.height, maxHeight), setback: Math.min(DEFAULT_CABINET_PLINTH.setback, maxSetback) } : undefined))} />Plinth / toe kick</label>
    {layout.plinth && <>
      <label className="block">Plinth height (cm)<input aria-label="Plinth height (cm)" type="number" min="1" max={+(maxHeight * 100).toFixed(2)} step="0.5" className="w-full rounded bg-slate-800 p-1" value={+(layout.plinth.height * 100).toFixed(2)} onChange={event => update('height', event.target.value)} /></label>
      <label className="block">Plinth setback (cm)<input aria-label="Plinth setback (cm)" type="number" min="0" max={+(maxSetback * 100).toFixed(2)} step="0.5" className="w-full rounded bg-slate-800 p-1" value={+(layout.plinth.setback * 100).toFixed(2)} onChange={event => update('setback', event.target.value)} /></label>
      <p className="text-[10px] text-slate-400">Included in overall cabinet height. The countertop stays at the same elevation; usable interior height is reduced.</p>
    </>}
  </div>;
}
