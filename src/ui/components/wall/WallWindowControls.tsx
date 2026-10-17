import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { WallEntity } from '../../../core/types/plan';
import { AddWindow } from '../../../application/commands/WindowCommands';
import { createElementId } from '../../../platform/ElementId';
import { useRuntime } from '../../context/RuntimeContext';
import { WindowOpening } from '../../../domain/elements/Opening';

export function WallWindowControls({ wall }: { wall: WallEntity }) {
  const { editor, scene } = useRuntime(), [error, setError] = useState('');
  const windows = wall.openings.filter(o => o.type === 'window' || o.type === 'french_window');
  const select = (id: string) => {
    editor.selection.set({ kind: 'opening', id });
    const window = editor.getDocument().get(id);
    if (window instanceof WindowOpening) scene.focusOnOpening(window, editor.getDocument().requireWall(wall.id));
  };
  return <section aria-label="Wall windows" className="py-3 border-b border-slate-800 space-y-2">
    <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-300">Windows</h3>
      <button type="button" className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-white" onClick={() => {
        try { const id = createElementId(); editor.execute(new AddWindow(id, wall.id)); select(id); setError(''); }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      }}><Plus size={12} />Add window</button>
    </div>
    <p className="text-[10px] text-slate-400">Add a window in a free span, then set its exact dimensions and position. Select an existing window below to correct it.</p>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    {windows.map((window, i) => <button key={window.id} type="button" className="block w-full rounded border border-slate-700 p-2 text-left hover:border-sky-500" onClick={() => select(window.id)}>
      <span className="block text-sky-300">{window.type === 'french_window' ? 'French window' : 'Window'} {i + 1}</span>
      <span className="text-[10px] text-slate-400">{+(window.width * 100).toFixed(1)} × {+(window.height * 100).toFixed(1)} cm · sill {+(window.floorHeight * 100).toFixed(1)} cm</span>
    </button>)}
  </section>;
}
