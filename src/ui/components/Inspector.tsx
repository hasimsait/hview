import React, { useState, useCallback, useEffect } from 'react';
import { FurnitureEntity, SurfaceFinishConfig } from '@core/types/plan';
import { useService } from '@ui/context/DIContext';
import { TOKENS } from '@core/di/tokens';
import { IPlanManagerService, IInteractionService, ISceneService, IAssetRegistryService } from '@core/types/services';
import {
  X,
  Move,
  RotateCw,
  Maximize2,
  Trash2,
  Replace,
  MapPin,
  Sparkles,
  ArrowUpDown,
  Layers,
  Lightbulb,
} from 'lucide-react';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';

interface InspectorProps {
  item: FurnitureEntity | null;
  onOpenReplaceModal: () => void;
  onClose: () => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  item,
  onOpenReplaceModal,
  onClose,
}) => {
  const planManager = useService<IPlanManagerService>(TOKENS.PlanManagerService);
  const interactionService = useService<IInteractionService>(TOKENS.InteractionService);
  const sceneService = useService<ISceneService>(TOKENS.SceneService);
  const assetRegistry = useService<IAssetRegistryService>(TOKENS.AssetRegistryService);

  const [showYGizmo, setShowYGizmo] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('all');
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // Keep activeSection and availableSections in sync when item changes
  useEffect(() => {
    if (!item) {
      setAvailableSections([]);
      return;
    }
    const currentSection = planManager.getSelectedFurnitureSection?.() || 'all';
    setActiveSection(currentSection);

    const sections = sceneService.getFurnitureSections(item.id);
    setAvailableSections(sections);
  }, [item?.id, item?.assetKey, planManager, sceneService]);

  // Listen to 3D mesh click section changes
  useEffect(() => {
    const unsub = planManager.onSelectionChange((_selected, section) => {
      if (section) {
        setActiveSection(section);
      }
    });
    return () => unsub();
  }, [planManager]);

  if (!item) return null;

  const isLightFixture = assetRegistry.hasCapability(item.assetKey || item.name, 'lighting');
  const isShelving =
    item.assetKey === 'open_shelving' ||
    item.assetKey === 'shelving' ||
    item.assetKey === 'shelf' ||
    item.assetKey === 'pencil_cabinet' ||
    item.name === 'open_shelving' ||
    item.name === 'shelving' ||
    item.name === 'shelf';

  const currentFinishForSection: SurfaceFinishConfig | undefined =
    activeSection === 'all'
      ? item.finish
      : item.sectionFinishes?.[activeSection] ||
        item.sectionFinishes?.[activeSection.toLowerCase()] ||
        item.finish;

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    if (activeSection === 'all') {
      planManager.setFurnitureFinish(item.id, finish);
    } else {
      planManager.setFurnitureSectionFinish(item.id, activeSection, finish);
    }
  };

  const handleClearFinish = () => {
    if (activeSection === 'all') {
      planManager.setFurnitureFinish(item.id, undefined);
    } else {
      planManager.setFurnitureSectionFinish(item.id, activeSection, undefined);
    }
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    planManager.updateFurniture(item.id, {
      position: {
        ...item.position,
        [axis]: value,
      },
    });
  };

  const handleRotationChange = (deg: number) => {
    const rad = Math.PI - (deg * Math.PI) / 180;
    planManager.updateFurniture(item.id, {
      rotationY: rad,
    });
  };

  const handleDimensionChange = (axis: 'x' | 'y' | 'z', valueCm: number) => {
    const valueM = Math.max(0.01, valueCm / 100);
    planManager.updateFurniture(item.id, {
      dimensions: {
        ...item.dimensions,
        [axis]: valueM,
      },
    });
  };

  const handleToggleYGizmo = useCallback(() => {
    const next = !showYGizmo;
    setShowYGizmo(next);
    interactionService.setGizmoShowY(next);
    // Ensure translate mode so Y handle appears immediately
    if (next) {
      interactionService.setGizmoMode('translate');
    }
  }, [showYGizmo, interactionService]);

  const handleDelete = () => {
    if (confirm(`Delete ${item.displayName}?`)) {
      planManager.deleteFurniture(item.id);
    }
  };

  const currentDeg = Math.round(((180 - (item.rotationY * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <div className="absolute right-4 top-4 w-80 max-h-[calc(100vh-5.5rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-4 text-xs z-30 animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {item.category}
            </span>
            {item.roomId && (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {item.roomId}
              </span>
            )}
          </div>
          <h2 className="font-semibold text-sm text-white truncate max-w-[200px]">
            {item.displayName}
          </h2>
          <div className="text-[10px] text-slate-400 font-mono">
            ID: {item.id}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transform Coordinates */}
      <div className="py-3 border-b border-slate-800 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              Position (meters)
            </label>
            {/* Height gizmo toggle */}
            <button
              onClick={handleToggleYGizmo}
              title={showYGizmo ? 'Hide height gizmo handle' : 'Show height (Y) drag handle on gizmo'}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                showYGizmo
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {showYGizmo ? 'Y-drag ON' : 'Y-drag'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase">X (Horiz.)</span>
              <input
                type="number"
                step="0.05"
                value={parseFloat(item.position.x.toFixed(3))}
                onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase text-emerald-500/80">Y (Elev.)</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={parseFloat(item.position.y.toFixed(3))}
                onChange={(e) => handlePositionChange('y', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-emerald-700/50 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase">Z (Depth)</span>
              <input
                type="number"
                step="0.05"
                value={parseFloat(item.position.z.toFixed(3))}
                onChange={(e) => handlePositionChange('z', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-slate-400 flex items-center gap-1.5 font-medium">
              <RotateCw className="w-3.5 h-3.5 text-sky-400" />
              Rotation
            </label>
            <span className="text-slate-300 font-mono">{currentDeg}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={currentDeg}
            onChange={(e) => handleRotationChange(parseInt(e.target.value))}
            className="w-full accent-sky-500 bg-slate-800 cursor-pointer"
          />
        </div>
      </div>

      {/* Dimensions — Editable */}
      <div className="py-3 border-b border-slate-800">
        <label className="text-slate-400 flex items-center gap-1.5 mb-1.5 font-medium">
          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
          Dimensions (cm)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Width (X)</span>
            <input
              type="number"
              step="1"
              min="1"
              max="1000"
              value={Math.round(item.dimensions.x * 100)}
              onChange={(e) => handleDimensionChange('x', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Height (Y)</span>
            <input
              type="number"
              step="1"
              min="1"
              max="1000"
              value={Math.round(item.dimensions.y * 100)}
              onChange={(e) => handleDimensionChange('y', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Depth (Z)</span>
            <input
              type="number"
              step="1"
              min="1"
              max="1000"
              value={Math.round(item.dimensions.z * 100)}
              onChange={(e) => handleDimensionChange('z', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">Editing rebuilds the 3D mesh at new size.</p>
      </div>

      {/* Shelving Front Lids / Cabinet Doors */}
      {isShelving && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Cabinet Lids / Doors
            </label>
            <button
              type="button"
              onClick={() => {
                const currentLids = !!item.hasLids;
                planManager.setFurnitureHasLids(item.id, !currentLids);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                item.hasLids
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.hasLids ? '🚪 Lids ON' : 'Open Shelving'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {item.hasLids
              ? 'Front lids added. You can select "Lids" in Target Section below to customize their finish.'
              : 'Add hinged front lids with handles to enclose this shelving unit.'}
          </p>
        </div>
      )}

      {/* Light Fixture Controls (when inspecting a chandelier, spotlight, or sconce) */}
      {isLightFixture && (
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Lightbulb className={`w-3.5 h-3.5 ${item.lightConfig?.enabled !== false ? 'text-amber-400' : 'text-slate-500'}`} />
              Fixture Lighting
            </label>
            <button
              type="button"
              onClick={() => {
                const currentEnabled = item.lightConfig?.enabled !== false;
                planManager.setFurnitureLightConfig(item.id, { enabled: !currentEnabled });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                item.lightConfig?.enabled !== false
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.lightConfig?.enabled !== false ? '💡 ON' : 'OFF'}
            </button>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">Brightness / Intensity</span>
              <span className="font-mono text-[11px] text-amber-400 font-semibold">
                {Math.round((item.lightConfig?.intensity ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={item.lightConfig?.intensity ?? 1.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                planManager.setFurnitureLightConfig(item.id, { intensity: val });
              }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Color Temperature & Warmth */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-medium text-slate-500">Color Warmth</div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '2700K', name: 'Warm', color: '#ffe4a0' },
                { label: '3000K', name: 'Soft', color: '#fff2dc' },
                { label: '4000K', name: 'Neutral', color: '#ffffff' },
                { label: '5500K', name: 'Cool', color: '#e2f0ff' },
              ].map((preset) => {
                const isSelected = (item.lightConfig?.color?.toLowerCase() || '#fff2dc') === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => planManager.setFurnitureLightConfig(item.id, { color: preset.color })}
                    className={`py-1 px-1 rounded text-center border transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-semibold shadow-sm'
                        : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[10px] leading-tight font-mono">{preset.label}</div>
                    <div className="text-[9px] text-slate-400">{preset.name}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-500">Custom:</span>
              <input
                type="color"
                value={item.lightConfig?.color || '#fff2dc'}
                onChange={(e) => planManager.setFurnitureLightConfig(item.id, { color: e.target.value })}
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-400">
                {item.lightConfig?.color || '#fff2dc'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Surface Finish / Cladding (Paint, Wood Paneling, Tiles, Glass) */}
      <div className="pt-3 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Surface Cladding &amp; Paint
          </label>
          {activeSection !== 'all' && (
            <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
              {activeSection}
            </span>
          )}
        </div>

        {/* Section Tabs / Buttons */}
        {availableSections.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase mb-1.5 flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3 text-sky-400" />
              Target Section
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('all');
                  planManager.setSelectedFurniture(item, 'all');
                }}
                className={`py-1 px-2.5 rounded text-[11px] font-medium border transition-colors ${
                  activeSection === 'all'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Parts
                {item.finish && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-sky-400" />
                )}
              </button>
              {availableSections.map((sec) => {
                const hasCustomFinish = !!(
                  item.sectionFinishes?.[sec] ||
                  item.sectionFinishes?.[sec.toLowerCase()]
                );
                const isActive = activeSection === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setActiveSection(sec);
                      planManager.setSelectedFurniture(item, sec);
                    }}
                    className={`py-1 px-2.5 rounded text-[11px] font-medium border transition-colors ${
                      isActive
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}
                    {hasCustomFinish && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <SurfaceFinishPicker
          key={`${item.id}_${activeSection}`}
          currentFinish={currentFinishForSection}
          onSelectFinish={handleApplyFinish}
          onClearFinish={handleClearFinish}
          defaultTab={
            currentFinishForSection?.type === 'metal' ||
            currentFinishForSection?.type === 'porcelain' ||
            activeSection.toLowerCase() === 'metal' ||
            activeSection.toLowerCase() === 'ceramic' ||
            activeSection.toLowerCase() === 'faucet' ||
            activeSection.toLowerCase() === 'handle' ||
            activeSection.toLowerCase() === 'holder' ||
            activeSection.toLowerCase() === 'cistern' ||
            activeSection.toLowerCase() === 'lid' ||
            activeSection.toLowerCase() === 'bowl' ||
            activeSection.toLowerCase() === 'seat' ||
            activeSection.toLowerCase() === 'basin' ||
            activeSection.toLowerCase() === 'flush button' ||
            activeSection.toLowerCase() === 'hooks' ||
            activeSection.toLowerCase() === 'hook' ||
            activeSection.toLowerCase() === 'rail' ||
            activeSection.toLowerCase() === 'bar' ||
            activeSection.toLowerCase() === 'mounts' ||
            activeSection.toLowerCase() === 'mount' ||
            activeSection.toLowerCase() === 'arms' ||
            activeSection.toLowerCase() === 'light bar' ||
            activeSection.toLowerCase() === 'bezel' ||
            activeSection.toLowerCase() === 'grille' ||
            activeSection.toLowerCase() === 'fan blades' ||
            activeSection.toLowerCase() === 'fan hub' ||
            activeSection.toLowerCase() === 'housing'
              ? 'metal'
              : currentFinishForSection?.type === 'fabric' ||
                activeSection.toLowerCase() === 'fabric' ||
                activeSection.toLowerCase() === 'cushion' ||
                activeSection.toLowerCase() === 'upholstery' ||
                activeSection.toLowerCase() === 'seat' ||
                activeSection.toLowerCase() === 'backrest' ||
                activeSection.toLowerCase() === 'duvet' ||
                activeSection.toLowerCase() === 'pillow' ||
                activeSection.toLowerCase() === 'headboard' ||
                item.category === 'seating' ||
                item.category === 'bed'
              ? 'fabric'
              : undefined
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-3 space-y-2">
        <button
          onClick={onOpenReplaceModal}
          className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Replace className="w-3.5 h-3.5" />
          Replace Asset
        </button>

        <button
          onClick={handleDelete}
          className="w-full py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Object
        </button>
      </div>
    </div>
  );
};

