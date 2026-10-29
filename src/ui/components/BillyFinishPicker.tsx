import { BILLY_FINISHES } from '../../domain/catalog/BillyFinishes';
import type { SurfaceFinishConfig } from '../../domain/model/PlanData';

export function BillyFinishPicker({ current, onSelect }: { current?: SurfaceFinishConfig; onSelect: (finish: SurfaceFinishConfig) => void }) {
  return <section className="space-y-2 rounded-lg border border-slate-700 p-2" aria-label="BILLY finishes">
    <div className="text-xs font-semibold text-slate-200">IKEA BILLY finishes</div>
    <div className="grid grid-cols-3 gap-1">{BILLY_FINISHES.map(option => <button type="button" key={option.id} aria-pressed={current?.variant === option.id && current.color?.toLowerCase() === option.color} onClick={() => onSelect({ ...option.finish, rotation: current?.rotation ?? 0 })} className="rounded border border-slate-700 p-2 text-[10px] text-slate-200 aria-pressed:border-sky-400 aria-pressed:bg-sky-900/30">
      <span className="mb-1 block h-7 rounded" style={{ backgroundColor: option.color }} />{option.name}
    </button>)}</div>
    <p className="text-[10px] text-slate-400">BILLY-specific white and wood-effect tones with photographic grain, separate from generic hardwoods.</p>
  </section>;
}
