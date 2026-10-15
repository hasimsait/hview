import * as THREE from 'three';
import type { Furniture } from '../../../domain/elements/Furniture';

export interface ProceduralMaterials {
  woodLight: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  fabricLight: THREE.MeshStandardMaterial;
  fabricBlue: THREE.MeshStandardMaterial;
  fabricDark: THREE.MeshStandardMaterial;
  fabricBeige: THREE.MeshStandardMaterial;
  metalChrome: THREE.MeshStandardMaterial;
  metalBlack: THREE.MeshStandardMaterial;
  metalBrass: THREE.MeshStandardMaterial;
  ceramicWhite: THREE.MeshStandardMaterial;
  graniteCounter: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  mirror: THREE.MeshStandardMaterial;
  mirrorNonReflective: THREE.MeshStandardMaterial;
  cabinetSage: THREE.MeshStandardMaterial;
  screen: THREE.MeshBasicMaterial;
  ledGlow: THREE.MeshBasicMaterial;
  warmLightGlow: THREE.MeshBasicMaterial;
}

export interface AssetBuildContext {
  parent: THREE.Group;
  entity: Furniture;
  w: number;
  h: number;
  d: number;
  materials: ProceduralMaterials;
}

export type AssetBuilderFn = (context: AssetBuildContext) => void;
