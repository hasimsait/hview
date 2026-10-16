import type { Vector3D } from '../model/PlanData';
import type { AssetRecipeId } from './AssetRecipes';
import type { AccessoryModel } from './AccessoryModel';
import type { BathroomModel } from './BathroomModel';
import type { FurnitureProductModel } from './FurnitureProductModel';
import type { ArchitecturalFinishModel } from './ArchitecturalFinishes';
import type { LightingComponentModel } from './LightingComponents';
import type { FloorDrainModel } from './FloorDrains';

export interface AssetPlacement {
  mount: 'floor' | 'wall' | 'ceiling' | 'surface';
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
  recipe?: AssetRecipeId;
  accessory?: AccessoryModel;
  bathroom?: BathroomModel;
  furnitureProduct?: FurnitureProductModel;
  architecturalFinish?: ArchitecturalFinishModel;
  lightingComponent?: LightingComponentModel;
  floorDrain?: FloorDrainModel;
  electrical?: {
    series: 'karre' | 'bubble';
    control: 'single_switch' | 'double_switch' | 'socket' | 'double_socket';
    frameColor: string;
    insertColor: string;
  };
  collection?: string;
  source?: {
    retailer: string; url?: string; productCode?: string;
    dimensions: 'listed' | 'estimated' | 'reference'; dimensionNotes?: string;
    dimensionSources?: string[];
    popularity?: { category: string; rank: number; checkedAt: string };
  };
}

export type FurnitureBehavior = 'standard' | 'luminaire' | 'shelving' | 'basin' | 'recess';
