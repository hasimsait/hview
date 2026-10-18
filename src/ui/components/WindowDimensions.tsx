import { useEffect, useState } from 'react';
import type { WindowOpening } from '../../domain/elements/Opening';
import { ConfigureWindowGeometry } from '../../application/commands/WindowCommands';
import { useRuntime } from '../context/RuntimeContext';

const fields = [['width', 'Width', 'Window width (cm)'], ['height', 'Height', 'Window height (cm)'], ['sill', 'Sill height', 'Window sill height (cm)'], ['left', 'Left edge from wall start', 'Window left edge from wall start (cm)']] as const;
const cm = (value: number) => String(+(value * 100).toFixed(3));
const values = (window: WindowOpening) => ({ width: cm(window.width), height: cm(window.height), sill: cm(window.floorHeight), left: cm(window.distanceAlongWall - window.width / 2) });
export function WindowDimensions({ window }: { window: WindowOpening }) {
  const { editor } = useRuntime(), [draft, setDraft] = useState(() => values(window)), [error, setError] = useState('');
  useEffect(() => { setDraft(values(window)); setError(''); }, [window.id, window.width, window.height, window.floorHeight, window.distanceAlongWall]);
  const wall = editor.getDocument().requireWall(window.wallId);
  return <form aria-label="Window dimensions" className="space-y-3 rounded-lg border border-slate-700 p-3" onSubmit={event => {
    event.preventDefault();
    try {
      if (Object.values(draft).some(value => !value.trim() || !Number.isFinite(+value))) throw new Error('Enter a number in every dimension field.');
      const width = +draft.width / 100;
      editor.execute(new ConfigureWindowGeometry(window.id, { width, height: +draft.height / 100, floorHeight: +draft.sill / 100, distanceAlongWall: +draft.left / 100 + width / 2 })); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }}>
    <h3 className="text-sm font-semibold">Dimensions &amp; position</h3>
    <div className="grid grid-cols-2 gap-2">{fields.map(([key, label, aria]) => <label key={key} className="block text-xs text-slate-300">{label} (cm)
      <input aria-label={aria} type="number" step="any" value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2" />
    </label>)}</div>
    <p className="text-[10px] text-slate-400">Measured from wall start (p1). Wall: {cm(wall.length)} cm long × {cm(wall.height)} cm high. Left edge and sill stay fixed when you change width and height.</p>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <button type="submit" className="rounded bg-sky-600 px-3 py-2 text-xs text-white hover:bg-sky-500">Apply window dimensions</button>
  </form>;
}
