import { RoomEntity,WallEntity } from '@core/types/plan';
import { Split } from 'lucide-react';
import React from 'react';
import { WALL_TARGET_STRATEGIES } from './WallTargetStrategy';

interface WallSideSelectorProps {
  wall: WallEntity;
  activeTarget: string;
  roomA?: RoomEntity | null;
  roomB?: RoomEntity | null;
  hasRecesses: boolean;
  onSelectTarget: (targetId: string) => void;
}

export const WallSideSelector: React.FC<WallSideSelectorProps> = ({
  wall: _wall,
  activeTarget,
  roomA,
  roomB,
  hasRecesses,
  onSelectTarget,
}) => {
  const faceTargets = ['A', 'B', 'both'];
  const edgeTargets = ['edge_start', 'edge_end', 'edge_top', 'baseboard', 'edges'];
  const recessTargets = ['recess_wall', 'corners'];

  return (
    <div className="py-2.5 border-b border-slate-800 space-y-2">
      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Split className="w-3 h-3 text-sky-400" />
          Wall Faces
        </span>
        <span className="text-[9px] text-slate-500 lowercase">
          independent side finishes
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
        {faceTargets.map((id) => {
          const strat = WALL_TARGET_STRATEGIES[id];
          if (!strat) return null;
          const isSelected = activeTarget === id;
          const extraInfo =
            id === 'A' && roomA
              ? ` (${roomA.name})`
              : id === 'B' && roomB
                ? ` (${roomB.name})`
                : '';

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTarget(id)}
              className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center truncate ${isSelected
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              title={strat.title}
            >
              {strat.label}
              {extraInfo}
            </button>
          );
        })}
      </div>

      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between pt-1">
        <span>Ends, Edges &amp; Sills</span>
        <span className="text-[9px] text-slate-500 lowercase">
          two-room intercepts
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
        {edgeTargets.map((id) => {
          const strat = WALL_TARGET_STRATEGIES[id];
          if (!strat) return null;
          const isSelected = activeTarget === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTarget(id)}
              className={`px-2 py-1.5 rounded text-[10px] font-medium transition-all text-center truncate ${isSelected
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              title={strat.title}
            >
              {strat.label}
            </button>
          );
        })}
      </div>

      {hasRecesses && (
        <>
          <div className="text-[10px] uppercase font-semibold text-amber-400 flex items-center justify-between pt-1">
            <span>Wall Recess Niche</span>
          </div>
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {recessTargets.map((id) => {
              const strat = WALL_TARGET_STRATEGIES[id];
              if (!strat) return null;
              const isSelected =
                activeTarget === id ||
                (id === 'corners' && activeTarget === 'sides') ||
                (id === 'sides' && activeTarget === 'corners');

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTarget(id)}
                  className={`px-2 py-1.5 rounded text-[11px] font-semibold transition-all text-center truncate ${isSelected
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-300 hover:text-white hover:bg-amber-500/20 border border-amber-500/40 bg-amber-500/10'
                    }`}
                  title={strat.title}
                >
                  {strat.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
