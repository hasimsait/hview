import type { Vector3D } from '../model/PlanData';

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

export type FurnitureBehavior = 'standard' | 'luminaire' | 'shelving' | 'basin' | 'recess';
