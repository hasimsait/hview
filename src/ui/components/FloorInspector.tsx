import { RoomEntity,SurfaceFinishConfig } from '@core/types/plan';
import { useRuntime } from '@ui/context/RuntimeContext';
import {
Focus,
Grid,
Layers,
RotateCcw,
RotateCw,
Sparkles,
Split,
X,
} from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { ConfigureCeiling,FinishFloor,RenameRoom,SetCeilingHeight } from '../../application/commands/StructuralCommands';
import { roomCeilingHeight, roomCeilingMaximum, roomCeilingType } from '../../domain/model/Ceiling';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';

interface FloorInspectorProps {
  room: RoomEntity | null;
  onClose: () => void;
}

export const FloorInspector: React.FC<FloorInspectorProps> = ({ room, onClose }) => {
  const runtime = useRuntime();
  const editor = runtime.editor;
  const sceneService = runtime.scene;

  const [roomName, setRoomName] = useState(room?.name || '');

  useEffect(() => {
    if (room) {
      setRoomName(room.name);
    }
  }, [room?.id, room?.name]);

  if (!room) return null;

  const isWetZone = /bath|toilet|wc|san|shower/i.test(room.name);
  const sharedMaximum = editor.getDocument().totalHeight, ceilingMaximum = roomCeilingMaximum(room, sharedMaximum);
  const ceilingHeight = roomCeilingHeight(room, sharedMaximum), ceilingType = roomCeilingType(room);
  const borderingWalls = (editor.getSnapshot()?.walls || []).filter(
    (w) => w.roomSideA === room.id || w.roomSideB === room.id || w.roomIds?.includes(room.id)
  );

  const handleNameCommit = () => {
    const name = roomName.trim();
    setRoomName(name || room.name);
    if (name) editor.execute(new RenameRoom(room.id, name));
  };

  const handleFocus = () => {
    sceneService.focusOnRoom(room.id);
  };

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    editor.execute(new FinishFloor(room.id, finish));
  };

  const handleResetToDefault = () => {
    editor.execute(new FinishFloor(room.id, undefined));
  };

  const handleCeilingChange = (type: 'clip_in' | 'gypsum' | 'none') => {
    editor.execute(new ConfigureCeiling(room.id, type));
  };

  // Human-readable finish name
  const getFinishDisplayName = (finish?: SurfaceFinishConfig) => {
    if (!finish) {
      return isWetZone ? 'Default Wet-Zone Ceramic Tile' : 'Default Scandinavian Oak Parquet';
    }
    if (finish.variant) {
      const catalogTile = runtime.tiles.getById(finish.variant);
      if (catalogTile) return catalogTile.name;
    }
    const names: Record<string, string> = {
      parquet_oak: 'Scandinavian Oak Parquet',
      parquet_walnut: 'Dark Walnut Plank Parquet',
      parquet_light: 'Bleached Ash / Light Parquet',
      parquet_herringbone: 'Herringbone Oak Parquet',
      natural_oak: 'Natural Solid Oak',
      dark_walnut: 'Solid Dark Walnut',
    };
    if (finish.variant && names[finish.variant]) return names[finish.variant];
    const typeFormatters: Record<string, (f: SurfaceFinishConfig) => string> = {
      wood: () => 'Architectural Parquet',
      tile: () => 'Architectural Tile',
      plaster: () => 'Microcement / Stucco',
      paint: (f) => `Painted Floor (${f.color || 'Custom'})`,
      metal: (f) => `Architectural Metal (${f.variant || f.color || 'Custom'})`,
      porcelain: () => 'White Vitreous China Porcelain',
    };
    if (typeFormatters[finish.type]) {
      return typeFormatters[finish.type](finish);
    }
    return `${finish.type} floor`;
  };

  return (
    <aside className="absolute top-16 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl flex flex-col z-20 overflow-hidden animate-in slide-in-from-right-4 duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Grid className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              Room & Floor Finish
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                {room.area.toFixed(1)} m²
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Inspect room & customize floor surfaces</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Room Information Card */}
        <div className="bg-slate-800/40 border border-slate-800/80 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-400">Room Name</label>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isWetZone
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
            >
              {isWetZone ? 'Wet Zone' : 'Dry Zone'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setRoomName(room.name);
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 transition-colors font-medium"
              placeholder="e.g. Master Bedroom"
            />
            <button
              type="button"
              onClick={handleFocus}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 transition-colors text-[11px] whitespace-nowrap"
              title="Focus camera on room"
            >
              <Focus className="w-3.5 h-3.5" />
              Focus
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="bg-slate-900/60 rounded p-2 border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Floor Area</span>
              <span className="text-slate-100 font-semibold">{room.area.toFixed(2)} m²</span>
            </div>
            <div className="bg-slate-900/60 rounded p-2 border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Ceiling Height</span>
              <span className="text-slate-100 font-semibold">{ceilingHeight.toFixed(2)} m</span>
            </div>
          </div>
        </div>

        {/* Ceiling Type Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Ceiling Finish / Type</span>
            <span className="text-[10px] text-slate-400 capitalize">
              {ceilingType === 'clip_in' ? 'Clip-in' : ceilingType === 'gypsum' ? 'Gypsum' : 'None'}
            </span>
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(
              [
                { id: 'none', label: 'None' },
                { id: 'clip_in', label: 'Clip-In 60x60' },
                { id: 'gypsum', label: 'Smooth Gypsum' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCeilingChange(c.id)}
                className={`py-1 text-[11px] font-medium rounded transition-colors ${ceilingType === c.id
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="block pt-2 text-slate-300">Finished ceiling height (m)
            <input aria-label="Finished ceiling height (m)" type="number" min="0.01" max={ceilingMaximum} step="0.01" value={+ceilingHeight.toFixed(3)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" onChange={e => {
              if (e.target.value === '') return;
              const height = +e.target.value;
              if (Number.isFinite(height) && height > 0 && height <= ceilingMaximum) editor.execute(new SetCeilingHeight(room.id, height));
            }} />
          </label>
          <p className="text-[11px] text-slate-400">Shared maximum: {sharedMaximum.toFixed(2)} m · Ceiling drop: {+((sharedMaximum - ceilingHeight) * 100).toFixed(1)} cm</p>
          <button type="button" className="text-[11px] text-sky-400 hover:text-sky-300" onClick={() => editor.execute(new SetCeilingHeight(room.id))}>Reset ceiling height</button>
          <p className="text-[10px] text-slate-500">Clip-in ceilings default to a 15 cm drop. Height is measured from the floor.</p>
        </div>

        {/* Bordering Room Walls & Partitions */}
        {borderingWalls.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Split className="w-3.5 h-3.5 text-sky-400" />
                Bordering Walls & Partitions
              </span>
              <span className="text-[10px] text-slate-500">
                {borderingWalls.length} walls
              </span>
            </label>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              {borderingWalls.map((w) => {
                const len = Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y);
                const isGlass = w.material === 'a_glass' || w.material === 'glass';
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      const side = w.roomSideA === room.id ? 'A' : 'B';
                      editor.selection.select('wall', w, side);
                      sceneService.focusOnWall(w);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-sky-500/50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isGlass ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                        }`}>
                        {isGlass ? 'Glass' : 'Solid'}
                      </span>
                      <span className="text-xs text-slate-200 group-hover:text-sky-300 font-medium truncate">
                        Wall {w.id} ({len.toFixed(2)}m)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {w.frameStyle && w.frameStyle !== 'none' && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          {w.frameStyle}
                        </span>
                      )}
                      <Focus className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Floor Finish Status */}
        <div className="bg-slate-800/40 border border-slate-800/80 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Active Floor Finish
            </span>
            {room.floorFinish ? (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                title="Reset to default parquet or tile"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Default
              </button>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                Default
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 rounded p-2 border border-slate-800">
            <div
              className="w-7 h-7 rounded border border-slate-700 flex-shrink-0 shadow-inner"
              style={{
                backgroundColor: room.floorFinish?.color || (isWetZone ? '#ecebe8' : '#dfcfb8'),
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-200 truncate">
                {getFinishDisplayName(room.floorFinish)}
              </div>
              <div className="text-[10px] text-slate-400">
                {room.floorFinish
                  ? `${room.floorFinish.type} • roughness ${room.floorFinish.roughness ?? 0.35}`
                  : isWetZone
                    ? 'Tile applied automatically for wet zone'
                    : 'Parquet applied automatically for dry space'}
              </div>
            </div>
          </div>
        </div>

        {/* Floor Finish Customizer */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Customize Floor Finish
            </span>
            <div className="flex items-center gap-1.5">
              {room.floorFinish?.type === 'tile' && (
                <>
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                    title={`Grout joint: ${room.floorFinish.groutWidth ?? 1} mm (${room.floorFinish.groutColor || '#d1d5db'})`}
                  >
                    <span
                      className="w-2 h-2 rounded-full border border-slate-600 inline-block shrink-0"
                      style={{ backgroundColor: room.floorFinish.groutColor || '#d1d5db' }}
                    />
                    <span className="font-mono text-[9px] text-slate-400">{room.floorFinish.groutWidth ?? 1}mm</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentRot = room.floorFinish!.rotation || 0;
                      const nextRot = (currentRot + 90) % 360;
                      handleApplyFinish({ ...room.floorFinish!, rotation: nextRot });
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600/80 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-medium transition-colors"
                    title="Flip floor tile orientation (horizontal / vertical)"
                  >
                    <RotateCw className="w-3 h-3 text-emerald-400" />
                    <span>Flip ({(room.floorFinish.rotation || 0) % 180 === 90 ? 'Vertical' : 'Horizontal'})</span>
                  </button>
                </>
              )}
              <span className="text-[10px] text-slate-400">1:1 Metric Scale</span>
            </div>
          </div>

          <SurfaceFinishPicker
            currentFinish={room.floorFinish}
            onSelectFinish={handleApplyFinish}
            onClearFinish={handleResetToDefault}
            defaultTab={isWetZone ? 'tile' : 'lambri'}
          />
        </div>
      </div>
    </aside>
  );
};
