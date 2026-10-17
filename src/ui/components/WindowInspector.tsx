import { Focus,X } from 'lucide-react';
import { FinishOpening,SetWindowCurtains,ConfigureWindowDressing } from '../../application/commands/StructuralCommands';
import type { WindowOpening } from '../../domain/elements/Opening';
import { useRuntime } from '../context/RuntimeContext';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { windowDressingDefaults, type WindowDressingStyle } from '../../domain/model/WindowDressing';

export function WindowInspector({
  window,
  onClose,
}: {
  window: WindowOpening;
  onClose: () => void;
}) {
  const { editor, scene } = useRuntime();
  const dressing = window.windowDressing, defaults = dressing ? windowDressingDefaults(dressing.style) : undefined;
  const blind = dressing && ['roller', 'roman', 'venetian'].includes(dressing.style);
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
        <h3 className="text-sm font-semibold text-slate-200">{blind ? 'Window blind' : 'Ceiling-mounted curtains'}</h3>
        <p className="text-xs text-slate-400">{blind ? 'Fitted to the window opening.' : 'Floor-length pleated panels on a ceiling track.'}</p>
        <label className="block text-xs text-slate-300">Window dressing
          <select aria-label="Window dressing" value={dressing?.style ?? 'standard'} onChange={event => {
            const style = event.target.value as WindowDressingStyle | 'standard';
            editor.execute(new ConfigureWindowDressing(window.id, style === 'standard' ? undefined : { style, ...windowDressingDefaults(style) }));
          }} className="mt-1 w-full rounded border border-slate-600 bg-slate-800 p-2">
            <option value="standard">Standard pleated curtains</option><option value="sheer">Sheer curtains</option><option value="blackout">Blackout curtains</option>
            <option value="layered">Layered sheer and blackout curtains</option><option value="roller">Roller blind</option><option value="roman">Roman blind</option><option value="venetian">Venetian blind</option>
          </select>
        </label>
        {dressing && <>
          <label className="block text-xs text-slate-300">{blind ? 'Raise blind' : 'Open curtains'} · {Math.round((dressing.openness ?? defaults!.openness) * 100)}%
            <input aria-label="Window dressing opening" type="range" min="0" max="1" step="0.05" value={dressing.openness ?? defaults!.openness}
              onChange={event => editor.execute(new ConfigureWindowDressing(window.id, { ...dressing, openness: +event.target.value }))} className="mt-2 w-full accent-sky-500" />
          </label>
          <label className="flex items-center justify-between text-xs text-slate-300">Fabric colour
            <input aria-label="Window dressing colour" type="color" value={dressing.color ?? defaults!.color} onChange={event => editor.execute(new ConfigureWindowDressing(window.id, { ...dressing, color: event.target.value }))} />
          </label>
          {dressing.style === 'layered' && <label className="flex items-center justify-between text-xs text-slate-300">Sheer colour
            <input aria-label="Sheer curtain colour" type="color" value={dressing.liningColor ?? defaults!.liningColor} onChange={event => editor.execute(new ConfigureWindowDressing(window.id, { ...dressing, liningColor: event.target.value }))} />
          </label>}
        </>}
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
      <button className="rounded border border-slate-700 px-3 py-2 text-xs text-sky-300" onClick={() => editor.selection.set({ kind: 'wall', id: window.wallId, subtarget: 'cornice' })}>Edit wall-to-wall cornice</button>
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
