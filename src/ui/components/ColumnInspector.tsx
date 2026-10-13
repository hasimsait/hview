import React, { useState, useEffect } from 'react';
import { ColumnEntity, SurfaceFinishConfig, ColumnSide } from '@core/types/plan';
import { useService } from '@ui/context/DIContext';
import { TOKENS } from '@core/di/tokens';
import { IPlanManagerService, ISceneService } from '@core/types/services';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import {
  X,
  Focus,
  Check,
  Sparkles,
  Box,
  MapPin,
  Flame,
  RotateCw,
} from 'lucide-react';

interface ColumnInspectorProps {
  column: ColumnEntity | null;
  onClose: () => void;
}

export const ColumnInspector: React.FC<ColumnInspectorProps> = ({ column, onClose }) => {
  const planManager = useService<IPlanManagerService>(TOKENS.PlanManagerService);
  const sceneService = useService<ISceneService>(TOKENS.SceneService);

  const [activeSide, setActiveSide] = useState<ColumnSide>('all');
  const [selectedRoomToApply, setSelectedRoomToApply] = useState<string>('');

  useEffect(() => {
    const unsub = planManager.onColumnSelectionChange?.((_selectedCol, side) => {
      if (side) {
        setActiveSide(side);
      }
    });
    return () => unsub?.();
  }, [planManager]);

  useEffect(() => {
    if (!column) return;
    const currentSide = planManager.getSelectedColumnSide?.() || 'all';
    setActiveSide(currentSide);

    if (column.roomId) {
      setSelectedRoomToApply(column.roomId);
    } else {
      const plan = planManager.getPlan();
      if (plan && plan.rooms.length > 0) {
        setSelectedRoomToApply(plan.rooms[0].id);
      }
    }
  }, [column, planManager]);

  if (!column) return null;

  const plan = planManager.getPlan();
  const isChimney = column.type === 'chimney';

  // Room context
  const room = column.roomId && plan ? plan.rooms.find((r) => r.id === column.roomId) : null;
  const roomName = column.roomName || room?.name;

  // Determine current finish for active side
  const currentFinishForSide: SurfaceFinishConfig | undefined =
    activeSide === 'front'
      ? column.finishFront || column.finish
      : activeSide === 'back'
      ? column.finishBack || column.finish
      : activeSide === 'left'
      ? column.finishLeft || column.finish
      : activeSide === 'right'
      ? column.finishRight || column.finish
      : column.finish || column.finishFront || column.finishBack;

  const handleFocus = () => {
    sceneService.focusOnColumn(column);
  };

  const handleSideChange = (side: ColumnSide) => {
    setActiveSide(side);
    planManager.setSelectedColumn(column, side);
  };

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    planManager.setColumnFinish(column.id, finish, activeSide);
  };

  const handleApplyToRoom = () => {
    if (!currentFinishForSide || !selectedRoomToApply) return;
    planManager.setRoomWallFinish(selectedRoomToApply, currentFinishForSide);
  };

  const handleResetFinish = () => {
    const defaultFinish: SurfaceFinishConfig = {
      type: 'plaster',
      variant: 'smooth',
      color: '#efede8',
      roughness: 0.85,
    };
    planManager.setColumnFinish(column.id, defaultFinish, activeSide);
  };

  return (
    <div className="absolute right-4 top-4 w-84 max-h-[calc(100vh-5.5rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 text-xs z-30 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                isChimney
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {isChimney ? <Flame className="w-3 h-3" /> : <Box className="w-3 h-3" />}
              {isChimney ? 'Chimney / Shaft' : 'Structural Column'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {column.id.slice(0, 12)}
            </span>
          </div>
          <h2 className="font-semibold text-sm text-white truncate max-w-[220px]">
            {column.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
            <span>
              Dim: {(column.width * 100).toFixed(0)} × {(column.depth * 100).toFixed(0)} cm
            </span>
            {column.area && column.area > 0 && (
              <span>• {column.area.toFixed(2)} m²</span>
            )}
          </div>
          {roomName && (
            <div className="text-[11px] text-sky-400 mt-1 truncate font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              Location: {roomName}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFocus}
            className="p-1 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
            title="Focus camera on this object"
          >
            <Focus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Face / Side Selector */}
      <div className="py-2.5 border-b border-slate-800">
        <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Box className="w-3 h-3 text-emerald-400" />
            Selected Face / Side
          </span>
          <span className="text-[9px] text-slate-500 lowercase">
            individual face styling
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => handleSideChange('all')}
            className={`col-span-2 px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center ${
              activeSide === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Apply finish to all 4 vertical faces"
          >
            All 4 Sides
          </button>
          <button
            type="button"
            onClick={() => handleSideChange('front')}
            className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${
              activeSide === 'front'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Front face (+Z)"
          >
            Front (+Z)
          </button>
          <button
            type="button"
            onClick={() => handleSideChange('back')}
            className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${
              activeSide === 'back'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Back face (-Z)"
          >
            Back (-Z)
          </button>
          <button
            type="button"
            onClick={() => handleSideChange('left')}
            className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${
              activeSide === 'left'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Left face (-X)"
          >
            Left (-X)
          </button>
          <button
            type="button"
            onClick={() => handleSideChange('right')}
            className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${
              activeSide === 'right'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Right face (+X)"
          >
            Right (+X)
          </button>
        </div>
      </div>

      {/* Surface Finish Picker */}
      <div className="py-3">
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Finish & Cladding
          </span>
          <div className="flex items-center gap-1.5">
            {currentFinishForSide?.type === 'tile' && (
              <button
                type="button"
                onClick={() => {
                  const currentRot = currentFinishForSide.rotation || 0;
                  const nextRot = (currentRot + 90) % 360;
                  handleApplyFinish({ ...currentFinishForSide, rotation: nextRot });
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600/80 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-medium transition-colors"
                title="Flip tile texture orientation (horizontal / vertical)"
              >
                <RotateCw className="w-3 h-3 text-emerald-400" />
                <span>Flip ({(currentFinishForSide.rotation || 0) % 180 === 90 ? 'Vertical' : 'Horizontal'})</span>
              </button>
            )}
            <span className="text-[10px] font-mono text-emerald-400 uppercase">
              {activeSide === 'all' ? 'All 4 Sides' : `Side: ${activeSide}`}
            </span>
          </div>
        </div>

        <SurfaceFinishPicker
          currentFinish={currentFinishForSide}
          onSelectFinish={handleApplyFinish}
          onClearFinish={handleResetFinish}
        />
      </div>

      {/* Bulk Apply to Entire Room */}
      {plan && plan.rooms.length > 0 && column.finish && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
            <span>Apply Across Room</span>
            <span className="text-emerald-400 text-[9px] font-normal">Walls & columns</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedRoomToApply}
              onChange={(e) => setSelectedRoomToApply(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
            >
              {plan.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyToRoom}
              className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
              title="Apply this finish to all interior walls and columns in the room"
            >
              <Check className="w-3.5 h-3.5" />
              Apply Room
            </button>
          </div>
          <p className="text-[10px] text-slate-500 italic">
            Applies this cladding/paint to all walls and structural elements within the room.
          </p>
        </div>
      )}
    </div>
  );
};
