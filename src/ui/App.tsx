import { AssetDefinition,PlanSaveStatus,ViewMode,ViewportSettings } from '@core/types/services';
import { AssetReplacementModal } from '@ui/components/AssetReplacementModal';
import { DoorInspector } from '@ui/components/DoorInspector';
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import { FloorInspector } from '@ui/components/FloorInspector';
import { Header } from '@ui/components/Header';
import { Inspector } from '@ui/components/Inspector';
import { SavingOverlay } from '@ui/components/SavingOverlay';
import { Viewport3D } from '@ui/components/Viewport3D';
import { WallInspector } from '@ui/components/WallInspector';
import { useDocument,useRuntime,useSelection } from '@ui/context/RuntimeContext';
import React,{ useEffect,useRef,useState } from 'react';
import { AddFurniture } from '../application/commands/FurnitureCommands';
import { Column } from '../domain/elements/Column';
import { Furniture } from '../domain/elements/Furniture';
import { Opening,WindowOpening } from '../domain/elements/Opening';
import { Room } from '../domain/elements/Room';
import { Wall } from '../domain/elements/Wall';
import type { FurnitureCategory } from '../domain/model/PlanData';
import { isPointInPolygon } from '../domain/model/WallTopology';
import { roomCeilingHeight } from '../domain/model/Ceiling';
import { isOpaquePlanSource } from '../services/plan/PlanRequest';
import { createElementId } from '../platform/ElementId';
import { CabinetEditor } from './components/CabinetEditor';
import { ColumnInspector } from './components/ColumnInspector';
import { WindowInspector } from './components/WindowInspector';
import { useViewportFullscreen } from '@ui/hooks/useViewportFullscreen';

export const App: React.FC = () => {
  const { isViewportFullscreen, toggleViewportFullscreen } = useViewportFullscreen();
  const runtime = useRuntime();
  const editor = runtime.editor;
  const sceneService = runtime.scene;

  const document = useDocument();
  const selection = useSelection();
  const selected = selection && document ? document.get(selection.id) : null;
  const selectedItem = selected instanceof Furniture ? selected : null;
  const selectedWall = selected instanceof Wall ? selected : null;
  const selectedRoom = selected instanceof Room ? selected : null;
  const selectedOpening = selected instanceof Opening && document ? { opening: selected, wall: document.requireWall(selected.wallId) } : null;
  const [editingCabinet, setEditingCabinet] = useState<Furniture | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('perspective');
  const [wallCutaway, setWallCutaway] = useState<boolean>(false);
  const [foregroundMode, setForegroundMode] = useState<'transparent' | 'clip' | 'off'>('transparent');
  const [isolatedRoomIds, setIsolatedRoomIds] = useState<string[]>([]);
  const [showFixtures, setShowFixtures] = useState<boolean>(false);
  const [globalLighting, setGlobalLighting] = useState<boolean>(true);
  const [globalLightIntensity, setGlobalLightIntensity] = useState<number>(1.0);
  const [spotLightIntensity, setSpotLightIntensity] = useState<number>(1.0);
  const [chandelierIntensity, setChandelierIntensity] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const downloadOnly = isOpaquePlanSource();
  const [saveRequested, setSaveRequested] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PlanSaveStatus>(runtime.storage.getSaveStatus());
  const saveInProgress = useRef(false);
  const isSaving = saveRequested || saveStatus === 'saving';

  useEffect(() => {
    if (!document) return;
    const validIds = isolatedRoomIds.filter(id => document.get(id) instanceof Room);
    if (validIds.length !== isolatedRoomIds.length) {
      setIsolatedRoomIds(validIds);
      sceneService.isolateRooms(validIds);
    }
  }, [document, isolatedRoomIds, sceneService]);

  useEffect(() => runtime.storage.onSaveStatusChange(setSaveStatus), [editor]);

  const handleSave = async () => {
    if (saveInProgress.current || isSaving) return;
    saveInProgress.current = true;
    setSaveRequested(true);
    setSaveError(false);
    try {
      // Paint the lock before serialization or synchronous offline storage.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (downloadOnly) await runtime.exports.exportStandaloneEditor();
      else await runtime.documents.save();
    } catch (error) {
      console.error('Could not prepare saved copy', error);
      setSaveError(true);
    } finally {
      saveInProgress.current = false;
      setSaveRequested(false);
    }
  };

  // Global keyboard shortcuts for Undo, Redo, and Save
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSaving || editingCabinet) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        if (window.document.activeElement instanceof HTMLElement) {
          window.document.activeElement.blur();
        }
        void handleSave();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (key === 'z' && !event.shiftKey) {
        if (editor.history.canUndo) {
          event.preventDefault();
          editor.undo();
        }
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (editor.history.canRedo) {
          event.preventDefault();
          editor.redo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, isSaving, editingCabinet]);

  // Load plan automatically on initial launch
  useEffect(() => {
    async function loadInitialPlan() {
      try {
        // Show the loading UI before decoding and constructing the scene.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await runtime.documents.restore();
      } catch (err) {
        console.error('Failed to load initial plan:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadInitialPlan();

  }, [editor]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    sceneService.setViewMode(mode);
  };

  const handleWallCutawayToggle = () => {
    const nextVal = !wallCutaway;
    setWallCutaway(nextVal);
    sceneService.updateSettings({ wallCutaway: nextVal });
  };

  const handleForegroundModeChange = (mode: 'transparent' | 'clip' | 'off') => {
    setForegroundMode(mode);
    sceneService.updateSettings({ foregroundOcclusionMode: mode });
  };

  const handleIsolateRooms = (roomIds: string[]) => {
    setIsolatedRoomIds(roomIds);
    sceneService.isolateRooms(roomIds);
  };

  const handleShowFixturesToggle = () => {
    const nextVal = !showFixtures;
    setShowFixtures(nextVal);
    sceneService.updateSettings({ showFixtures: nextVal });
  };

  // Selecting a newly added or replaced electrical fitting makes its bucket visible.
  // The manual Sockets toggle still works while the same fitting remains selected.
  useEffect(() => {
    if (selectedItem?.category === 'fixture') {
      setShowFixtures(true);
      sceneService.updateSettings({ showFixtures: true });
    }
  }, [selectedItem?.id, selectedItem?.assetKey, selectedItem?.category, sceneService]);

  const handleUpdateLighting = (settings: Partial<ViewportSettings>) => {
    if (settings.globalLighting !== undefined) setGlobalLighting(settings.globalLighting);
    if (settings.globalLightIntensity !== undefined) setGlobalLightIntensity(settings.globalLightIntensity);
    if (settings.spotLightIntensity !== undefined) setSpotLightIntensity(settings.spotLightIntensity);
    if (settings.chandelierIntensity !== undefined) setChandelierIntensity(settings.chandelierIntensity);
    sceneService.updateSettings(settings);
  };

  const handleAddAsset = (asset: AssetDefinition) => {
    const dims = { ...(asset.defaultDimensions || { x: 0.6, y: 0.6, z: 0.6 }) };
    const mount = asset.placement?.mount ?? (asset.category === 'decor' ? 'wall' : 'floor');
    const wallHit = sceneService.getWallInCameraView();

    if (!wallHit && mount === 'wall') {
      console.warn('No wall in camera view to place wall-mounted asset');
      return;
    }

    const planSnapshot = editor.getSnapshot();
    const planTotalH = planSnapshot?.totalHeight || 2.7;
    const target = sceneService.getControls()?.target;
    const placementPoint = wallHit ? { x: wallHit.point.x + wallHit.normal.x * .15, y: wallHit.point.z + wallHit.normal.z * .15 } : { x: target?.x ?? 0, y: target?.z ?? 0 };
    const placementRoom = planSnapshot?.rooms.find(r => isPointInPolygon(placementPoint, r.polygon)) ?? planSnapshot?.rooms.find(r => r.id === (wallHit?.wall.roomSideA ?? wallHit?.wall.roomSideB ?? wallHit?.wall.roomIds?.[0]));
    const finishedCeiling = placementRoom ? roomCeilingHeight(placementRoom, planTotalH) : planTotalH;
    if (asset.softFurnishing?.kind === 'curtain') dims.y = Math.max(.1, finishedCeiling - .025);
    const ceilingOffset = asset.softFurnishing?.kind === 'curtain' ? dims.y : asset.placement?.ceilingOffset ?? dims.y + .05;
    let position: { x: number; y: number; z: number };
    let rotationY = 0;
    let roomId: string | undefined;
    const viewDirection = wallHit?.normal;

    if (wallHit) {
      const { wall, point, normal } = wallHit;
      let elevation = point.y;
      let offsetDist = asset.placement?.wallOffset ?? 0.01;

      if (mount === 'ceiling') {
        elevation = Math.max(0, finishedCeiling - ceilingOffset);
        offsetDist = asset.placement?.wallOffset ?? Math.max(0.15, dims.z / 2);
      } else if (mount === 'surface') {
        elevation = asset.placement?.defaultElevation ?? 0.9;
        offsetDist = asset.placement?.wallOffset ?? dims.z / 2 + 0.04;
      } else if (mount === 'floor') {
        elevation = 0.0;
        offsetDist = dims.z / 2 + 0.04;
      } else if (asset.placement?.elevationRange) {
        const [minEl, maxEl] = asset.placement.elevationRange;
        elevation =
          elevation >= minEl && elevation <= maxEl
            ? elevation
            : (asset.placement.defaultElevation ?? 1.30);
      } else if (asset.placement?.defaultElevation !== undefined) {
        elevation = asset.placement.defaultElevation;
      } else {
        elevation = Math.max(0.3, Math.min(elevation, 2.2));
      }

      position = {
        x: point.x + normal.x * offsetDist,
        y: elevation,
        z: point.z + normal.z * offsetDist,
      };
      rotationY = Math.atan2(normal.x, normal.z);
      roomId = placementRoom?.id ?? wall.roomSideA ?? wall.roomSideB ?? wall.roomIds?.[0];
    } else {
      const target = sceneService.getControls()?.target;
      const x = target?.x ?? 0;
      const z = target?.z ?? 0;
      const elevation =
        mount === 'ceiling'
          ? Math.max(0, finishedCeiling - ceilingOffset)
          : mount === 'surface' ? (asset.placement?.defaultElevation ?? 0.9) : 0.0;
      position = { x, y: elevation, z };
      roomId = planSnapshot?.rooms.find((r) => isPointInPolygon({ x, y: z }, r.polygon))?.id;
    }

    const id = createElementId();
    editor.execute(new AddFurniture({
      id,
      name: asset.key,
      displayName: asset.name,
      category: asset.category as FurnitureCategory,
      position,
      rotationY,
      dimensions: { ...dims },
      assetKey: asset.key,
      roomId,
      visible: true,
    }));

    editor.selection.set({ kind: 'furniture', id });

    // Seamlessly focus camera directly onto the newly added object so the user doesn't end up looking for it
    sceneService.focusOnObject(id, {
      frameDistance: 1.9,
      viewDirection,
    });
  };

  return (
    <div className="app-shell relative flex flex-col w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="contents" inert={!!editingCabinet}>
      {/* Top Header */}
      <Header
        isViewportFullscreen={isViewportFullscreen}
        onToggleViewportFullscreen={toggleViewportFullscreen}
        onSave={handleSave}
        isSaving={isSaving}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        wallCutaway={wallCutaway}
        onWallCutawayToggle={handleWallCutawayToggle}
        foregroundMode={foregroundMode}
        onForegroundModeChange={handleForegroundModeChange}
        isolatedRoomIds={isolatedRoomIds}
        onIsolateRooms={handleIsolateRooms}
        showFixtures={showFixtures}
        onShowFixturesToggle={handleShowFixturesToggle}
        globalLighting={globalLighting}
        globalLightIntensity={globalLightIntensity}
        spotLightIntensity={spotLightIntensity}
        chandelierIntensity={chandelierIntensity}
        onUpdateLighting={handleUpdateLighting}
        onOpenAddAssetModal={() => setIsAddAssetModalOpen(true)}
      />
      {downloadOnly && !isViewportFullscreen && <p className="bg-slate-900 px-4 py-1 text-xs text-amber-200">Changes stay in this tab. Use Save HTML to keep a copy.</p>}
      {saveError && !isViewportFullscreen && <p role="alert" className="bg-red-950 px-4 py-2 text-sm text-red-200">The saved copy could not be prepared. Please try Save again.</p>}

      {/* Main 3D Canvas Area */}
      <main className="flex-1 min-h-0 relative w-full">
        <Viewport3D disabled={isSaving || !!editingCabinet} hideControls={isViewportFullscreen} />

        {/* Inspector Drawers wrapped in ErrorBoundary */}
        <ErrorBoundary>
          {/* Selected Furniture Inspector */}
          {selectedItem && !editingCabinet && (
            <Inspector
              item={selectedItem}
              onEditLayout={() => setEditingCabinet(selectedItem)}
              onOpenReplaceModal={() => setIsReplaceModalOpen(true)}
              onClose={() => editor.selection.select('furniture', null)}
            />
          )}

          {/* Selected Door Inspector with Flip Controls */}
          {selected instanceof WindowOpening && <WindowInspector window={selected} onClose={() => editor.selection.set(null)} />}
          {selectedOpening && !(selected instanceof WindowOpening) && (
            <DoorInspector
              selected={selectedOpening}
              onClose={() => editor.selection.select('opening', null)}
            />
          )}

          {selected instanceof Column && <ColumnInspector column={selected} onClose={() => editor.selection.set(null)} />}

          {/* Selected Wall Inspector with Finishes, Wood Paneling, Tiles & Glass */}
          {selectedWall && (
            <WallInspector
              wall={selectedWall}
              onClose={() => editor.selection.select('wall', null)}
            />
          )}

          {/* Selected Room / Floor Inspector */}
          {selectedRoom && (
            <FloorInspector
              room={selectedRoom}
              onClose={() => editor.selection.select('room', null)}
            />
          )}
        </ErrorBoundary>

        {/* Loading Overlay */}
        {(loading || loadError) && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-3">
              {!loadError && <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />}
              <p role={loadError ? 'alert' : 'status'} className="text-sm font-medium text-slate-300">{loadError ? 'The house plan could not be loaded.' : 'Loading house plan...'}</p>
              {loadError && <button onClick={() => window.location.reload()} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Reload</button>}
            </div>
          </div>
        )}
      </main>

      {/* Asset Replacement Modal */}
      {selectedItem && (
        <AssetReplacementModal
          item={selectedItem}
          isOpen={isReplaceModalOpen}
          onClose={() => setIsReplaceModalOpen(false)}
        />
      )}

      {/* Add Asset Modal */}
      <AssetReplacementModal
        isOpen={isAddAssetModalOpen}
        onClose={() => setIsAddAssetModalOpen(false)}
        mode="add"
        onSelectAsset={handleAddAsset}
      />
      </div>
      {editingCabinet && <CabinetEditor cabinet={editingCabinet} onClose={() => setEditingCabinet(null)} />}
      {isSaving && <SavingOverlay />}
    </div>
  );
};
