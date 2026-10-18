import type { CabinetLayout, CabinetInternalDrawer } from '../../domain/cabinet/CabinetLayout';
import { interior, removeCabinetPart } from '../../domain/cabinet/CabinetLayout';
import { cabinetInternalDrawer } from '../../domain/cabinet/CabinetFronts';
import type { Vector3D } from '../../domain/model/PlanData';
import { createElementId } from '../../platform/ElementId';

export function CabinetInternalDrawers({ layout, size, onChange, onPlace }: { layout: CabinetLayout; size: Vector3D; onChange: (layout: CabinetLayout) => void; onPlace: (support: string) => void }) {
  const update = (id: string, patch: Partial<CabinetInternalDrawer>) => onChange({ ...layout, internalDrawers: layout.internalDrawers!.map(d => d.id === id ? { ...d, ...patch } : d) });
  return <section aria-label="Internal drawers" className="space-y-2 border-t border-slate-700 pt-3">
    <strong>Internal pull-out drawers</strong>
    <button className="w-full rounded bg-sky-700 p-2 disabled:opacity-40" disabled={(layout.internalDrawers?.length ?? 0) >= 32} onClick={() => {
      const n = layout.internalDrawers?.length ?? 0, inner = interior(size, layout);
      onChange({ ...layout, internalDrawers: [...(layout.internalDrawers ?? []), { id: createElementId(), name: `Internal drawer ${n + 1}`, bottom: .025 + n * .22, height: .16, depth: Math.max(.03, inner.z - .04), setback: .02, extension: .75 }] });
    }}>Add internal drawer</button>
    {(layout.internalDrawers ?? []).map((drawer, index) => {
      const tray = cabinetInternalDrawer(layout, size, drawer), number = index + 1;
      return <div key={drawer.id} className="space-y-2 rounded border border-slate-700 p-2">
        <strong>{drawer.name}</strong>
        {(['bottom', 'height', 'depth', 'setback'] as const).map(field => <label className="block" key={field}>{field === 'bottom' ? 'Bottom from cabinet base' : field === 'setback' ? 'Front setback' : `Box ${field}`} (cm)
          <input type="number" step=".1" min={field === 'height' || field === 'depth' ? 2 : 0} aria-label={`Internal drawer ${number} ${field} (cm)`} className="w-full bg-slate-800 p-1" value={+(drawer[field] * 100).toFixed(1)} onChange={e => { if (e.target.value === '') return; const value = Number(e.target.value) / 100; if (Number.isFinite(value) && value >= (field === 'height' || field === 'depth' ? .02 : 0)) update(drawer.id, { [field]: value }); }} />
        </label>)}
        <label className="block">Extension: {Math.round(drawer.extension * 100)}%<input type="range" aria-label={`Internal drawer ${number} extension`} min="0" max="100" value={Math.round(drawer.extension * 100)} className="w-full accent-sky-400" onChange={e => update(drawer.id, { extension: +e.target.value / 100 })} /></label>
        <p className="text-slate-400">Clear volume: {[tray.usable.x, tray.usable.y, tray.usable.z].map(v => (v * 100).toFixed(1)).join(' × ')} cm (W × H × D)</p>
        <button className="w-full rounded bg-emerald-700 p-2" onClick={() => onPlace(tray.floor.id)}>Place object in {drawer.name}</button>
        <button className="text-red-300" onClick={() => onChange(removeCabinetPart(layout, size, tray.floor.id))}>Remove {drawer.name}</button>
      </div>;
    })}
    <p className="text-slate-400">Internal drawers sit behind the outer doors. Close them before checking door clearance.</p>
  </section>;
}
