import { PlanSaveStatus,ViewMode,ViewportSettings } from '@core/types/services';
import { useDocument,useRuntime } from '@ui/context/RuntimeContext';
import {
Box,
Check,
Download,
Edit3,
Eye,
FolderOpen,
Grid,
Home,
Layers,
Lightbulb,
Loader2,
Moon,
Plus,
RotateCcw,
Save,
Sliders,
Sparkles,
Sun,
Tablet,
Zap,
} from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import { RenameRoom } from '../../application/commands/StructuralCommands';
import { isOpaquePlanSource } from '../../services/plan/PlanRequest';

interface HeaderProps {
  isViewportFullscreen: boolean;
  onToggleViewportFullscreen: () => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  wallCutaway: boolean;
  onWallCutawayToggle: () => void;
  foregroundMode: 'transparent' | 'clip' | 'off';
  onForegroundModeChange: (mode: 'transparent' | 'clip' | 'off') => void;
  isolatedRoomIds: string[];
  onIsolateRooms: (roomIds: string[]) => void;
  showFixtures: boolean;
  onShowFixturesToggle: () => void;
  globalLighting: boolean;
  globalLightIntensity: number;
  spotLightIntensity: number;
  chandelierIntensity: number;
  onUpdateLighting: (settings: Partial<ViewportSettings>) => void;
  onOpenAddAssetModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isViewportFullscreen,
  onToggleViewportFullscreen,
  onSave,
  isSaving,
  viewMode,
  onViewModeChange,
  wallCutaway,
  onWallCutawayToggle,
  foregroundMode,
  onForegroundModeChange,
  isolatedRoomIds,
  onIsolateRooms,
  showFixtures,
  onShowFixturesToggle,
  globalLighting,
  globalLightIntensity,
  spotLightIntensity,
  chandelierIntensity,
  onUpdateLighting,
  onOpenAddAssetModal,
}) => {
  const runtime = useRuntime();
  const editor = runtime.editor;
  const sceneService = runtime.scene;
  const standaloneExportService = runtime.exports;
  const downloadOnly = isOpaquePlanSource();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roomPopoverRef = useRef<HTMLDivElement>(null);
  const lightingPopoverRef = useRef<HTMLDivElement>(null);

  const plan = useDocument();
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [lightingPopoverOpen, setLightingPopoverOpen] = useState(false);
  const [showCeilings, setShowCeilings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PlanSaveStatus>(runtime.storage.getSaveStatus() || 'idle');
  const [isExportingViewer, setIsExportingViewer] = useState(false);

  const handleToggleCeilings = () => {
    const next = sceneService.toggleCeilings();
    setShowCeilings(next);
  };

  useEffect(() => {
    const unsubSave = runtime.storage.onSaveStatusChange(setSaveStatus);
    return () => unsubSave?.();
  }, [editor]);



  // Close popovers when clicking outside
  useEffect(() => {
    if (!roomPopoverOpen && !lightingPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (roomPopoverOpen && roomPopoverRef.current && !roomPopoverRef.current.contains(e.target as Node)) {
        setRoomPopoverOpen(false);
      }
      if (lightingPopoverOpen && lightingPopoverRef.current && !lightingPopoverRef.current.contains(e.target as Node)) {
        setLightingPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roomPopoverOpen, lightingPopoverOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        runtime.documents.load(parsed);
      } catch (err) {
        alert('Could not open this plan. Use a valid HView or RemPlanner JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPlan = () => runtime.exports.exportPlan();

  const handleExportStandaloneViewer = async () => {
    try {
      setIsExportingViewer(true);
      await standaloneExportService.exportStandaloneViewer();
    } catch (err) {
      console.error('Failed to export iPad viewer:', err);
    } finally {
      setIsExportingViewer(false);
    }
  };

  const [isExportingEditor, setIsExportingEditor] = useState(false);

  const handleExportStandaloneEditor = async () => {
    try {
      setIsExportingEditor(true);
      await standaloneExportService.exportStandaloneEditor();
    } catch (err) {
      console.error('Failed to export full editor:', err);
    } finally {
      setIsExportingEditor(false);
    }
  };

  const handleResetCamera = () => {
    sceneService.resetCamera();
  };

  const toggleRoom = (roomId: string) => {
    if (isolatedRoomIds.includes(roomId)) {
      onIsolateRooms(isolatedRoomIds.filter((id) => id !== roomId));
    } else {
      onIsolateRooms([...isolatedRoomIds, roomId]);
    }
  };

  const visibleRooms = plan?.rooms.filter((r) => r.area >= 0.5) ?? [];
  const hasUnsavedChanges = editor.isDirty;
  const isIso = isolatedRoomIds.length > 0;
  const singleIsoRoom = isolatedRoomIds.length === 1
    ? plan?.rooms.find((r) => r.id === isolatedRoomIds[0])
    : null;

  const roomBtnLabel = !isIso
    ? '🏠 All Rooms'
    : isolatedRoomIds.length === 1
      ? `🏠 ${singleIsoRoom?.name ?? '1 Room'}`
      : `🏠 ${isolatedRoomIds.length} Rooms`;

  return (
    <header className={`app-header ${isViewportFullscreen ? 'app-header--fullscreen' : ''} min-h-14 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 z-20 select-none`}>
      {/* Brand & Stats */}
      <div className="app-header-brand flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRoomPopoverOpen(false);
              setLightingPopoverOpen(false);
              onToggleViewportFullscreen();
            }}
            aria-label={isViewportFullscreen ? 'Exit fullscreen and show topbar' : 'Enter fullscreen and hide topbar'}
            aria-expanded={!isViewportFullscreen}
            title={isViewportFullscreen ? 'Show topbar' : 'Fullscreen viewport'}
            className="w-11 h-11 shrink-0 rounded-lg bg-slate-900/95 border border-sky-400/30 flex items-center justify-center text-sky-400 hover:bg-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <Box className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="app-header-title">
            <h1 className="font-semibold text-sm tracking-wide text-white flex items-center gap-2">
              HView
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/50">
                3D Planner
              </span>
            </h1>
          </div>
        </div>

        {plan && (
          <div className="app-header-stats hidden md:flex items-center gap-2 text-xs text-slate-400 pl-4 border-l border-slate-800">
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300">
              {plan.walls.length} Walls{plan.columns.length > 0 && ` · ${plan.columns.length} Columns`}
            </span>
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300">
              {plan.rooms.length} Rooms
            </span>
            <span className="bg-slate-800/80 px-2 py-0.5 rounded text-slate-300">
              {plan.furniture.length} Objects
            </span>
          </div>
        )}
      </div>

      {/* Center Controls: View Mode & Cutaway */}
      <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
        <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
          <button
            onClick={() => onViewModeChange('perspective')}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${viewMode === 'perspective'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
            title="3D Perspective Orbit View"
          >
            <Box className="w-3.5 h-3.5" />
            3D Orbit
          </button>
          <button
            onClick={() => onViewModeChange('topDown')}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${viewMode === 'topDown'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
            title="2D Top-Down Floorplan with Crisp Cel-Shading"
          >
            <Layers className="w-3.5 h-3.5" />
            2D Plan
            <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950 text-sky-300 font-mono">
              CEL
            </span>
          </button>
        </div>

        {/* Room Multi-Select Popover */}
        {plan && visibleRooms.length > 0 && (
          <div className="relative" ref={roomPopoverRef}>
            <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => setRoomPopoverOpen((v) => !v)}
                className={`flex items-center gap-1.5 font-medium transition-colors ${isIso ? 'text-sky-300' : 'text-slate-200 hover:text-white'
                  }`}
                title="Select rooms to isolate — multi-select supported"
              >
                <Home className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                {roomBtnLabel}
                {isIso && (
                  <span className="bg-sky-500/20 border border-sky-400/40 text-sky-300 px-1 rounded text-[10px]">
                    {isolatedRoomIds.length}
                  </span>
                )}
              </button>
              {/* Rename button when exactly 1 room selected */}
              {singleIsoRoom && (
                <button
                  onClick={() => {
                    const newName = prompt('Rename this room:', singleIsoRoom.name);
                    if (newName && newName.trim()) {
                      editor.execute(new RenameRoom(singleIsoRoom.id, newName.trim()));
                    }
                  }}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors ml-0.5"
                  title="Rename this room"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              )}
              {/* Clear button when any rooms selected */}
              {isIso && (
                <button
                  onClick={() => onIsolateRooms([])}
                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
                  title="Show all rooms"
                >
                  ×
                </button>
              )}
            </div>

            {/* Popover Panel */}
            {roomPopoverOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 p-2 min-w-[220px] max-h-80 overflow-y-auto">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 px-2 pb-1.5 font-semibold">
                  Show Rooms
                </div>
                {/* All Rooms row */}
                <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!isIso}
                    onChange={() => onIsolateRooms([])}
                    className="w-3.5 h-3.5 rounded accent-sky-400"
                  />
                  <span className={`text-xs font-semibold ${!isIso ? 'text-sky-300' : 'text-slate-300'}`}>
                    🏠 All Rooms (Full House)
                  </span>
                </label>
                <div className="h-px bg-slate-800 my-1" />
                {/* Individual room rows */}
                {visibleRooms.map((room) => {
                  const checked = isolatedRoomIds.includes(room.id);
                  return (
                    <label
                      key={room.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRoom(room.id)}
                        className="w-3.5 h-3.5 rounded accent-sky-400"
                      />
                      <span className={`text-xs flex-1 ${checked ? 'text-sky-300 font-medium' : 'text-slate-300'}`}>
                        {room.name}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {room.area.toFixed(1)}m²
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add Asset Button (in place of doors dropdown) */}
        {plan && (
          <button
            type="button"
            onClick={onOpenAddAssetModal}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm border border-sky-400/40 transition-all active:scale-95 whitespace-nowrap"
            title="Add an asset / accessory to the wall in camera view"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Asset</span>
          </button>
        )}

        <button
          onClick={onWallCutawayToggle}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${wallCutaway
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm'
            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          title="Cutaway wall height so interior rooms are easily visible"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Wall Cutaway: {wallCutaway ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => {
            const next =
              foregroundMode === 'transparent'
                ? 'clip'
                : foregroundMode === 'clip'
                  ? 'off'
                  : 'transparent';
            onForegroundModeChange(next);
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${foregroundMode === 'transparent'
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm'
            : foregroundMode === 'clip'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          title="Dynamic Orbit Occlusion: Automatically applies transparency or section clipping to objects closer to the camera than orbit center"
        >
          <Eye className="w-3.5 h-3.5" />
          Foreground:{' '}
          {foregroundMode === 'transparent'
            ? 'Fade (Orbit)'
            : foregroundMode === 'clip'
              ? 'Section Clip'
              : 'Solid'}
        </button>

        <button
          onClick={onShowFixturesToggle}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${showFixtures
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle display of small electrical sockets and wall fixtures"
        >
          <Zap className="w-3.5 h-3.5" />
          Sockets
        </button>

        <button
          onClick={handleToggleCeilings}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${showCeilings
            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm'
            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          title="Toggle suspended ceilings (Asma Tavan) - OFF by default for unobstructed top-down planning"
        >
          <Grid className="w-3.5 h-3.5" />
          Ceilings: {showCeilings ? 'ON' : 'OFF'}
        </button>

        {/* Lighting Master Controls Dropdown */}
        <div className="relative" ref={lightingPopoverRef}>
          <button
            onClick={() => setLightingPopoverOpen(!lightingPopoverOpen)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${globalLighting
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
              : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-sm'
              }`}
            title="Lighting Controls: Toggle daylight/night mode and adjust spot & chandelier intensities"
          >
            {globalLighting ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            )}
            Lighting: {globalLighting ? 'Daylight' : 'Night'}
          </button>

          {lightingPopoverOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl shadow-black/70 p-3 min-w-[280px] space-y-3 text-slate-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  Lighting Master
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${globalLighting ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'
                  }`}>
                  {globalLighting ? '☀️ DAY MODE' : '🌙 NIGHT MODE'}
                </span>
              </div>

              {/* Master Global Sunlight Toggle */}
              <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                <div className="flex items-center gap-2">
                  {globalLighting ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-400" />
                  )}
                  <div>
                    <div className="text-xs font-medium">Global Sunlight & Sky</div>
                    <div className="text-[10px] text-slate-400">
                      {globalLighting ? 'Direct sun & ambient fill' : 'Off (Interior mood lighting)'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateLighting({ globalLighting: !globalLighting })}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border ${globalLighting
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:text-white'
                    }`}
                >
                  {globalLighting ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Global Sun/Sky Strength (when active) */}
              {globalLighting && (
                <div className="space-y-1 px-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">Sun & Sky Strength</span>
                    <span className="font-mono text-amber-400 font-semibold text-[11px]">
                      {Math.round(globalLightIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={globalLightIntensity}
                    onChange={(e) => onUpdateLighting({ globalLightIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>
              )}

              {/* Chandelier Strength Slider */}
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 text-[11px] font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Chandeliers Strength
                  </span>
                  <span className="font-mono text-sky-400 font-semibold text-[11px]">
                    {Math.round(chandelierIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.05"
                  value={chandelierIntensity}
                  onChange={(e) => onUpdateLighting({ chandelierIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              {/* Spotlight Strength Slider */}
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 text-[11px] font-medium flex items-center gap-1">
                    <Lightbulb className="w-3 h-3 text-amber-400" />
                    Spotlights Strength
                  </span>
                  <span className="font-mono text-sky-400 font-semibold text-[11px]">
                    {Math.round(spotLightIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.05"
                  value={spotLightIntensity}
                  onChange={(e) => onUpdateLighting({ spotLightIntensity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              {/* Quick Presets */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-[10px] uppercase font-semibold text-slate-500">Quick Presets</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLighting({
                        globalLighting: true,
                        globalLightIntensity: 1.0,
                        chandelierIntensity: 0.8,
                        spotLightIntensity: 0.6,
                      })
                    }
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-center transition-all group"
                  >
                    <div className="text-xs group-hover:scale-110 transition-transform">☀️</div>
                    <div className="text-[10px] font-medium text-slate-300 mt-0.5">Daylight</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLighting({
                        globalLighting: false,
                        globalLightIntensity: 0.0,
                        chandelierIntensity: 1.5,
                        spotLightIntensity: 1.4,
                      })
                    }
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-center transition-all group"
                  >
                    <div className="text-xs group-hover:scale-110 transition-transform">🌙</div>
                    <div className="text-[10px] font-medium text-slate-300 mt-0.5">Night</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLighting({
                        globalLighting: true,
                        globalLightIntensity: 0.35,
                        chandelierIntensity: 1.2,
                        spotLightIntensity: 1.0,
                      })
                    }
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-center transition-all group"
                  >
                    <div className="text-xs group-hover:scale-110 transition-transform">🌆</div>
                    <div className="text-[10px] font-medium text-slate-300 mt-0.5">Evening</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleResetCamera}
          className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset camera focus"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Controls: Save, Open & Export */}
      <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
        <input
          ref={fileInputRef}
          type="file"
          accept=".plan,application/json"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Live Persistence Status & Manual Save */}
        <button aria-label="Undo" disabled={isSaving || !editor.history.canUndo} onClick={() => editor.undo()} className="px-2 py-1.5 text-xs text-slate-300 disabled:opacity-40">Undo</button>
        <button aria-label="Redo" disabled={isSaving || !editor.history.canRedo} onClick={() => editor.redo()} className="px-2 py-1.5 text-xs text-slate-300 disabled:opacity-40">Redo</button>
        <button
          onClick={onSave}
          disabled={isSaving || !plan}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${saveStatus === 'saving'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : saveStatus === 'saved' && !hasUnsavedChanges
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : saveStatus === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-white'
            }`}
          title={downloadOnly ? 'Download a self-contained HTML copy with your current edits.' : 'Save this plan. Changes are saved only when you click Save.'}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Saving...</span>
            </>
          ) : saveStatus === 'saved' && !hasUnsavedChanges ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-slate-400" />
              <span>{downloadOnly ? 'Save HTML' : saveStatus === 'error' ? 'Save failed · Retry' : 'Save .plan'}</span>
            </>
          )}
        </button>
        {hasUnsavedChanges && !isSaving && !downloadOnly && <span className="text-xs text-amber-300">Unsaved changes</span>}

        {/* Reset to pristine template */}
        <button
          onClick={async () => {
            if (window.confirm('Reset this plan to its original version? All custom modifications will be reverted.')) {
              await runtime.documents.reset();
            }
          }}
          className="p-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition-colors"
          title="Reset plan to its original version"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700/80 text-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          Open .plan
        </button>

        <button
          onClick={handleExportPlan}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export .plan
        </button>

        <button onClick={() => runtime.exports.exportPlan('remplanner')} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300">RemPlanner .plan</button>

        <button
          onClick={handleExportStandaloneViewer}
          disabled={isExportingViewer}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          title="Export standalone 3D HTML viewer for iPad or mobile presentation to craftsmen"
        >
          {isExportingViewer ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Tablet className="w-3.5 h-3.5" />
          )}
          iPad Viewer (.html)
        </button>

        <button
          onClick={handleExportStandaloneEditor}
          disabled={isExportingEditor}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          title="Export complete 3D editor into a single offline HTML file with live texture and material swapping"
        >
          {isExportingEditor ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Layers className="w-3.5 h-3.5" />
          )}
          Full Editor (.html)
        </button>
      </div>
    </header>
  );
};
