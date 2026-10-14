import { PlanDocument, FurnitureEntity, Vector3D, OpeningEntity, WallEntity, SurfaceFinishConfig, Point2D, WallSide, RoomEntity, LightFixtureConfig, WallFrameStyle } from './plan';
import * as THREE from 'three';

export type { WallSide, WallFrameStyle } from './plan';
export type { TileEntry, ITileCatalogService } from '@services/tile-catalog/TileCatalogService';

export interface IPlanParserService {
  parse(rawJson: string | object): PlanDocument;
}

export interface IPlanExportService {
  exportPlan(plan: PlanDocument): string;
}

export type PlanSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type PlanSaveStatusListener = (status: PlanSaveStatus) => void;

export interface IPlanPersistenceService {
  setCurrentPlan?(planJson: string): void;
  cachePlan?(planJson: string): boolean;
  savePlan(planJson: string): Promise<boolean>;
  loadPlan(): Promise<string>;
  resetToTemplate(): Promise<string>;
  onSaveStatusChange(listener: PlanSaveStatusListener): () => void;
  getSaveStatus(): PlanSaveStatus;
}

export type PlanChangeListener = (plan: PlanDocument) => void;
export type PlanLoadedListener = (plan: PlanDocument) => void;
export type WallsChangedListener = (plan: PlanDocument) => void;
export type FurnitureUpdatedListener = (entity: FurnitureEntity) => void;
export type FurnitureDeletedListener = (id: string) => void;
export type SelectionChangeListener = (selected: FurnitureEntity | null, section?: string) => void;
export type OpeningUpdatedListener = (opening: OpeningEntity, wall: WallEntity) => void;
export type OpeningSelectionChangeListener = (selected: { opening: OpeningEntity; wall: WallEntity } | null) => void;
export type WallUpdatedListener = (wall: WallEntity) => void;
export type WallSelectionChangeListener = (selected: WallEntity | null, side?: WallSide) => void;
export type RoomSelectionChangeListener = (selected: RoomEntity | null) => void;
export type RoomUpdatedListener = (room: RoomEntity) => void;

export interface IPlanManagerService {
  getPlan(): PlanDocument | null;
  loadPlan(rawJson: string | object): PlanDocument;
  loadPlanFromUrl(url: string): Promise<PlanDocument>;
  addFurniture(entity: Omit<FurnitureEntity, 'id'> & { id?: string }): FurnitureEntity;
  updateFurniture(id: string, updates: Partial<FurnitureEntity>): void;
  replaceFurnitureAsset(id: string, newAssetKey: string, customModelUrl?: string): void;
  deleteFurniture(id: string): void;
  updateRoomName(roomId: string, newName: string): void;
  getSelectedFurniture(): FurnitureEntity | null;
  getSelectedFurnitureSection(): string;
  setSelectedFurniture(item: FurnitureEntity | null, section?: string): void;
  flipDoor(openingId: string, type: 'swing' | 'hinge'): void;
  setDoorAngle(openingId: string, angleDeg: number): void;
  rotateDoor(openingId: string, degDelta: number): void;
  getSelectedOpening(): { opening: OpeningEntity; wall: WallEntity } | null;
  setSelectedOpening(selected: { opening: OpeningEntity; wall: WallEntity } | null): void;
  getAllDoors(): { opening: OpeningEntity; wall: WallEntity }[];
  getSelectedWall(): WallEntity | null;
  getSelectedWallSide(): WallSide;
  setSelectedWall(wall: WallEntity | null, side?: WallSide): void;
  setWallFinish(wallId: string, finish: SurfaceFinishConfig, side?: WallSide): void;
  setWallFrame(wallId: string, frameStyle: WallFrameStyle, frameColor?: string): void;
  setWallMaterial(wallId: string, material: string): void;
  setRoomWallFinish(roomId: string, finish: SurfaceFinishConfig): void;
  setOpeningFinish(openingId: string, finish: SurfaceFinishConfig): void;
  setFurnitureFinish(id: string, finish?: SurfaceFinishConfig): void;
  setFurnitureSectionFinish(id: string, section: string, finish: SurfaceFinishConfig | undefined): void;
  setFurnitureLightConfig(id: string, config: Partial<LightFixtureConfig>): void;
  setFurnitureHasLids(id: string, hasLids: boolean): void;
  setRoomCeiling(roomId: string, ceilingType: 'clip_in' | 'gypsum' | 'none'): void;
  splitWall(wallId: string, splitDistance: number): { wall1: WallEntity; wall2: WallEntity } | null;
  findWallSplitCandidates(wallId: string): { distance: number; point: Point2D; description: string }[];
  addWallRecess(
    wallId: string,
    options?: {
      width?: number;
      height?: number;
      elevation?: number;
      depth?: number;
      distanceAlongWall?: number;
    }
  ): FurnitureEntity | null;
  getWallRecesses(wallId: string): FurnitureEntity[];
  getSelectedRoom(): RoomEntity | null;
  setSelectedRoom(room: RoomEntity | null): void;
  setRoomFloorFinish(roomId: string, finish?: SurfaceFinishConfig): void;
  onPlanChange(listener: PlanChangeListener): () => void;
  onPlanLoaded(listener: PlanLoadedListener): () => void;
  onWallsChanged(listener: WallsChangedListener): () => void;
  onFurnitureUpdated(listener: FurnitureUpdatedListener): () => void;
  onFurnitureDeleted(listener: FurnitureDeletedListener): () => void;
  onSelectionChange(listener: SelectionChangeListener): () => void;
  onOpeningUpdated(listener: OpeningUpdatedListener): () => void;
  onOpeningSelectionChange(listener: OpeningSelectionChangeListener): () => void;
  onWallUpdated(listener: WallUpdatedListener): () => void;
  onWallSelectionChange(listener: WallSelectionChangeListener): () => void;
  onRoomSelectionChange(listener: RoomSelectionChangeListener): () => void;
  onRoomUpdated(listener: RoomUpdatedListener): () => void;
  exportPlanJson(): string;
  hasUnsavedChanges(): boolean;
  saveCurrentPlan(): Promise<boolean>;
  resetToTemplate(): Promise<PlanDocument>;
  onSaveStatusChange(listener: PlanSaveStatusListener): () => void;
  getSaveStatus(): PlanSaveStatus;
}

export interface AssetPlacement {
  mount: 'floor' | 'wall' | 'ceiling';
  defaultElevation?: number;
  ceilingOffset?: number;
  elevationRange?: [number, number];
  wallOffset?: number;
}

export interface AssetCapabilities {
  lighting?: {
    type?: 'spot' | 'chandelier' | 'sconce' | 'diffuse';
    defaultIntensity?: number;
    defaultColor?: string;
    temperature?: number;
  };
  resizable?: boolean;
  customSections?: string[];
}

export interface AssetDefinition {
  key: string;
  name: string;
  category: string;
  description?: string;
  thumbnail?: string;
  defaultDimensions: Vector3D;
  isCustom?: boolean;
  placement?: AssetPlacement;
  capabilities?: AssetCapabilities;
  aliases?: string[];
}

export interface IAssetRegistryService {
  registerAsset(def: AssetDefinition): void;
  getAsset(key: string): AssetDefinition | undefined;
  getAllAssets(): AssetDefinition[];
  getAssetsByCategory(category: string): AssetDefinition[];
  resolveAssetKey(nameOrKey: string): string;
  hasCapability(keyOrName: string, capability: keyof AssetCapabilities): boolean;
  createMesh(entity: FurnitureEntity): THREE.Object3D;
  setCelShading(enabled: boolean): void;
  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void;
  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void;
}

export type ViewMode = 'perspective' | 'topDown' | 'walkthrough';

export interface ViewportSettings {
  showWalls: boolean;
  wallCutaway: boolean;
  wallOpacity: number;
  foregroundOcclusionMode: 'transparent' | 'clip' | 'off';
  /** Empty array = show all rooms. Non-empty = show only these rooms. */
  isolatedRoomIds: string[];
  showFurniture: boolean;
  showFixtures: boolean;
  showCeiling: boolean;
  showFloor: boolean;
  showRoomLabels: boolean;
  viewMode: ViewMode;
  globalLighting: boolean;
  globalLightIntensity: number; // 0.0 - 2.0 (default 1.0)
  spotLightIntensity: number;   // 0.0 - 3.0 (default 1.0)
  chandelierIntensity: number;  // 0.0 - 3.0 (default 1.0)
}

export interface ISceneService {
  initialize(container: HTMLElement): void;
  dispose(): void;
  renderPlan(plan: PlanDocument): void;
  updateFurnitureObject(entity: FurnitureEntity): void;
  removeFurnitureObject(id: string): void;
  getFurnitureSections(id: string): string[];
  updateOpening(opening: OpeningEntity, wall: WallEntity): void;
  setOpeningSelectionHighlight(selected: { opening: OpeningEntity; wall: WallEntity } | null): void;
  focusOnOpening(opening: OpeningEntity, wall: WallEntity): void;
  updateWallFinish(wall: WallEntity): void;
  setWallSelectionHighlight(wall: WallEntity | null): void;
  focusOnWall(wall: WallEntity): void;
  updateRoomFloorFinish(room: RoomEntity): void;
  setFloorSelectionHighlight(room: RoomEntity | null): void;
  showWallSplitPreview(wall: WallEntity, splitDistance: number): void;
  hideWallSplitPreview(): void;
  rebuildWalls(plan: PlanDocument): void;
  toggleCeilings(): boolean;
  getShowCeilings(): boolean;
  setViewMode(mode: ViewMode): void;
  updateSettings(settings: Partial<ViewportSettings>): void;
  getSettings(): ViewportSettings;
  /** Pass empty array to show all rooms. */
  isolateRooms(roomIds: string[]): void;
  focusOnRoom(roomId: string): void;
  focusOnObject(id: string, options?: { frameDistance?: number; viewDirection?: THREE.Vector3 }): void;
  getWallInCameraView(): { wall: WallEntity; point: THREE.Vector3; normal: THREE.Vector3 } | null;
  resetCamera(): void;
  getScene(): THREE.Scene;
  getCamera(): THREE.Camera;
  getDomElement(): HTMLElement | null;
  isPointForegroundOccluded(point: THREE.Vector3): boolean;
}

export interface IInteractionService {
  initialize(sceneService: ISceneService, planManager: IPlanManagerService): void;
  dispose(): void;
  setGizmoMode(mode: 'translate' | 'rotate'): void;
  getGizmoMode(): 'translate' | 'rotate';
  setGizmoShowY(enabled: boolean): void;
  getGizmoShowY(): boolean;
}

export interface ISurfaceFinishService {
  getMaterial(
    config: SurfaceFinishConfig,
    options?: { side?: THREE.Side; depthWrite?: boolean; projection?: 'world' | 'local' }
  ): THREE.Material;
  getTileTexture(variant?: string): THREE.Texture;
  getLambriTexture(variant?: string, slatColor?: string, backingColor?: string): THREE.Texture;
  getWoodTexture?(variant?: string): THREE.Texture;
  getPlasterTexture(variant?: string): THREE.Texture;
  getClipInCeilingTexture(): THREE.Texture;
  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void;
  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void;
  setForegroundOpacity(opacity: number): void;
  ensureLocalMetricBounds?(mesh: THREE.Mesh): void;
  ensureStretchedUvs?(mesh: THREE.Mesh): void;
}

export interface IStandaloneViewerExportService {
  exportStandaloneViewer(plan?: PlanDocument, fileName?: string): Promise<void>;
  exportStandaloneEditor(plan?: PlanDocument, fileName?: string): Promise<void>;
}
