import * as THREE from 'three';
import { Vector3D, SurfaceFinishConfig } from '../../core/types/plan';
import { SurfaceFinishService } from '../../services/rendering/SurfaceFinishService';

export interface SurfaceDescriptor {
  key: string;
  label: string;
  description?: string;
  category?: 'face' | 'edge' | 'cavity' | 'part';
}

export interface PropertyDescriptor {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'select';
  value: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { label: string; value: any }[];
}

export interface RenderContext {
  finishService: SurfaceFinishService;
  materials?: Record<string, THREE.Material>;
  cutawayHeight?: number;
  showCelOutlines?: boolean;
  edgeMaterial?: THREE.LineBasicMaterial;
  wallCutouts?: { start: number; end: number }[];
  recessHoles?: { start: number; end: number; floorHeight: number; topHeight: number }[];
  wallGeometryService?: any;
  proceduralAssetFactory?: any;
}

export interface ILightEmitter {
  enabled: boolean;
  intensity: number;
  color: string;
  temperature?: number;
}

export abstract class SceneObject {
  abstract readonly objectType: 'wall' | 'furniture' | 'room';
  id: string;
  name: string;
  position: Vector3D;
  rotation: Vector3D; // in radians: x, y, z
  dimensions: Vector3D; // in meters: width (x), height (y), depth (z)
  visible: boolean = true;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.dimensions = { x: 1, y: 1, z: 1 };
  }

  /**
   * Polymorphic rendering contract: builds and returns the 3D representation directly.
   * The renderer never inspects the object type; it simply calls renderObject.
   */
  abstract renderObject(context: RenderContext): THREE.Object3D;

  /**
   * Declares all finishable/paintable surfaces belonging to this object.
   */
  abstract getSurfaces(): SurfaceDescriptor[];

  /**
   * Retrieves active finish configuration for a specific surface key.
   */
  abstract getSurfaceFinish(surfaceKey: string): SurfaceFinishConfig | undefined;

  /**
   * Updates finish configuration for a specific surface key.
   */
  abstract setSurfaceFinish(surfaceKey: string, finish: SurfaceFinishConfig | undefined): void;

  /**
   * Declares inspectable and editable properties for the universal UI inspector.
   */
  getInspectableProperties(): PropertyDescriptor[] {
    return [
      { key: 'posX', label: 'Position X', type: 'number', value: this.position.x, step: 0.01, unit: 'm' },
      { key: 'posY', label: 'Position Y', type: 'number', value: this.position.y, step: 0.01, unit: 'm' },
      { key: 'posZ', label: 'Position Z', type: 'number', value: this.position.z, step: 0.01, unit: 'm' },
      { key: 'rotY', label: 'Rotation', type: 'number', value: Math.round((this.rotation.y * 180) / Math.PI), step: 1, unit: '°' },
      { key: 'dimX', label: 'Width', type: 'number', value: Math.round(this.dimensions.x * 100), min: 1, max: 1000, step: 1, unit: 'cm' },
      { key: 'dimY', label: 'Height', type: 'number', value: Math.round(this.dimensions.y * 100), min: 1, max: 1000, step: 1, unit: 'cm' },
      { key: 'dimZ', label: 'Depth', type: 'number', value: Math.round(this.dimensions.z * 100), min: 1, max: 1000, step: 1, unit: 'cm' },
    ];
  }

  /**
   * Updates property value dynamically based on property descriptor key.
   */
  setPropertyValue(propertyKey: string, value: any): void {
    switch (propertyKey) {
      case 'posX': this.position.x = Number(value); break;
      case 'posY': this.position.y = Number(value); break;
      case 'posZ': this.position.z = Number(value); break;
      case 'rotY': this.rotation.y = (Number(value) * Math.PI) / 180; break;
      case 'dimX': this.dimensions.x = Math.max(0.01, Number(value) / 100); break;
      case 'dimY': this.dimensions.y = Math.max(0.01, Number(value) / 100); break;
      case 'dimZ': this.dimensions.z = Math.max(0.01, Number(value) / 100); break;
    }
  }

  /**
   * Lossless serialization.
   */
  abstract toJSON(): Record<string, any>;
}
