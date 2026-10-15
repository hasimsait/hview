import * as THREE from 'three';
import { OpeningEntity,PlanDocument,RoomEntity,SurfaceFinishConfig,WallEntity } from './plan';

export type { ITileCatalogService,TileEntry } from '@services/tile-catalog/TileCatalogService';
export type { WallFrameStyle,WallSide } from './plan';

export type PlanSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type PlanSaveStatusListener = (status: PlanSaveStatus) => void;

export interface IDocumentStorage {
  setCurrentPlan?(planJson: string): void;
  savePlan(planJson: string): Promise<boolean>;
  loadPlan(): Promise<string>;
  resetToTemplate(): Promise<string>;
  onSaveStatusChange(listener: PlanSaveStatusListener): () => void;
  getSaveStatus(): PlanSaveStatus;
}

export type { AssetCapabilities,AssetDefinition,AssetPlacement } from '../../domain/catalog/AssetDefinition';

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
  setInteractionEnabled(enabled: boolean): void;
  dispose(): void;
  applyDocumentChange(change: import('../../application/EditorSession').DocumentChange): void;
  renderPlan(plan: PlanDocument): void;
  getFurnitureSections(id: string): string[];
  setOpeningSelectionHighlight(selected: { opening: OpeningEntity; wall: WallEntity } | null): void;
  focusOnOpening(opening: OpeningEntity, wall: WallEntity): void;
  setWallSelectionHighlight(wall: WallEntity | null): void;
  focusOnWall(wall: WallEntity): void;
  setFloorSelectionHighlight(room: RoomEntity | null): void;
  showWallSplitPreview(wall: WallEntity, splitDistance: number): void;
  hideWallSplitPreview(): void;
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
  initialize(sceneService: ISceneService, editor: import('../../application/EditorSession').EditorSession): void;
  setEnabled(enabled: boolean): void;
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
