import { Focus,Trash2,X } from 'lucide-react';
import { useState } from 'react';
import { FinishFurniture,RemoveElement } from '../../application/commands/FurnitureCommands';
import { FinishColumn,SplitColumn } from '../../application/commands/StructuralCommands';
import { Column } from '../../domain/elements/Column';
import type { ColumnSide,SurfaceFinishConfig } from '../../domain/model/PlanData';
import { useRuntime,useSelection } from '../context/RuntimeContext';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { SurfaceTargetSelector } from './SurfaceTargetSelector';
import { WallRecessSection } from './wall/WallRecessSection';

const COLUMN_SIDES: readonly ColumnSide[] = ['all', 'front', 'back', 'left', 'right'];

export function ColumnInspector({ column, onClose }: { column: Column; onClose: () => void }) {
  const runtime = useRuntime();
  const selection = useSelection();
  const [error, setError] = useState('');
  const [selectedRecessId, setSelectedRecessId] = useState<string | undefined>(undefined);

  const doc = runtime.editor.getDocument();
  const shape = column.wallShape(doc.totalHeight);
  const recesses = doc.recessesFor(column.id);
  const activeRecess =
    (selectedRecessId ? recesses.find((r) => r.id === selectedRecessId) : undefined) ??
    recesses[0] ??
    null;

  const subtarget = selection?.kind === 'column' && selection.id === column.id ? selection.subtarget : undefined;
  const isRecessTarget = subtarget === 'recess_wall' || subtarget === 'corners' || subtarget === 'sides';
  const side: ColumnSide = COLUMN_SIDES.find((candidate) => candidate === subtarget) ?? 'all';

  const finishes: Record<ColumnSide, SurfaceFinishConfig | undefined> = {
    all: column.finish,
    front: column.finishFront,
    back: column.finishBack,
    left: column.finishLeft,
    right: column.finishRight,
  };

  const recessSectionKey = subtarget === 'corners' || subtarget === 'sides' ? 'sides' : 'recess_wall';
  const currentFinish =
    isRecessTarget && activeRecess
      ? activeRecess.sectionFinishes?.[recessSectionKey]
      : finishes[side] ?? column.finish;

  const handleSelectFinish = (finish: SurfaceFinishConfig) => {
    if (isRecessTarget && activeRecess) {
      runtime.editor.execute(new FinishFurniture(activeRecess.id, finish, recessSectionKey));
    } else {
      runtime.editor.execute(new FinishColumn(column.id, finish, side));
    }
  };

  const handleClearFinish = () => {
    if (isRecessTarget && activeRecess) {
      runtime.editor.execute(new FinishFurniture(activeRecess.id, undefined, recessSectionKey));
    } else {
      runtime.editor.execute(new FinishColumn(column.id, { type: 'plaster', color: '#efede8' }, side));
    }
  };

  return (
    <aside className="absolute right-4 top-4 bottom-4 w-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-4 z-20">
      <div className="flex items-center justify-between">
        <h2>{column.displayName}</h2>
        <button onClick={onClose} aria-label="Close column inspector">
          <X size={18} />
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {column.width.toFixed(2)} × {column.depth.toFixed(2)} m
      </p>
      <SurfaceTargetSelector
        kind="column"
        activeTarget={isRecessTarget && subtarget ? subtarget : side}
        hasRecesses={recesses.length > 0}
        onSelectTarget={(target) => runtime.editor.selection.select('column', column, target)}
      />
      <p className="text-xs text-slate-500">ID: {column.id}</p>
      <WallRecessSection
        wall={shape}
        wallLength={column.width}
        wallRecesses={recesses}
        selectedRecessId={activeRecess?.id}
        activeTarget={subtarget ?? 'recess_wall'}
        editor={runtime.editor}
        sceneService={runtime.scene}
        onSelectTarget={(target, recessId) => {
          if (recessId) setSelectedRecessId(recessId);
          runtime.editor.selection.select('column', column, target);
        }}
      />
      <button
        onClick={() => {
          try {
            runtime.editor.execute(new SplitColumn(column.id, column.width / 2));
            setError('');
          } catch (err) {
            setError(String(err));
          }
        }}
        className="text-xs text-slate-300"
      >
        Split column at midpoint
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      <SurfaceFinishPicker
        currentFinish={currentFinish}
        onSelectFinish={handleSelectFinish}
        onClearFinish={handleClearFinish}
      />
      <div className="flex gap-4">
        <button
          onClick={() => runtime.scene.focusOnWall(column.wallShape(runtime.editor.getDocument().totalHeight))}
          aria-label="Focus column"
        >
          <Focus size={18} />
        </button>
        <button
          onClick={() => runtime.editor.execute(new RemoveElement(column.id))}
          aria-label="Delete column"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </aside>
  );
}
