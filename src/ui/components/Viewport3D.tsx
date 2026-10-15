import { useRuntime } from '@ui/context/RuntimeContext';
import { Compass,Move,RotateCw } from 'lucide-react';
import React,{ useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore } from 'react';
import { selectedOpening,selectedRoom,selectedWall } from '../../application/queries/SelectionQueries';

export const Viewport3D: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const runtime = useRuntime();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneService = runtime.scene;
  const interactionService = runtime.interaction;
  const editor = runtime.editor;
  const status = useSyncExternalStore(sceneService.subscribeStatus, sceneService.getStatus);

  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate');
  const [hasPlan, setHasPlan] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Scene and Interaction Services
    try {
      sceneService.initialize(containerRef.current);
      interactionService.initialize(sceneService, editor);
    } catch (error) {
      sceneService.reportError(error);
      return () => sceneService.dispose();
    }

    // Initial plan render if already available
    const initialPlan = editor.getSnapshot();
    if (initialPlan) {
      sceneService.renderPlan(initialPlan);
      setHasPlan(true);
    }

    const unsubscribeDocument = editor.subscribe(change => {
      try {
        sceneService.applyDocumentChange(change);
        setHasPlan(true);
      } catch (error) { sceneService.reportError(error); }
    });
    const unsubscribeSelection = editor.selection.subscribe(() => {
      sceneService.setOpeningSelectionHighlight(selectedOpening(editor));
      sceneService.setWallSelectionHighlight(selectedWall(editor));
      sceneService.setFloorSelectionHighlight(selectedRoom(editor));
    });

    return () => {
      unsubscribeDocument();
      unsubscribeSelection();
      interactionService.dispose();
      sceneService.dispose();
    };
  }, [sceneService, interactionService, editor]);

  useLayoutEffect(() => {
    sceneService.setInteractionEnabled(!disabled);
    interactionService.setEnabled(!disabled);
  }, [disabled, sceneService, interactionService]);

  const handleGizmoModeChange = (mode: 'translate' | 'rotate') => {
    setGizmoMode(mode);
    interactionService.setGizmoMode(mode);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {status.state !== 'ready' && (
        <div role={status.state === 'error' ? 'alert' : 'status'} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center text-sm text-slate-200">
          {status.state !== 'error' && <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500/20 border-t-sky-500" />}
          <p>{status.message}</p>
          {status.state === 'error' && <button onClick={() => window.location.reload()} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Reload</button>}
        </div>
      )}

      {/* Floating Gizmo Tool Toolbar */}
      {hasPlan && (
        <div className="absolute top-4 left-4 flex bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-xl z-10 gap-1">
          <button
            onClick={() => handleGizmoModeChange('translate')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${gizmoMode === 'translate'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            title="Move objects along floor plane (Translation)"
          >
            <Move className="w-4 h-4" />
            <span>Move</span>
          </button>

          <button
            onClick={() => handleGizmoModeChange('rotate')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${gizmoMode === 'rotate'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            title="Rotate objects around vertical axis"
          >
            <RotateCw className="w-4 h-4" />
            <span>Rotate</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Control Hints */}
      <div className="absolute bottom-4 left-4 bg-slate-900/85 backdrop-blur border border-slate-800/80 px-3.5 py-1.5 rounded-lg text-[11px] text-slate-400 flex items-center gap-3.5 z-10 pointer-events-none select-none shadow-lg">
        <span className="flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <strong className="text-slate-200">WASD:</strong> Move
        </span>
        <span>
          <strong className="text-slate-200">Q / E:</strong> Elevation
        </span>
        <span>
          <strong className="text-slate-200">Arrows:</strong> Look Angle
        </span>
        <span>
          <strong className="text-slate-200">Shift:</strong> Boost
        </span>
        <span className="text-slate-600">|</span>
        <span>
          <strong className="text-slate-300">Left Drag:</strong> Orbit
        </span>
        <span>
          <strong className="text-slate-300">Right Drag:</strong> Pan
        </span>
        <span>
          <strong className="text-slate-300">Scroll:</strong> Zoom
        </span>
      </div>
    </div>
  );
};
