import type { RoomEntity } from '../../core/types/plan';
import { ConfigureBalconyRailing } from '../../application/commands/StructuralCommands';
import { DEFAULT_BALCONY_RAILING, openRailingRuns, type BalconyRailingConfig } from '../../domain/model/BalconyRailing';
import { useDocument, useRuntime } from '../context/RuntimeContext';

export function BalconyRailingControls({ room }: { room: RoomEntity }) {
  const { editor } = useRuntime(), document = useDocument();
  const walls = [...(document?.walls ?? []), ...(document?.columns.map(column => column.wallShape(document.totalHeight)) ?? [])];
  const runs = openRailingRuns(room.polygon, walls), config = room.railing;
  const available = [...new Set(runs.map(run => run.edge))], selected = config?.edges ?? available;
  const update = (patch: Partial<BalconyRailingConfig>) => editor.execute(new ConfigureBalconyRailing(room.id, { ...(config ?? DEFAULT_BALCONY_RAILING), ...patch }));
  const toggle = (edge: number) => update({ edges: selected.includes(edge) ? selected.filter(value => value !== edge) : [...selected, edge] });
  const minX = Math.min(...room.polygon.map(p => p.x)), minY = Math.min(...room.polygon.map(p => p.y));
  const width = Math.max(...room.polygon.map(p => p.x)) - minX, depth = Math.max(...room.polygon.map(p => p.y)) - minY;
  const margin = Math.max(width, depth, .1) * .12, stroke = Math.max(width, depth, .1) * .014;
  return <section aria-label="Balcony railing" className="space-y-3 rounded-lg border border-slate-700 p-3">
    <h3 className="font-semibold text-slate-200">Balcony railing</h3>
    <p className="text-slate-400">Follows the floor's open edges and meets the walls. Simple metal posts, vertical bars and a handrail.</p>
    {!config ? <button type="button" disabled={!runs.length} className="rounded bg-sky-600 px-3 py-2 text-white disabled:opacity-40" onClick={() => update({})}>Add railing to open edges</button> : <>
      <svg aria-label="Balcony railing edge map" role="img" viewBox={`${minX - margin} ${minY - margin} ${width + 2 * margin} ${depth + 2 * margin}`} className="h-36 w-full rounded bg-slate-950">
        <polygon points={room.polygon.map(p => `${p.x},${p.y}`).join(' ')} fill="#1e293b" />
        {room.polygon.map((start, edge) => {
          const end = room.polygon[(edge + 1) % room.polygon.length], open = available.includes(edge), active = selected.includes(edge);
          return <g key={edge}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={open && active ? '#38bdf8' : '#64748b'} strokeWidth={stroke * (open ? 2 : 4)} />
            {open && <>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={stroke * 10} onClick={() => toggle(edge)} className="cursor-pointer" aria-hidden="true" />
              <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - stroke * 3} textAnchor="middle" fontSize={stroke * 6} fill="#e2e8f0" pointerEvents="none">{edge + 1}</text>
            </>}
          </g>;
        })}
      </svg>
      {available.map(edge => <label key={edge} className="flex items-center gap-2 text-slate-300">
        <input type="checkbox" aria-label={`Railing edge ${edge + 1}`} checked={selected.includes(edge)} onChange={() => toggle(edge)} />Edge {edge + 1} · {runs.filter(run => run.edge === edge).reduce((sum, run) => sum + Math.hypot(run.end.x - run.start.x, run.end.y - run.start.y), 0).toFixed(2)} m
      </label>)}
      <label className="block text-slate-300">Railing height (cm)<input aria-label="Railing height (cm)" type="number" min="30" max="300" step="1" value={+(config.height * 100).toFixed(1)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5" onChange={event => {
        if (event.target.value === '') return;
        const height = +event.target.value / 100; if (Number.isFinite(height) && height >= .3 && height <= 3) update({ height });
      }} /></label>
      <label className="flex items-center justify-between text-slate-300">Railing colour<input aria-label="Railing colour" type="color" value={config.color} onChange={event => update({ color: event.target.value })} /></label>
      <button type="button" className="text-red-300" onClick={() => editor.execute(new ConfigureBalconyRailing(room.id))}>Remove railing</button>
    </>}
    {!runs.length && <p className="text-slate-400">No open edges on this floor.</p>}
  </section>;
}
