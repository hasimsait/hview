import { SurfaceFinishConfig } from '@core/types/plan';
import { Check } from 'lucide-react';
import React from 'react';

interface WallRoomApplicatorProps {
  rooms: { id: string; name: string }[];
  currentFinish?: SurfaceFinishConfig;
  selectedRoom: string;
  onSelectRoom: (roomId: string) => void;
  onApplyToRoom: () => void;
}

export const WallRoomApplicator: React.FC<WallRoomApplicatorProps> = ({
  rooms,
  currentFinish,
  selectedRoom,
  onSelectRoom,
  onApplyToRoom,
}) => {
  if (rooms.length === 0 || !currentFinish) return null;

  return (
    <div className="pt-3 border-t border-slate-800 space-y-2">
      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
        <span>Apply Across Room</span>
        <span className="text-emerald-400 text-[9px] font-normal">Interior faces only</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={selectedRoom}
          onChange={(e) => onSelectRoom(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onApplyToRoom}
          className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
          title="Apply this finish to interior faces bordering the selected room"
        >
          <Check className="w-3.5 h-3.5" />
          Apply Room
        </button>
      </div>
      <p className="text-[10px] text-slate-500 italic">
        Tiles and paints only the side facing this room. Opposite sides in neighboring rooms remain untouched.
      </p>
    </div>
  );
};
