import { Focus,X } from 'lucide-react';
import { FinishOpening,SetWindowCurtains,SetWindowPelmet } from '../../application/commands/StructuralCommands';
import type { WindowOpening } from '../../domain/elements/Opening';
import { useRuntime } from '../context/RuntimeContext';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';

export function WindowInspector({
  window,
  onClose,
}: {
  window: WindowOpening;
  onClose: () => void;
}) {
  const { editor, scene } = useRuntime();
  return (
    <aside className="absolute right-4 top-4 bottom-4 w-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-4 z-20">
      <div className="flex items-center justify-between">
        <h2>{window.isFrenchWindow ? 'French window' : 'Window'}</h2>
        <button onClick={onClose} aria-label="Close window inspector">
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-slate-400">
        {window.width.toFixed(2)} × {window.height.toFixed(2)} m
      </p>
      <p className="text-xs text-slate-400">
        Sill: {window.floorHeight.toFixed(2)} m · Top: {window.topElevation.toFixed(2)} m
      </p>
      <section aria-label="Window curtains" className="rounded-lg border border-slate-700 p-3 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Ceiling-mounted curtains</h3>
        <p className="text-xs text-slate-400">Floor-length pleated panels on a ceiling track.</p>
        <div className="flex flex-wrap gap-2">
          {window.curtainState === 'removed' ? (
            <button
              type="button"
              onClick={() => editor.execute(new SetWindowCurtains(window.id, 'visible'))}
              className="rounded bg-sky-600 px-3 py-2 text-xs text-white hover:bg-sky-500"
            >Add curtains</button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => editor.execute(new SetWindowCurtains(window.id, window.curtainState === 'hidden' ? 'visible' : 'hidden'))}
                className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
              >{window.curtainState === 'hidden' ? 'Show curtains' : 'Hide curtains'}</button>
              <button
                type="button"
                onClick={() => editor.execute(new SetWindowCurtains(window.id, 'removed'))}
                className="rounded border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950"
              >Delete curtains</button>
            </>
          )}
        </div>
      </section>
      <section aria-label="Window ceiling cornice" className="rounded-lg border border-slate-700 p-3 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Ceiling cornice / curtain pelmet</h3>
        <p className="text-xs text-slate-400">12 × 12 cm decorative framing in front of the curtain rail.</p>
        <div className="flex flex-wrap gap-2">
          {window.pelmetState === 'removed' ? (
            <button className="rounded bg-sky-600 px-3 py-2 text-xs" onClick={() => editor.execute(new SetWindowPelmet(window.id, 'visible'))}>Add cornice</button>
          ) : <>
            <button className="rounded bg-slate-800 px-3 py-2 text-xs" onClick={() => editor.execute(new SetWindowPelmet(window.id, window.pelmetState === 'hidden' ? 'visible' : 'hidden'))}>{window.pelmetState === 'hidden' ? 'Show cornice' : 'Hide cornice'}</button>
            <button className="rounded border border-red-900 px-3 py-2 text-xs text-red-300" onClick={() => editor.execute(new SetWindowPelmet(window.id, 'removed'))}>Remove cornice</button>
          </>}
        </div>
      </section>
      <SurfaceFinishPicker
        currentFinish={window.finish}
        onSelectFinish={(finish) => editor.execute(new FinishOpening(window.id, finish))}
        onClearFinish={() => editor.execute(new FinishOpening(window.id))}
        defaultTab="glass"
      />
      <button
        onClick={() =>
          scene.focusOnOpening(window, editor.getDocument().requireWall(window.wallId))
        }
        aria-label="Focus window"
      >
        <Focus size={18} />
      </button>
    </aside>
  );
}
