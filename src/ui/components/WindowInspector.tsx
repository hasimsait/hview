import { Focus,X } from 'lucide-react';
import { FinishOpening } from '../../application/commands/StructuralCommands';
import type { WindowOpening } from '../../domain/elements/Opening';
import { useRuntime } from '../context/RuntimeContext';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';

export function WindowInspector({ window, onClose }: { window: WindowOpening; onClose: () => void }) {
  const { editor, scene } = useRuntime();
  return <aside className="absolute right-4 top-4 bottom-4 w-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-4 z-20">
    <div className="flex items-center justify-between"><h2>{window.isFrenchWindow ? 'French window' : 'Window'}</h2><button onClick={onClose} aria-label="Close window inspector"><X size={18} /></button></div>
    <p className="text-sm text-slate-400">{window.width.toFixed(2)} × {window.height.toFixed(2)} m</p>
    <p className="text-xs text-slate-400">Sill: {window.floorHeight.toFixed(2)} m · Top: {window.topElevation.toFixed(2)} m</p>
    <SurfaceFinishPicker currentFinish={window.finish} onSelectFinish={finish => editor.execute(new FinishOpening(window.id, finish))} onClearFinish={() => editor.execute(new FinishOpening(window.id))} defaultTab="glass" />
    <button onClick={() => scene.focusOnOpening(window, editor.getDocument().requireWall(window.wallId))} aria-label="Focus window"><Focus size={18} /></button>
  </aside>;
}
