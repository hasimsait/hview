import React, { useEffect, useState } from 'react';
import { useService } from '@ui/context/DIContext';
import { TOKENS } from '@core/di/tokens';
import { IPlanManagerService, ISceneService, ViewMode, ViewportSettings, IPlanPersistenceService, AssetDefinition } from '@core/types/services';
import { FurnitureEntity, OpeningEntity, WallEntity, RoomEntity } from '@core/types/plan';
import { Header } from '@ui/components/Header';
import { Viewport3D } from '@ui/components/Viewport3D';
import { Inspector } from '@ui/components/Inspector';
import { DoorInspector } from '@ui/components/DoorInspector';
import { WallInspector } from '@ui/components/WallInspector';
import { FloorInspector } from '@ui/components/FloorInspector';
import { AssetReplacementModal } from '@ui/components/AssetReplacementModal';
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import { restoreInitialPlan } from '@services/plan/PlanBootstrap';

export const App: React.FC = () => {
  const planManager = useService<IPlanManagerService>(TOKENS.PlanManagerService);
  const sceneService = useService<ISceneService>(TOKENS.SceneService);

  const [selectedItem, setSelectedItem] = useState<FurnitureEntity | null>(null);
  const [selectedOpening, setSelectedOpening] = useState<{ opening: OpeningEntity; wall: WallEntity } | null>(null);
  const [selectedWall, setSelectedWall] = useState<WallEntity | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomEntity | null>(null);
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
  const persistenceService = useService<IPlanPersistenceService>(TOKENS.PlanPersistenceService);

  // Load plan automatically on initial launch
  useEffect(() => {
    async function loadInitialPlan() {
      try {
        await restoreInitialPlan(planManager, persistenceService);
      } catch (err) {
        console.error('Failed to load initial plan:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialPlan();

    const unsubscribeSelection = planManager.onSelectionChange((item) => {
      setSelectedItem(item);
    });

    const unsubscribeOpeningSelection = planManager.onOpeningSelectionChange((selected) => {
      setSelectedOpening(selected);
    });

    const unsubscribeWallSelection = planManager.onWallSelectionChange((wall) => {
      setSelectedWall(wall);
    });

    const unsubscribeRoomSelection = planManager.onRoomSelectionChange?.((room) => {
      setSelectedRoom(room);
    });

    return () => {
      unsubscribeSelection();
      unsubscribeOpeningSelection();
      unsubscribeWallSelection();
      unsubscribeRoomSelection?.();
    };
  }, [planManager]);

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

  const handleUpdateLighting = (settings: Partial<ViewportSettings>) => {
    if (settings.globalLighting !== undefined) setGlobalLighting(settings.globalLighting);
    if (settings.globalLightIntensity !== undefined) setGlobalLightIntensity(settings.globalLightIntensity);
    if (settings.spotLightIntensity !== undefined) setSpotLightIntensity(settings.spotLightIntensity);
    if (settings.chandelierIntensity !== undefined) setChandelierIntensity(settings.chandelierIntensity);
    sceneService.updateSettings(settings);
  };

  const handleAddAsset = (asset: AssetDefinition) => {
    const wallHit = sceneService.getWallInCameraView();
    if (!wallHit) {
      console.warn('No wall in camera view to place asset');
      return;
    }

    const { wall, point, normal } = wallHit;
    const dims = asset.defaultDimensions || { x: 0.6, y: 0.6, z: 0.6 };

    // Determine functional placement based on asset placement metadata
    let elevation = point.y;
    let offsetDist = asset.placement?.wallOffset ?? 0.01;

    const mount = asset.placement?.mount ?? (asset.category === 'decor' ? 'wall' : 'floor');

    if (mount === 'ceiling') {
      const planTotalH = planManager.getPlan()?.totalHeight || 2.7;
      const offset = asset.placement?.ceilingOffset ?? (dims.y + 0.05);
      elevation = Math.max(2.1, planTotalH - offset);
      offsetDist = Math.max(0.15, dims.z / 2);
    } else if (mount === 'floor') {
      elevation = 0.0;
      offsetDist = dims.z / 2 + 0.04;
    } else {
      // Wall-mounted items: respect configured architectural elevation range
      if (asset.placement?.elevationRange) {
        const [minEl, maxEl] = asset.placement.elevationRange;
        elevation = elevation >= minEl && elevation <= maxEl
          ? elevation
          : (asset.placement.defaultElevation ?? 1.30);
      } else if (asset.placement?.defaultElevation !== undefined) {
        elevation = asset.placement.defaultElevation;
      } else {
        elevation = Math.max(0.3, Math.min(elevation, 2.2));
      }
    }

    const position = {
      x: point.x + normal.x * offsetDist,
      y: elevation,
      z: point.z + normal.z * offsetDist,
    };

    // Orient object so its front (+Z) faces into the room along the wall normal
    const rotationY = Math.atan2(normal.x, normal.z);

    // Associated room
    const roomId = wall.roomSideA || wall.roomSideB || wall.roomIds?.[0];

    const newEntity = planManager.addFurniture({
      name: asset.key,
      displayName: asset.name,
      category: asset.category as any,
      position,
      rotationY,
      dimensions: { ...dims },
      assetKey: asset.key,
      roomId,
      visible: true,
    });

    // Seamlessly focus camera directly onto the newly added object so the user doesn't end up looking for it
    sceneService.focusOnObject(newEntity.id, {
      frameDistance: 1.9,
      viewDirection: normal,
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
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

      {/* Main 3D Canvas Area */}
      <main className="flex-1 min-h-0 relative w-full">
        <Viewport3D />

        {/* Inspector Drawers wrapped in ErrorBoundary */}
        <ErrorBoundary>
          {/* Selected Furniture Inspector */}
          {selectedItem && (
            <Inspector
              item={selectedItem}
              onOpenReplaceModal={() => setIsReplaceModalOpen(true)}
              onClose={() => planManager.setSelectedFurniture(null)}
            />
          )}

          {/* Selected Door Inspector with Flip Controls */}
          {selectedOpening && (
            <DoorInspector
              selected={selectedOpening}
              onClose={() => planManager.setSelectedOpening(null)}
            />
          )}

          {/* Selected Wall Inspector with Finishes, Wood Paneling, Tiles & Glass */}
          {selectedWall && (
            <WallInspector
              wall={selectedWall}
              onClose={() => planManager.setSelectedWall(null)}
            />
          )}

          {/* Selected Room / Floor Inspector */}
          {selectedRoom && (
            <FloorInspector
              room={selectedRoom}
              onClose={() => planManager.setSelectedRoom(null)}
            />
          )}
        </ErrorBoundary>

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-300">Loading house plan...</p>
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
  );
};
