export interface Point2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type OpeningType = 'door' | 'door_coupe' | 'window' | 'french_window';

export type TileLayoutPattern =
  | 'grid'
  | 'running_bond'
  | 'diagonal_herringbone'
  | 'herringbone'
  | 'french_pattern'
  | 'vertical_stack';

export interface SurfaceFinishConfig {
  type: 'paint' | 'plaster' | 'lambri' | 'tile' | 'glass' | 'wood' | 'ceiling' | 'metal' | 'porcelain' | 'fabric' | 'invisible';
  variant?: string; // 'subway' | 'square' | 'marble' | 'anthracite' | 'chrome_shiny' | 'chrome_satin' | 'brass_shiny' | 'brass_brushed' | 'matte_black_powder' | 'matte_white_powder' | 'porcelain_white' | 'invisible'
  color?: string;   // hex color e.g. '#f8fafc' or 'invisible'
  roughness?: number;
  metalness?: number;
  rotation?: number; // Texture rotation angle in degrees (0 = horizontal/brick default, 90 = vertical, 180, 270)
  pattern?: TileLayoutPattern; // Layout bond pattern: 'grid' | 'running_bond' | 'diagonal_herringbone' | 'herringbone' | 'french_pattern' | 'vertical_stack'
  groutWidth?: number; // Grout joint width in mm: 0, 1, 2
  groutColor?: string; // Grout joint hex color e.g. '#d1d5db'
  mappingMode?: 'stretched' | 'tiled'; // Mapping mode: 'stretched' (fitted 0..1) or 'tiled' (repeating metric/pattern)
  scale?: number; // Texture repeat scale multiplier (e.g. 1.0, 2.5, 3.5, 4.0)
  backingColor?: string; // Acoustic felt backing / background color for lambri
}


export interface OpeningEntity {
  id: string;
  type: OpeningType;
  width: number;       // meters
  height: number;      // meters
  floorHeight: number; // meters from floor
  wallId: string;
  position: Point2D;   // center position in world (meters)
  distanceAlongWall: number; // distance from wall p1 in meters
  swingSide?: 'r' | 'l';
  hingeSide?: 'r' | 'l';
  swingFlipped?: boolean;
  hingeFlipped?: boolean;
  openAngle?: number;  // degrees (0 = closed, 40 = default ajar, 90 = open, etc.)
  finish?: SurfaceFinishConfig;
  rawOpening?: any;
}

export type WallSide = 'A' | 'B' | 'edges' | 'edge_start' | 'edge_end' | 'edge_top' | 'baseboard' | 'edge_bottom' | 'both';
export type ColumnSide = 'all' | 'front' | 'back' | 'left' | 'right';

export interface CavityModifier {
  id: string;
  distanceAlongWall: number; // meters from p1
  floorElevation: number;    // meters from floor
  width: number;             // meters
  height: number;            // meters
  depth: number;             // meters into wall
  finishBack?: SurfaceFinishConfig;
  finishReturns?: SurfaceFinishConfig;
}

export interface ColumnEntity {
  id: string;
  name: string;
  type: 'column' | 'chimney';
  width: number;       // meters
  depth: number;       // meters
  height?: number;     // meters
  area?: number;       // m²
  worldPos: { x: number; y: number; z: number };
  rotationY: number;
  stubIds?: string[];
  roomId?: string;     // Primary bordering or enclosing room ID
  roomIds?: string[];  // All rooms this column borders or is enclosed by
  roomName?: string;
  finish?: SurfaceFinishConfig;       // Fallback / all sides
  finishFront?: SurfaceFinishConfig;  // +Z face
  finishBack?: SurfaceFinishConfig;   // -Z face
  finishLeft?: SurfaceFinishConfig;   // -X face
  finishRight?: SurfaceFinishConfig;  // +X face
}

export type WallFrameStyle = 'none' | 'perimeter' | 'grid_3' | 'grid_4' | 'grid_2x3';

export interface WallEntity {
  isColumn?: boolean; // Solid column represented by a single thick wall
  id: string;
  p1: Point2D;          // meters
  p2: Point2D;          // meters
  thickness: number;    // meters
  height: number;       // meters
  material: string;
  color?: string;
  finish?: SurfaceFinishConfig;
  finishSideA?: SurfaceFinishConfig; // Finish on Side A (+Z local / left facing)
  finishSideB?: SurfaceFinishConfig; // Finish on Side B (-Z local / right facing)
  finishEdgeStart?: SurfaceFinishConfig; // Finish on start end cap at p1 (-X local)
  finishEdgeEnd?: SurfaceFinishConfig;   // Finish on end end cap at p2 (+X local)
  finishEdgeTop?: SurfaceFinishConfig;   // Finish on top sill (+Y local)
  finishBaseboard?: SurfaceFinishConfig; // Finish on bottom corner baseboard / skirting
  finishEdges?: SurfaceFinishConfig;     // Fallback for all edges / jambs
  roomSideA?: string;                // Room ID bordering Side A
  roomSideB?: string;                // Room ID bordering Side B
  openings: OpeningEntity[];
  cavities?: CavityModifier[];       // Pinned recesses (wall-native features)
  startOffset?: number;              // meters to extend (+) or cut short (-) at p1
  endOffset?: number;                // meters to extend (+) or cut short (-) at p2
  roomIds?: string[];   // IDs of rooms this wall encloses/borders
  frameStyle?: WallFrameStyle;
  frameColor?: string;  // Hex color e.g. '#18181b' (black aluminium), '#f1f5f9' (chrome)
  rawWall?: any;
}

export interface RoomEntity {
  id: string;
  name: string;
  area: number;         // m²
  polygon: Point2D[];   // outer perimeter in meters
  height: number;       // meters
  floorType?: string;
  floorFinish?: SurfaceFinishConfig;
  ceilingType?: 'clip_in' | 'gypsum' | 'none';
  wallFinish?: SurfaceFinishConfig;
  rawRoom?: any;
}

export type FurnitureCategory =
  | 'bed'
  | 'seating'
  | 'table'
  | 'storage'
  | 'kitchen'
  | 'bathroom'
  | 'decor'
  | 'appliance'
  | 'fixture';

export interface LightFixtureConfig {
  enabled?: boolean;
  intensity?: number; // 0.0 to 3.0 multiplier (1.0 = standard)
  color?: string;     // hex color e.g. '#fff2dc'
}

export interface FurnitureEntity {
  id: string;
  name: string;
  displayName: string;
  category: FurnitureCategory;
  position: Vector3D;   // 3D coordinates in meters: X (horizontal), Y (elevation from floor), Z (depth)
  rotationY: number;    // radians
  dimensions: Vector3D; // width (X), height (Y), depth (Z) in meters
  roomId?: string;
  assetKey: string;     // identifier for procedural asset or GLB model
  customModelUrl?: string;
  visible?: boolean;
  hasLids?: boolean;    // Front lids / cabinet doors for shelving units
  finish?: SurfaceFinishConfig;
  /** Per-section finish overrides. Keys match the __section tags on procedural materials:
   *  'wood' | 'fabric' | 'metal' | 'ceramic' | 'stone' | 'glass'  */
  sectionFinishes?: Record<string, SurfaceFinishConfig>;
  lightConfig?: LightFixtureConfig;
  rawItem?: any;
}

export interface PlanDocument {
  version: number;
  totalHeight: number;  // meters
  walls: WallEntity[];
  rooms: RoomEntity[];
  columns?: ColumnEntity[];
  furniture: FurnitureEntity[];
  rawPlan: any;
}
