import { Focus,Trash2,X } from 'lucide-react';
import { useState } from 'react';
import { RemoveElement } from '../../application/commands/FurnitureCommands';
import { FinishColumn,SplitColumn } from '../../application/commands/StructuralCommands';
import { Column } from '../../domain/elements/Column';
import type { ColumnSide } from '../../domain/model/PlanData';
import { useRuntime,useSelection } from '../context/RuntimeContext';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { WallRecessSection } from './wall/WallRecessSection';

export function ColumnInspector({ column, onClose }: { column: Column; onClose: () => void }) {
  const runtime = useRuntime();
  const selection = useSelection();
  const [error, setError] = useState('');
  const shape = column.wallShape(runtime.editor.getDocument().totalHeight);
  const recesses = runtime.editor.getDocument().recessesFor(column.id);
  const sides: readonly ColumnSide[] = ['all', 'front', 'back', 'left', 'right'];
  const side = sides.find(side => side === selection?.subtarget) ?? 'all';
  const finishes = { all: column.finish, front: column.finishFront, back: column.finishBack, left: column.finishLeft, right: column.finishRight };
  return <aside className="absolute right-4 top-4 bottom-4 w-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-4 z-20">
    <div className="flex items-center justify-between"><h2>{column.displayName}</h2><button onClick={onClose} aria-label="Close column inspector"><X size={18} /></button></div>
    <p className="text-xs text-slate-400">{column.width.toFixed(2)} × {column.depth.toFixed(2)} m</p>
    <div className="flex gap-2">{sides.map(value => <button key={value} className={value === side ? 'text-sky-400' : 'text-slate-400'} onClick={() => runtime.editor.selection.select('column', column, value)}>{value}</button>)}</div>
    <p className="text-xs text-slate-500">ID: {column.id}</p>
    <WallRecessSection wall={shape} wallLength={column.width} wallRecesses={recesses} activeTarget="recess_wall" editor={runtime.editor} sceneService={runtime.scene} onSelectTarget={() => { }} />
    <button onClick={() => { try { runtime.editor.execute(new SplitColumn(column.id, column.width / 2)); setError(''); } catch (error) { setError(String(error)); } }} className="text-xs text-slate-300">Split column at midpoint</button>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <SurfaceFinishPicker currentFinish={finishes[side] ?? column.finish} onSelectFinish={finish => runtime.editor.execute(new FinishColumn(column.id, finish, side))} onClearFinish={() => runtime.editor.execute(new FinishColumn(column.id, { type: 'plaster', color: '#efede8' }, side))} />
    <div className="flex gap-4"><button onClick={() => runtime.scene.focusOnWall(column.wallShape(runtime.editor.getDocument().totalHeight))} aria-label="Focus column"><Focus size={18} /></button><button onClick={() => runtime.editor.execute(new RemoveElement(column.id))} aria-label="Delete column"><Trash2 size={18} /></button></div>
  </aside>;
}
