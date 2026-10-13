import React, { useState, useEffect } from 'react';
import { WallEntity, FurnitureEntity } from '@core/types/plan';
import { IPlanManagerService, ISceneService } from '@core/types/services';
import { LayoutGrid, Plus, Move, Trash2, Check } from 'lucide-react';
import { RECESS_PRESETS, CORNER_DEFAULT_FINISH } from './RecessPresetRegistry';

interface WallRecessSectionProps {
  wall: WallEntity;
  wallLength: number;
  wallRecesses: FurnitureEntity[];
  activeTarget: string;
  planManager: IPlanManagerService;
  sceneService: ISceneService;
  onSelectTarget: (target: string) => void;
}

export const WallRecessSection: React.FC<WallRecessSectionProps> = ({
  wall,
  wallLength,
  wallRecesses,
  activeTarget,
  planManager,
  sceneService,
  onSelectTarget,
}) => {
  const [showAdder, setShowAdder] = useState(false);
  const [widthCm, setWidthCm] = useState(120);
  const [heightCm, setHeightCm] = useState(170);
  const [elevationCm, setElevationCm] = useState(70);
  const [depthCm, setDepthCm] = useState(Math.round((wall.thickness || 0.12) * 100));
  const [distCm, setDistCm] = useState(25);
  const [selectedPreset, setSelectedPreset] = useState<string>('kale_sage');

  useEffect(() => {
    setDepthCm(Math.round((wall.thickness || 0.12) * 100));
    setShowAdder(false);
  }, [wall.id, wall.thickness]);

  const handleCreateRecess = () => {
    const preset = RECESS_PRESETS[selectedPreset] || RECESS_PRESETS.kale_sage;
    const backFinish = preset.resolveFinish(wall);

    const rec = planManager.addWallRecess(wall.id, {
      width: widthCm / 100,
      height: heightCm / 100,
      elevation: elevationCm / 100,
      depth: depthCm / 100,
      distanceAlongWall: (distCm + widthCm / 2) / 100,
    });

    if (rec) {
      planManager.setFurnitureSectionFinish(rec.id, 'recess_wall', backFinish);
      planManager.setFurnitureSectionFinish(rec.id, 'girinti_wall', backFinish);
      planManager.setFurnitureSectionFinish(rec.id, 'sides', CORNER_DEFAULT_FINISH);
      planManager.setFurnitureSectionFinish(rec.id, 'corners', CORNER_DEFAULT_FINISH);
      sceneService.focusOnObject?.(rec.id);
      setShowAdder(false);
      onSelectTarget('recess_wall');
    }
  };

  return (
    <div className="py-2.5 border-b border-slate-800 space-y-2">
      {/* Header & Toggle */}
      <div className="text-[10px] uppercase font-semibold text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-amber-300">
          <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
          Wall Recess / Niche
        </span>
        <div className="flex items-center gap-1.5">
          {wallRecesses.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {wallRecesses.length} Recess{wallRecesses.length > 1 ? 'es' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowAdder(!showAdder)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium transition-colors shadow-sm"
            title="Add a custom recess / niche to this wall"
          >
            <Plus className="w-3 h-3" />
            <span>{showAdder ? 'Close' : 'Add Recess'}</span>
          </button>
        </div>
      </div>

      {/* Recess Adder Form */}
      {showAdder && (
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-2.5">
          <div className="text-[11px] font-semibold text-amber-200 flex items-center justify-between border-b border-amber-500/20 pb-1">
            <span>New Wall Recess Dimensions</span>
            <span className="text-[9px] text-amber-400/80">Shower / Wall Niche</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <label className="block text-slate-400 mb-0.5">Width (cm)</label>
              <input
                type="number"
                min="20"
                max="300"
                value={widthCm}
                onChange={(e) => setWidthCm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-400 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-0.5">Height (cm)</label>
              <input
                type="number"
                min="20"
                max="300"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-400 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-0.5">From Floor (cm)</label>
              <input
                type="number"
                min="0"
                max="250"
                value={elevationCm}
                onChange={(e) => setElevationCm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-400 font-mono text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-0.5">Depth (cm)</label>
              <input
                type="number"
                min="5"
                max="50"
                value={depthCm}
                onChange={(e) => setDepthCm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-400 font-mono text-[11px]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-slate-400 mb-0.5">Distance from Wall Start (cm)</label>
              <input
                type="number"
                min="5"
                max={Math.max(50, Math.round(wallLength * 100 - widthCm))}
                value={distCm}
                onChange={(e) => setDistCm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none focus:border-amber-400 font-mono text-[11px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 text-[10px]">Initial Backing Tile Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.values(RECESS_PRESETS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreset(p.id)}
                  className={`px-2 py-1 rounded text-[10px] text-left border transition-all ${
                    selectedPreset === p.id
                      ? 'bg-amber-600/40 border-amber-400 text-amber-200 font-medium'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="truncate font-semibold">{p.title}</div>
                  <div className="text-[8px] text-slate-500">{p.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdder(false)}
              className="flex-1 py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateRecess}
              className="flex-1 py-1 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[10px] shadow transition-colors flex items-center justify-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>Create Recess</span>
            </button>
          </div>
        </div>
      )}

      {/* Existing Recesses List */}
      {wallRecesses.length > 0 && (
        <div className="space-y-1.5">
          {wallRecesses.map((rec, idx) => (
            <div
              key={rec.id}
              className="bg-slate-950 p-2 rounded-lg border border-slate-800 space-y-1.5 hover:border-amber-500/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Recess #{idx + 1} ({(rec.dimensions.x * 100).toFixed(0)}×{(rec.dimensions.y * 100).toFixed(0)}×{(rec.dimensions.z * 100).toFixed(0)} cm)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      planManager.setSelectedFurniture(rec);
                      sceneService.focusOnObject?.(rec.id);
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white text-[10px] transition-colors flex items-center gap-1"
                    title="Select and position with 3D gizmo"
                  >
                    <Move className="w-2.5 h-2.5" />
                    <span>Gizmo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => planManager.deleteFurniture(rec.id)}
                    className="p-1 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Remove recess"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectTarget('recess_wall')}
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${
                    activeTarget === 'recess_wall'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  Tile Recess Wall
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTarget('corners')}
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${
                    activeTarget === 'corners' || activeTarget === 'sides'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-900 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  Tile Recess Sides
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
