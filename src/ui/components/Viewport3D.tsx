import React, { useEffect, useRef, useState } from 'react';
import { useService } from '@ui/context/DIContext';
import { TOKENS } from '@core/di/tokens';
import { ISceneService, IInteractionService, IPlanManagerService } from '@core/types/services';
import { Move, RotateCw, Compass } from 'lucide-react';

export const Viewport3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneService = useService<ISceneService>(TOKENS.SceneService);
  const interactionService = useService<IInteractionService>(TOKENS.InteractionService);
  const planManager = useService<IPlanManagerService>(TOKENS.PlanManagerService);

  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate');
  const [hasPlan, setHasPlan] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Scene and Interaction Services
    sceneService.initialize(containerRef.current);
    interactionService.initialize(sceneService, planManager);

    // Initial plan render if already available
    const initialPlan = planManager.getPlan();
    if (initialPlan) {
      sceneService.renderPlan(initialPlan);
      setHasPlan(true);
    }

    // Subscribe to Plan Loads (initial load or new file upload)
    const unsubscribeLoaded = planManager.onPlanLoaded((plan) => {
      sceneService.renderPlan(plan);
      setHasPlan(true);
    });

    // Subscribe to individual furniture updates (moving, rotating, replacing)
    const unsubscribeUpdated = planManager.onFurnitureUpdated((entity) => {
      sceneService.updateFurnitureObject(entity);
    });

    // Subscribe to furniture deletions
    const unsubscribeDeleted = planManager.onFurnitureDeleted((id) => {
      sceneService.removeFurnitureObject(id);
    });

    // Subscribe to opening updates (e.g. flipping doors)
    const unsubscribeOpeningUpdated = planManager.onOpeningUpdated((opening, wall) => {
      sceneService.updateOpening(opening, wall);
    });

    // Subscribe to opening selection changes
    const unsubscribeOpeningSelected = planManager.onOpeningSelectionChange((selected) => {
      sceneService.setOpeningSelectionHighlight(selected);
    });

    // Subscribe to wall updates (finishes, colors, textures)
    const unsubscribeWallUpdated = planManager.onWallUpdated((wall) => {
      sceneService.updateWallFinish(wall);
    });

    // Subscribe to wall selection changes
    const unsubscribeWallSelected = planManager.onWallSelectionChange((selected) => {
      sceneService.setWallSelectionHighlight(selected);
    });

    // Subscribe to wall structural changes (e.g. wall splitting)
    const unsubscribeWallsChanged = planManager.onWallsChanged?.((plan) => {
      sceneService.rebuildWalls?.(plan);
    });

    // Subscribe to room floor finish updates
    const unsubscribeRoomUpdated = planManager.onRoomUpdated?.((room) => {
      sceneService.updateRoomFloorFinish(room);
    });

    // Subscribe to room selection changes
    const unsubscribeRoomSelected = planManager.onRoomSelectionChange?.((selected) => {
      sceneService.setFloorSelectionHighlight(selected);
    });

    return () => {
      unsubscribeLoaded();
      unsubscribeWallsChanged?.();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeOpeningUpdated();
      unsubscribeOpeningSelected();
      unsubscribeWallUpdated();
      unsubscribeWallSelected();
      unsubscribeRoomUpdated?.();
      unsubscribeRoomSelected?.();
      interactionService.dispose();
      sceneService.dispose();
    };
  }, [sceneService, interactionService, planManager]);

  const handleGizmoModeChange = (mode: 'translate' | 'rotate') => {
    setGizmoMode(mode);
    interactionService.setGizmoMode(mode);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Gizmo Tool Toolbar */}
      {hasPlan && (
        <div className="absolute top-4 left-4 flex bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-xl z-10 gap-1">
          <button
            onClick={() => handleGizmoModeChange('translate')}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              gizmoMode === 'translate'
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
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium ${
              gizmoMode === 'rotate'
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
