import { SurfaceFinishConfig } from '@core/types/plan';
import { useRuntime,useSelection } from '@ui/context/RuntimeContext';
import {
ArrowUpDown,
Layers,
Lightbulb,
MapPin,
Maximize2,
Move,
Replace,
RotateCw,
Sparkles,
Trash2,
X,
} from 'lucide-react';
import React,{ useCallback,useState } from 'react';
import { ConfigureLuminaire,ConfigureShelving,FinishFurniture,RemoveElement,TransformFurniture,SetWindowCoveringOpen } from '../../application/commands/FurnitureCommands';
import { cabinetDoorCount } from '../../domain/catalog/Cabinets';
import { defaultCabinet } from '../../domain/cabinet/CabinetLayout';
import { CabinetPlinthControls } from './CabinetPlinthControls';
import { supportsCabinetPlinth } from '../../domain/cabinet/CabinetPlinth';
import { CabinetHingeControls } from './CabinetHingeControls';
import { ConfigureCabinet } from '../../application/commands/CabinetCommands';
import type { LightFixtureConfig, Vector3D } from '../../domain/model/PlanData';
import { Furniture,Shelving } from '../../domain/elements/Furniture';
import { InspectorPresenter } from '../inspection/InspectorPresenter';
import { SurfaceFinishPicker } from './SurfaceFinishPicker';
import { cabinetSurfaceFinish } from '../../domain/model/SurfaceSections';

export interface InteriorInspectorAdapter {
  transform: (position?: Vector3D, rotation?: number, dimensions?: Vector3D) => void;
  finish: (finish?: SurfaceFinishConfig, section?: string) => void;
  configureLight: (config: Partial<LightFixtureConfig>) => void;
  remove: () => void;
  sections: string[];
  section: string;
  selectSection: (section: string) => void;
  panel?: boolean;
}
interface InspectorProps {
  item: Furniture | null;
  onOpenReplaceModal: () => void;
  onClose: () => void;
  onEditLayout?: () => void;
  interior?: InteriorInspectorAdapter;
  className?: string;
}

export const Inspector: React.FC<InspectorProps> = ({
  item,
  onOpenReplaceModal,
  onClose, onEditLayout, interior, className,
}) => {
  const runtime = useRuntime();
  const editor = runtime.editor;
  const interactionService = runtime.interaction;
  const sceneService = runtime.scene;
  const selection = useSelection();

  const [showYGizmo, setShowYGizmo] = useState(false);
  const availableSections = interior?.sections ?? (item ? sceneService.getFurnitureSections(item.id) : []);
  const activeSection = interior?.section ?? (selection?.kind === 'furniture' && selection.id === item?.id ? selection.subtarget ?? 'all' : 'all');

  if (!item) return null;
  const presentation = item.accept(new InspectorPresenter());
  const isLightFixture = presentation.sections.includes('luminaire');
  const isShelving = presentation.sections.includes('shelving');
  const definition = runtime.catalog.get(item.assetKey);
  const isBookcase = ['hemnes_bookcase', 'billy_bookcase'].includes(definition?.recipe ?? '') || definition?.furnitureProduct?.kind === 'bookcase';
  const sectionLabel = (section: string) => isBookcase ? (['back', 'back_panel'].includes(section) ? 'Back panel' : section.replace(/_/g, ' ').replace(/^\w/, letter => letter.toUpperCase())) : section;
  const legacyDoors = item.hasLids && cabinetDoorCount(definition) === 0 ? (item.dimensions.x >= .7 ? 2 : 1) : cabinetDoorCount(definition);
  const resizable = definition?.capabilities?.resizable !== false;
  const dimensionStep = interior ? .1 : definition?.householdDetail || definition?.floorDrain || definition?.lightingComponent || definition?.architecturalFinish || definition?.softFurnishing ? .1 : 1;

  const currentFinishForSection: SurfaceFinishConfig | undefined =
    activeSection === 'all'
      ? item.finish
      : item.sectionFinishes?.[activeSection] ||
      item.sectionFinishes?.[activeSection.toLowerCase()] ||
      (item.cabinet ? cabinetSurfaceFinish(activeSection, item.sectionFinishes) : undefined) ||
      item.finish;

  const handleApplyFinish = (finish: SurfaceFinishConfig) => {
    if (interior) return interior.finish(finish, activeSection === 'all' ? undefined : activeSection);
    if (activeSection === 'all') {
      editor.execute(new FinishFurniture(item.id, finish));
    } else {
      editor.execute(new FinishFurniture(item.id, finish, activeSection));
    }
  };

  const handleClearFinish = () => {
    if (interior) return interior.finish(undefined, activeSection === 'all' ? undefined : activeSection);
    if (activeSection === 'all') {
      editor.execute(new FinishFurniture(item.id, undefined));
    } else {
      editor.execute(new FinishFurniture(item.id, undefined, activeSection));
    }
  };

  const configureLight = (config: Partial<LightFixtureConfig>) => {
    if (interior) interior.configureLight(config);
    else editor.execute(new ConfigureLuminaire(item.id, config));
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (interior) return interior.transform({ ...item.position, [axis]: value });
    editor.execute(new TransformFurniture(item.id, {
      ...item.position,
      [axis]: value,
    }, undefined, undefined));
  };

  const handleRotationChange = (deg: number) => {
    const rad = Math.PI - (deg * Math.PI) / 180;
    if (interior) return interior.transform(undefined, rad);
    editor.execute(new TransformFurniture(item.id, undefined, rad, undefined));
  };

  const handleDimensionChange = (axis: 'x' | 'y' | 'z', valueCm: number) => {
    const valueM = Math.max(dimensionStep / 100, valueCm / 100);
    if (interior) return interior.transform(undefined, undefined, { ...item.dimensions, [axis]: valueM });
    editor.execute(new TransformFurniture(item.id, undefined, undefined, {
      ...item.dimensions,
      [axis]: valueM,
    }));
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
    if (interior) return interior.remove();
    if (confirm(`Delete ${item.displayName}?`)) {
      editor.execute(new RemoveElement(item.id));
    }
  };

  const currentDeg = Math.round(((180 - (item.rotationY * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <div className={className ?? "absolute right-4 top-4 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-4 text-xs z-30 animate-in fade-in slide-in-from-right-2 duration-200"}>
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
          aria-label="Close inspector"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {definition?.householdDetail?.practical && <p className="pt-3 text-[10px] text-slate-400">Dimensions describe the occupied space, including connectors. Cable and hose dimensions describe the route footprint, not their total length.</p>}

      {!interior && (item.cabinet || cabinetDoorCount(definition) !== undefined) && <div className="py-3 space-y-2 border-b border-slate-800">
        <button className="w-full rounded bg-sky-600 p-2 font-semibold" onClick={onEditLayout}>Edit layout</button>
        {(supportsCabinetPlinth(item.assetKey) || item.cabinet?.plinth) && <CabinetPlinthControls layout={item.cabinet ?? defaultCabinet(item.toData(), legacyDoors ?? 2)} size={item.dimensions} onChange={layout => editor.execute(new ConfigureCabinet(item.id, layout, 'Configure cabinet plinth'))} />}
        <CabinetHingeControls showAngles layout={item.cabinet ?? defaultCabinet(item.toData(), legacyDoors ?? 2)} onChange={layout => editor.execute(new ConfigureCabinet(item.id, layout, 'Configure cabinet doors'))} />
        {item.cabinet?.internalDrawers?.map((drawer, i) => <label key={drawer.id} className="block text-xs text-slate-300">{drawer.name}: {Math.round(drawer.extension * 100)}%
          <input type="range" aria-label={`Internal drawer ${i + 1} extension`} min="0" max="100" value={Math.round(drawer.extension * 100)} className="w-full accent-sky-400" onChange={e => editor.execute(new ConfigureCabinet(item.id, { ...item.cabinet!, internalDrawers: item.cabinet!.internalDrawers!.map(d => d.id === drawer.id ? { ...d, extension: +e.target.value / 100 } : d) }, 'Extend internal drawer'))} />
        </label>)}
      </div>}
      {/* Transform Coordinates */}
      <div className="py-3 border-b border-slate-800 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              {interior ? 'Position from left / support / back (m)' : 'Position (meters)'}
            </label>
            {/* Height gizmo toggle */}
            <button
              onClick={handleToggleYGizmo}
              title={showYGizmo ? 'Hide height gizmo handle' : 'Show height (Y) drag handle on gizmo'}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${showYGizmo
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
                step={interior || definition?.householdDetail?.practical ? .001 : .05}
                value={parseFloat(item.position.x.toFixed(3))}
                onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase text-emerald-500/80">Y (Elev.)</span>
              <input
                type="number"
                step={interior || definition?.householdDetail?.practical ? .001 : .05}
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
                step={interior || definition?.householdDetail?.practical ? .001 : .05}
                value={parseFloat(item.position.z.toFixed(3))}
                onChange={(e) => handlePositionChange('z', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {!interior?.panel && <div>
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
        </div>}
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
              step={dimensionStep}
              min={dimensionStep}
              max="1000"
              disabled={!resizable}
              value={+(item.dimensions.x * 100).toFixed(2)}
              onChange={(e) => handleDimensionChange('x', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Height (Y)</span>
            <input
              type="number"
              step={dimensionStep}
              min={dimensionStep}
              max="1000"
              disabled={!resizable}
              value={+(item.dimensions.y * 100).toFixed(2)}
              onChange={(e) => handleDimensionChange('y', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Depth (Z)</span>
            <input
              type="number"
              step={dimensionStep}
              min={dimensionStep}
              max="1000"
              disabled={!resizable}
              value={+(item.dimensions.z * 100).toFixed(2)}
              onChange={(e) => handleDimensionChange('z', parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">{resizable ? 'Editing rebuilds the 3D mesh at new size.' : 'Fixed product dimensions.'}</p>
      </div>

      {/* Shelving Tiers & Front Lids / Cabinet Doors */}
      {isShelving && item instanceof Shelving && !item.cabinet && !interior && (
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Shelf Tiers ({Shelving.minShelves}–{Shelving.maxShelves})
            </label>
            <input
              type="number"
              aria-label="Shelf count"
              min={Shelving.minShelves}
              max={Shelving.maxShelves}
              step={1}
              value={item.shelfCount}
              onChange={(e) => {
                const nextCount = parseInt(e.target.value, 10);
                if (
                  Number.isInteger(nextCount) &&
                  nextCount >= Shelving.minShelves &&
                  nextCount <= Shelving.maxShelves
                ) {
                  editor.execute(new ConfigureShelving(item.id, !!item.hasLids, nextCount));
                }
              }}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-right text-slate-100 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Cabinet Lids / Doors
            </label>
            <button
              type="button"
              onClick={() => {
                const currentLids = !!item.hasLids;
                editor.execute(new ConfigureShelving(item.id, !currentLids, item.shelfCount));
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${item.hasLids
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

      {(definition?.softFurnishing?.kind === 'curtain' || definition?.softFurnishing?.kind === 'blind') && (
        <section aria-label="Window covering" className="pt-3 border-t border-slate-800 space-y-2">
          <label className="text-xs text-slate-300">{definition.softFurnishing.kind === 'blind' ? 'Raise blind' : 'Open curtains'}
            <input aria-label="Window covering opening" type="range" min="0" max="1" step="0.05" value={item.windowCoveringOpen ?? (definition.softFurnishing.kind === 'blind' ? .25 : .65)}
              onChange={event => editor.execute(new SetWindowCoveringOpen(item.id, +event.target.value))} className="mt-2 w-full accent-sky-500" />
          </label>
          <p className="text-[10px] text-slate-400">{Math.round((item.windowCoveringOpen ?? (definition.softFurnishing.kind === 'blind' ? .25 : .65)) * 100)}% open</p>
        </section>
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
                configureLight({ enabled: !currentEnabled });
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all ${item.lightConfig?.enabled !== false
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
              aria-label="Fixture brightness"
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={item.lightConfig?.intensity ?? 1.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                configureLight({ intensity: val });
              }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Color Temperature & Warmth */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-medium text-slate-500">White Light Temperature</div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '2700K', name: 'Warm', kelvin: 2700 },
                { label: '3000K', name: 'Soft', kelvin: 3000 },
                { label: '3500K', name: 'Warm white', kelvin: 3500 },
                { label: '4000K', name: 'Neutral', kelvin: 4000 },
                { label: '5500K', name: 'Daylight', kelvin: 5500 },
                { label: '6500K', name: 'Cool white', kelvin: 6500 },
              ].map((preset) => {
                const isSelected = item.lightConfig?.temperatureKelvin === preset.kelvin;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => configureLight({ temperatureKelvin: preset.kelvin })}
                    className={`py-1 px-1 rounded text-center border transition-all ${isSelected
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
                aria-label="Fixture color"
                type="color"
                value={item.lightConfig?.color || '#fff2dc'}
                onChange={(e) => configureLight({ color: e.target.value, temperatureKelvin: undefined })}
                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-400">
                {item.lightConfig?.color || '#fff2dc'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Approximate white-light color. Actual LED spectra vary.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
              Fixture output (lm)
              <input aria-label="Fixture output (lumens)" type="number" min="0" max="100000" step="1"
                placeholder="Asset default" value={item.lightConfig?.lumens ?? ''}
                onChange={event => {
                  const value = event.target.value === '' ? undefined : Number(event.target.value);
                  if (value === undefined || Number.isFinite(value) && value >= 0 && value <= 100000) configureLight({ lumens: value });
                }} className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </label>
            <button type="button" onClick={() => configureLight({ lumens: 806 })} className="text-[11px] text-sky-400 hover:text-sky-300">Use 806 lm</button>
            <p className="text-[10px] text-slate-500">Total output at 100% brightness. For several bulbs, enter their combined lumens. Clear to use the asset default.</p>
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
              {sectionLabel(activeSection)}
            </span>
          )}
        </div>

        {/* Section Tabs / Buttons */}
        {availableSections.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-500 uppercase mb-1.5 flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3 text-sky-400" />
              {isBookcase ? 'Bookcase finishes' : 'Target Section'}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  if (interior) interior.selectSection('all'); else editor.selection.select('furniture', item, 'all');
                }}
                className={`py-1 px-2.5 rounded text-[11px] font-medium border transition-colors ${activeSection === 'all'
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
                      if (interior) interior.selectSection(sec); else editor.selection.select('furniture', item, sec);
                    }}
                    className={`py-1 px-2.5 rounded text-[11px] font-medium border transition-colors ${isActive
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {sectionLabel(sec)}
                    {hasCustomFinish && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {isBookcase && <p className="mt-2 text-[11px] text-slate-400">Choose Back panel, Shelves or Frame to change its colour or material independently.</p>}
          </div>
        )}

        <SurfaceFinishPicker
          key={`${item.id}_${activeSection}`}
          currentFinish={currentFinishForSection}
          onSelectFinish={handleApplyFinish}
          onClearFinish={handleClearFinish}
          defaultTab={InspectorPresenter.defaultFinishTabFor(item, activeSection, currentFinishForSection)}
        />
      </div>

      {/* Action Buttons */}
      <div className="pt-3 space-y-2">
        {!interior?.panel && <button
          onClick={onOpenReplaceModal}
          className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Replace className="w-3.5 h-3.5" />
          Replace Asset
        </button>}

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

