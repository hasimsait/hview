import React from 'react';
import { WallEntity, WallFrameStyle } from '@core/types/plan';
import { Layers, LayoutGrid } from 'lucide-react';

const FRAME_STYLES: { id: WallFrameStyle; name: string; desc: string }[] = [
  { id: 'none', name: 'None', desc: 'No frame profile' },
  { id: 'perimeter', name: 'Perimeter', desc: 'Outer aluminium frame' },
  { id: 'grid_3', name: '3-Pane', desc: 'Perimeter + 2 horizontal dividers' },
  { id: 'grid_4', name: '4-Pane', desc: 'Perimeter + 3 horizontal dividers' },
  { id: 'grid_2x3', name: '2x3 Grid', desc: 'Crittall 6-pane industrial grid' },
];

const FRAME_COLORS = [
  { id: 'black', name: 'Matte Black Aluminium', hex: '#18181b' },
  { id: 'chrome', name: 'Polished Chrome', hex: '#f1f5f9' },
  { id: 'brass', name: 'Brushed Brass', hex: '#d4b359' },
  { id: 'white', name: 'Matte White Powder Coat', hex: '#f8fafc' },
];

interface WallFrameControlsProps {
  wall: WallEntity;
  onFrameStyleChange: (style: WallFrameStyle) => void;
  onFrameColorChange: (hex: string) => void;
  onToggleGlassWall: () => void;
}

export const WallFrameControls: React.FC<WallFrameControlsProps> = ({
  wall,
  onFrameStyleChange,
  onFrameColorChange,
  onToggleGlassWall,
}) => {
  const currentFrameStyle: WallFrameStyle = wall.frameStyle || 'none';
  const currentFrameColor: string = wall.frameColor || '#18181b';
  const isGlassWall = wall.material === 'a_glass' || wall.material === 'glass';

  return (
    <div className="py-2.5 border-b border-slate-800 space-y-2.5">
      {/* Partition Type */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
          <Layers className="w-3 h-3 text-sky-400" />
          Wall Construction
        </span>
        <button
          type="button"
          onClick={onToggleGlassWall}
          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors flex items-center gap-1 ${
            isGlassWall
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Toggle between solid wall and glass divider"
        >
          <span>{isGlassWall ? 'Glass Partition / Shower Screen' : 'Solid Partition Wall'}</span>
        </button>
      </div>

      {/* Frame / Profile Section */}
      <div>
        <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <LayoutGrid className="w-3 h-3 text-sky-400" />
            Shower & Wall Frame Profile
          </span>
          <span className="text-[9px] text-slate-500 lowercase">
            aluminium / crittall grid
          </span>
        </div>

        {/* Style Selector */}
        <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 mb-1.5">
          {FRAME_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onFrameStyleChange(st.id)}
              className={`px-1 py-1 rounded text-[10px] font-medium transition-all text-center truncate ${
                currentFrameStyle === st.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={st.desc}
            >
              {st.name}
            </button>
          ))}
        </div>

        {/* Frame Color Palette */}
        {currentFrameStyle !== 'none' && (
          <div className="flex items-center justify-between bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-medium">Profile Color:</span>
            <div className="flex items-center gap-1.5">
              {FRAME_COLORS.map((col) => {
                const isSelected = currentFrameColor.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onFrameColorChange(col.hex)}
                    className={`w-5 h-5 rounded-full border transition-transform ${
                      isSelected
                        ? 'border-sky-400 scale-110 shadow-sm ring-1 ring-sky-400'
                        : 'border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.name}
                  />
                );
              })}
              <input
                type="color"
                value={currentFrameColor}
                onChange={(e) => onFrameColorChange(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                title="Custom frame color"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
