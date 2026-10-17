import { SurfaceFinishConfig,WallEntity,WallFrameStyle } from '@core/types/plan';
import { useRuntime,useSelection } from '@ui/context/RuntimeContext';
import { Focus,Layers,MapPin,RotateCw,Sparkles,X } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { ApplyRoomFinish,ChangeWallMaterial,FinishWall,FrameWall } from '../../application/commands/StructuralCommands';
import { wallRecesses as queryRecesses } from '../../application/queries/WallQueries';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { WallFrameControls } from './wall/WallFrameControls';
import { WallRecessSection } from './wall/WallRecessSection';
import { WallRoomApplicator } from './wall/WallRoomApplicator';
import { SurfaceTargetSelector } from './SurfaceTargetSelector';
import { WallSplitControls } from './wall/WallSplitControls';
import { getWallTargetStrategy } from './wall/WallTargetStrategy';
import { WallTrimControls } from './wall/WallTrimControls';

interface WallInspectorProps {
  wall: WallEntity | null;
  onClose: () => void;
}

export const WallInspector: React.FC<WallInspectorProps> = ({ wall, onClose }) => {
  const runtime = useRuntime();
  const editor = runtime.editor;
  const sceneService = runtime.scene;

  const selection = useSelection();
  const activeTarget = selection?.kind === 'wall' && selection.id === wall?.id ? selection.subtarget ?? 'A' : 'A';
  const [selectedRoomToApply, setSelectedRoomToApply] = useState<string>('');
  const [selectedRecessId, setSelectedRecessId] = useState<string | undefined>(undefined);

  const wallRecesses = wall ? queryRecesses(editor.getSnapshot(), wall.id) || [] : [];
  const primaryRecess =
    (selectedRecessId ? wallRecesses.find((r) => r.id === selectedRecessId) : undefined) ||
    wallRecesses[0] ||
    null;

  useEffect(() => {
    if (!wall) return;
    const currentSide = activeTarget;

    // Auto-select room based on active side
    if (currentSide === 'A' && wall.roomSideA) {
      setSelectedRoomToApply(wall.roomSideA);
    } else if (currentSide === 'B' && wall.roomSideB) {
      setSelectedRoomToApply(wall.roomSideB);
    } else if (wall.roomIds && wall.roomIds.length > 0) {
      setSelectedRoomToApply(wall.roomIds[0]);
    }
  }, [wall?.id, activeTarget]);

  if (!wall) return null;

  const plan = editor.getSnapshot();
  const dx = wall.p2.x - wall.p1.x;
  const dy = wall.p2.y - wall.p1.y;
  const wallLength = Math.hypot(dx, dy);

  // Room names for side A and side B
  const roomA = wall.roomSideA && plan ? plan.rooms.find((r) => r.id === wall.roomSideA) : null;
  const roomB = wall.roomSideB && plan ? plan.rooms.find((r) => r.id === wall.roomSideB) : null;

  // Bordering room names
  const rooms: { id: string; name: string }[] = [];
  if (wall.roomIds && plan) {
    for (const rid of wall.roomIds) {
      const rm = plan.rooms.find((r) => r.id === rid);
      if (rm && !rooms.some((existing) => existing.id === rm.id)) {
        rooms.push({ id: rm.id, name: rm.name });
      }
    }
  }

  // Strategy Pattern for finish target operations
  const currentStrategy = getWallTargetStrategy(activeTarget);
  const currentFinishForSide = currentStrategy.getFinish(wall, primaryRecess);

  const handleTargetChange = (targetId: string, recessId?: string) => {
    if (recessId) setSelectedRecessId(recessId);
    editor.selection.select('wall', wall, targetId);
    if (targetId === 'A' && wall.roomSideA) {
      setSelectedRoomToApply(wall.roomSideA);
    } else if (targetId === 'B' && wall.roomSideB) {
      setSelectedRoomToApply(wall.roomSideB);
    }
  };

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    currentStrategy.applyFinish(editor, wall, finish, primaryRecess);
  };

  const handleResetFinish = () => {
    currentStrategy.resetFinish(editor, wall, primaryRecess);
  };

  const handleApplyToRoom = () => {
    if (!currentFinishForSide || !selectedRoomToApply) return;
    editor.execute(new ApplyRoomFinish(selectedRoomToApply, currentFinishForSide));
  };

  const handleFrameStyleChange = (style: WallFrameStyle) => {
    editor.execute(new FrameWall(wall.id, style, wall.frameColor || '#18181b'));
  };

  const handleFrameColorChange = (hex: string) => {
    const currentStyle = wall.frameStyle || 'none';
    editor.execute(new FrameWall(wall.id, currentStyle === 'none' ? 'perimeter' : currentStyle, hex));
  };

  const handleToggleGlassWall = () => {
    const isGlass = wall.material === 'a_glass' || wall.material === 'glass';
    const nextMat = isGlass ? 'standard' : 'a_glass';
    editor.execute(new ChangeWallMaterial(wall.id, nextMat));
    if (!isGlass && !wall.finish && !wall.finishSideA) {
      editor.execute(new FinishWall(wall.id, {
        type: 'glass',
        variant: 'frosted_mica',
        color: '#f8fafc',
      }));
    }
  };

  return (
    <div className="absolute right-4 top-4 w-[21rem] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 text-xs z-30 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Wall
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {wall.id}
            </span>
          </div>
          <h2 className="font-semibold text-sm text-white truncate max-w-[220px]">
            Wall {wallLength.toFixed(2)}m ({(wall.thickness * 100).toFixed(0)}cm thick)
          </h2>
          {rooms.length > 0 && (
            <div className="text-[11px] text-sky-400 mt-0.5 truncate font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {rooms.map((r) => r.name).join(' ↔ ')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => sceneService.focusOnWall(wall)}
            className="p-1 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
            title="Focus camera on this wall"
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

      {/* Wall Construction & Frame Controls */}
      <WallFrameControls
        wall={wall}
        onFrameStyleChange={handleFrameStyleChange}
        onFrameColorChange={handleFrameColorChange}
        onToggleGlassWall={handleToggleGlassWall}
      />

      {/* Wall Recess / Niche */}
      <WallRecessSection
        wall={wall}
        wallLength={wallLength}
        wallRecesses={wallRecesses}
        selectedRecessId={primaryRecess?.id}
        activeTarget={activeTarget}
        editor={editor}
        sceneService={sceneService}
        onSelectTarget={handleTargetChange}
      />

      <SurfaceTargetSelector
        kind="wall"
        activeTarget={activeTarget}
        roomA={roomA}
        roomB={roomB}
        hasRecesses={wallRecesses.length > 0}
        onSelectTarget={handleTargetChange}
      />

      {/* Surface Finish Picker */}
      <WallTrimControls wall={wall} target={activeTarget} />
      <div className="py-3">
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Finish & Cladding
          </span>
          <div className="flex items-center gap-1.5">
            {currentFinishForSide?.type === 'tile' && (
              <>
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                  title={`Grout joint: ${currentFinishForSide.groutWidth ?? 1} mm (${currentFinishForSide.groutColor || '#d1d5db'})`}
                >
                  <span
                    className="w-2 h-2 rounded-full border border-slate-600 inline-block shrink-0"
                    style={{ backgroundColor: currentFinishForSide.groutColor || '#d1d5db' }}
                  />
                  <span className="font-mono text-[9px] text-slate-400">{currentFinishForSide.groutWidth ?? 1}mm</span>
                </span>
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
              </>
            )}
            <span className="text-[10px] font-mono text-sky-400 uppercase">
              {currentStrategy.label}
            </span>
          </div>
        </div>

        <SurfaceFinishPicker
          currentFinish={currentFinishForSide}
          onSelectFinish={handleApplyFinish}
          onClearFinish={handleResetFinish}
        />
      </div>

      {/* Wall Split / Partial Painting */}
      <WallSplitControls
        wall={wall}
        wallLength={wallLength}
        editor={editor}
        sceneService={sceneService}
      />

      {/* Bulk Apply to Entire Room */}
      <WallRoomApplicator
        rooms={rooms}
        currentFinish={currentFinishForSide}
        selectedRoom={selectedRoomToApply}
        onSelectRoom={setSelectedRoomToApply}
        onApplyToRoom={handleApplyToRoom}
      />
    </div>
  );
};
