import { OpeningEntity,WallEntity } from '@core/types/plan';
import { useRuntime } from '@ui/context/RuntimeContext';
import {
ArrowLeftRight,
ChevronLeft,
ChevronRight,
DoorOpen,
Focus,
RotateCcw,
RotateCw,
SlidersHorizontal,
Sparkles,
X,
} from 'lucide-react';
import React from 'react';
import { ColorOpeningFrame,FinishOpening,FlipDoor,OpenDoor,RotateDoor } from '../../application/commands/StructuralCommands';
import { allDoors as queryDoors } from '../../application/queries/SelectionQueries';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';

interface DoorInspectorProps {
  selected: { opening: OpeningEntity; wall: WallEntity } | null;
  onClose: () => void;
}

export const DoorInspector: React.FC<DoorInspectorProps> = ({ selected, onClose }) => {
  const runtime = useRuntime();
  const editor = runtime.editor;
  const sceneService = runtime.scene;

  if (!selected) return null;

  const { opening, wall } = selected;
  const plan = editor.getSnapshot();
  const allDoors = queryDoors(editor.getSnapshot());
  const currentIndex = allDoors.findIndex((d) => d.opening.id === opening.id);

  // Canonical swing/hinge — set at parse time, mutated by flipDoor()
  const currentSwing: 'r' | 'l' = opening.swingSide ?? 'r';
  const currentHinge: 'r' | 'l' = opening.hingeSide ?? 'r';

  const currentAngleDeg = opening.openAngle !== undefined ? opening.openAngle : 40;

  const isSliding = opening.type === 'door_coupe';
  const doorTitle = isSliding ? 'Sliding Door (Coupe)' : 'Single Hinged Door';

  // Room names
  const roomNames: string[] = [];
  if (wall.roomIds && plan) {
    for (const rid of wall.roomIds) {
      const rm = plan.rooms.find((r) => r.id === rid);
      if (rm) roomNames.push(rm.name);
    }
  }

  const handleFlipSwing = () => {
    editor.execute(new FlipDoor(opening.id, 'swing'));
  };

  const handleFlipHinge = () => {
    editor.execute(new FlipDoor(opening.id, 'hinge'));
  };

  const handleFocus = () => {
    sceneService.focusOnOpening(opening, wall);
  };

  const handleSelectDoor = (index: number) => {
    if (index >= 0 && index < allDoors.length) {
      const nextDoor = allDoors[index];
      editor.selection.select('opening', (nextDoor)?.opening);
      sceneService.focusOnOpening(nextDoor.opening, nextDoor.wall);
    }
  };

  return (
    <div className="absolute right-4 top-4 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 text-xs z-30 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <DoorOpen className="w-3 h-3" />
              {isSliding ? 'Sliding Door' : 'Door'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {opening.id}
            </span>
          </div>
          <h2 className="font-semibold text-sm text-white truncate max-w-[220px]">
            {doorTitle}
          </h2>
          {roomNames.length > 0 && (
            <div className="text-[11px] text-sky-400 mt-0.5 truncate font-medium">
              {roomNames.join(' ↔ ')}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Door Specs */}
      <div className="py-2.5 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
        <div>
          Width: <span className="text-white font-medium">{Math.round(opening.width * 100)} cm</span>
        </div>
        <div>
          Height: <span className="text-white font-medium">{Math.round(opening.height * 100)} cm</span>
        </div>
        <div>
          Wall: <span className="text-white font-medium">{Math.round((wall.thickness || 0.1) * 100)} cm</span>
        </div>
      </div>

      {/* Manual Flip Action Controls */}
      <fieldset className="py-3 border-b border-slate-800 space-y-2">
        <legend className="pt-3 text-xs font-semibold text-slate-200">Door frame color</legend>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Door frame color"
            value={opening.frameColor ?? '#333338'}
            onChange={event => editor.execute(new ColorOpeningFrame(opening.id, event.target.value))}
            className="h-9 w-12 rounded border border-slate-700 bg-slate-800 cursor-pointer"
          />
          <span className="font-mono text-slate-400">{opening.frameColor ?? '#333338'}</span>
          <button
            type="button"
            disabled={!opening.frameColor}
            onClick={() => editor.execute(new ColorOpeningFrame(opening.id))}
            className="ml-auto text-slate-400 hover:text-white disabled:opacity-40"
          >Reset frame color</button>
        </div>
        <div className="flex gap-2">
          {[
            { name: 'White', color: '#f8fafc' },
            { name: 'Black', color: '#18181b' },
            { name: 'Greige', color: '#d6cbb8' },
            { name: 'Walnut', color: '#6b4932' },
          ].map(preset => (
            <button
              key={preset.name}
              type="button"
              aria-label={`${preset.name} door frame`}
              title={`${preset.name} door frame`}
              onClick={() => editor.execute(new ColorOpeningFrame(opening.id, preset.color))}
              className="h-8 w-8 rounded border border-slate-600 hover:border-sky-400"
              style={{ backgroundColor: preset.color }}
            />
          ))}
        </div>
      </fieldset>

      {/* Manual Flip Action Controls */}
      <div className="py-3 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-xs flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            Door Flip Controls
          </span>
          <button
            onClick={handleFocus}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
            title="Focus camera on this door"
          >
            <Focus className="w-3 h-3 text-sky-400" />
            Focus
          </button>
        </div>

        {/* 1. Flip Hinge Side Button (TOP PRIORITY) */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-700/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
              Hinge Position
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${opening.hingeFlipped
              ? 'bg-sky-500/30 text-sky-300 border border-sky-400/40'
              : 'bg-slate-800 text-slate-300'
              }`}>
              {currentHinge === 'l' ? '👈 HINGE ON LEFT' : '👉 HINGE ON RIGHT'}
            </span>
          </div>
          <button
            disabled={isSliding}
            onClick={handleFlipHinge}
            className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-2 font-semibold text-xs transition-all shadow-md active:scale-[0.98]"
            title="Flip hinge side to the other frame post (Left / Right)"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Flip Hinge Side ({currentHinge === 'l' ? 'Move to Right ➔' : '⬅ Move to Left'})
          </button>
        </div>

        {/* 2. Flip Swing Direction Button */}
        <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-700/80 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Swing Direction
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${opening.swingFlipped
              ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
              : 'bg-slate-800 text-slate-300'
              }`}>
              {currentSwing === 'r' ? 'OUTWARD (Side R)' : 'INWARD (Side L)'}
            </span>
          </div>
          <button
            disabled={isSliding}
            onClick={handleFlipSwing}
            className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center gap-2 font-semibold text-xs transition-all shadow-md active:scale-[0.98]"
            title="Flip door swing inward or outward across the wall"
          >
            <RotateCcw className="w-4 h-4" />
            Flip Swing Direction (In ↔ Out)
          </button>
        </div>
      </div>

      {/* Door Rotation & Open Angle Controls */}
      <div className="py-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-medium flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
            {isSliding ? 'Door Slide & Opening' : 'Door Rotation / Open Angle'}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Door opening angle"
              type="number"
              min="0"
              max="180"
              step="5"
              value={currentAngleDeg}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) editor.execute(new OpenDoor(opening.id, val));
              }}
              className="w-14 bg-slate-950 border border-slate-700 text-sky-300 font-mono text-xs rounded px-1.5 py-0.5 text-right outline-none focus:border-sky-500"
            />
            <span className="text-slate-400 text-xs">deg</span>
          </div>
        </div>

        {/* Rotation Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max="180"
            step="5"
            value={currentAngleDeg}
            onChange={(e) => editor.execute(new OpenDoor(opening.id, parseInt(e.target.value) || 0))}
            className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
            <span>0° (Closed)</span>
            <span>45°</span>
            <span>90° (Open)</span>
            <span>180°</span>
          </div>
        </div>

        {/* Quick Angle Presets */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { label: '0° Closed', val: 0 },
            { label: '45° Ajar', val: 45 },
            { label: '90° Open', val: 90 },
            { label: '135° Wide', val: 135 },
          ].map((preset) => (
            <button
              key={preset.val}
              onClick={() => editor.execute(new OpenDoor(opening.id, preset.val))}
              className={`py-1 rounded text-[10px] font-medium transition-all ${currentAngleDeg === preset.val
                ? 'bg-sky-500 text-white font-semibold shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Fine-Tuning Step & Rotate 180 Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => editor.execute(new RotateDoor(opening.id, -15))}
            className="flex-1 py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 text-[11px] transition-colors"
            title="Rotate door -15 degrees"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            -15°
          </button>
          <button
            onClick={() => editor.execute(new RotateDoor(opening.id, 15))}
            className="flex-1 py-1.5 px-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 text-[11px] transition-colors"
            title="Rotate door +15 degrees"
          >
            <RotateCw className="w-3 h-3 text-slate-400" />
            +15°
          </button>
          <button
            onClick={() => editor.execute(new RotateDoor(opening.id, 180))}
            className="flex-1 py-1.5 px-2 rounded-md bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 flex items-center justify-center gap-1 text-[11px] font-medium transition-colors"
            title="Rotate door 180 degrees (flip facing direction)"
          >
            <RotateCw className="w-3 h-3 text-sky-400" />
            Rotate 180°
          </button>
        </div>
      </div>

      {/* Door Leaf Surface Finish */}
      <div className="pt-3 border-t border-slate-800 space-y-2">
        <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Door Leaf Finish (Wood / Paint / Paneling / Glass)
        </div>
        <SurfaceFinishPicker
          currentFinish={opening.finish}
          onSelectFinish={(finish) => {
            editor.execute(new FinishOpening(opening.id, finish));
          }}
          onClearFinish={() => {
            editor.execute(new FinishOpening(opening.id));
          }}
        />
      </div>

      {/* Door Navigation Footer */}
      {allDoors.length > 1 && (
        <div className="pt-3 flex items-center justify-between">
          <button
            onClick={() => handleSelectDoor(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>

          <span className="text-[11px] text-slate-400">
            Door <span className="text-white font-medium">{currentIndex + 1}</span> of {allDoors.length}
          </span>

          <button
            onClick={() => handleSelectDoor(currentIndex + 1)}
            disabled={currentIndex >= allDoors.length - 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
