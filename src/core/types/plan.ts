/** Read-only ports for geometry and presentation. Editable state is PlanDocument. */
export type { CavityModifier,ColumnSide,FurnitureCategory,LightFixtureConfig,OpeningType,Point2D,SurfaceFinishConfig,TileLayoutPattern,Vector3D,WallFrameStyle,WallSide } from '../../domain/model/PlanData';
export type { PlanDocument } from '../../domain/model/PlanDocument';
import type { ColumnData,FurnitureData,OpeningData,RoomData,WallData } from '../../domain/model/PlanData';
export type ReadValue<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { readonly [K in keyof T]: ReadValue<T[K]> } : T;
export type WallEntity = ReadValue<WallData>;
export type OpeningEntity = ReadValue<OpeningData>;
export type ColumnEntity = ReadValue<ColumnData>;
export type RoomEntity = ReadValue<RoomData>;
export type FurnitureEntity = ReadValue<FurnitureData>;
