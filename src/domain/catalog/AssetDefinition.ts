import type { Vector3D } from '../model/PlanData';
import type { AssetRecipeId } from './AssetRecipes';

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
  source?: { retailer: string; url?: string; productCode?: string; dimensions: 'listed' | 'estimated' | 'reference' };
}

export type FurnitureBehavior = 'standard' | 'luminaire' | 'shelving' | 'basin' | 'recess';
