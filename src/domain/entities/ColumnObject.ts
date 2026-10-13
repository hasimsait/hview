import * as THREE from 'three';
import { SceneObject, SurfaceDescriptor, PropertyDescriptor, RenderContext } from './SceneObject';
import { ColumnEntity, SurfaceFinishConfig } from '../../core/types/plan';

export class ColumnObject extends SceneObject {
  readonly objectType = 'column' as const;
  columnType: 'column' | 'chimney';
  area?: number;
  stubIds?: string[];
  roomId?: string;
  roomIds?: string[];
  roomName?: string;

  finish?: SurfaceFinishConfig;
  finishFront?: SurfaceFinishConfig;
  finishBack?: SurfaceFinishConfig;
  finishLeft?: SurfaceFinishConfig;
  finishRight?: SurfaceFinishConfig;

  constructor(id: string, name: string = 'Column', columnType: 'column' | 'chimney' = 'column') {
    super(id, name);
    this.columnType = columnType;
    this.dimensions = { x: 0.4, y: 2.7, z: 0.4 };
  }

  getSurfaces(): SurfaceDescriptor[] {
    return [
      { key: 'all', label: 'All Sides', category: 'face' },
      { key: 'front', label: 'Front Face (+Z)', category: 'face' },
      { key: 'back', label: 'Back Face (-Z)', category: 'face' },
      { key: 'left', label: 'Left Face (-X)', category: 'face' },
      { key: 'right', label: 'Right Face (+X)', category: 'face' },
    ];
  }

  getSurfaceFinish(surfaceKey: string): SurfaceFinishConfig | undefined {
    switch (surfaceKey) {
      case 'front': return this.finishFront || this.finish;
      case 'back': return this.finishBack || this.finish;
      case 'left': return this.finishLeft || this.finish;
      case 'right': return this.finishRight || this.finish;
      case 'all': return this.finish;
      default: return this.finish;
    }
  }

  setSurfaceFinish(surfaceKey: string, finish: SurfaceFinishConfig | undefined): void {
    switch (surfaceKey) {
      case 'front': this.finishFront = finish; break;
      case 'back': this.finishBack = finish; break;
      case 'left': this.finishLeft = finish; break;
      case 'right': this.finishRight = finish; break;
      case 'all':
        this.finish = finish;
        this.finishFront = finish;
        this.finishBack = finish;
        this.finishLeft = finish;
        this.finishRight = finish;
        break;
    }
  }

  getInspectableProperties(): PropertyDescriptor[] {
    return [
      { key: 'posX', label: 'Position X', type: 'number', value: this.position.x, step: 0.01, unit: 'm' },
      { key: 'posY', label: 'Elevation', type: 'number', value: this.position.y, step: 0.01, unit: 'm' },
      { key: 'posZ', label: 'Position Z', type: 'number', value: this.position.z, step: 0.01, unit: 'm' },
      { key: 'rotY', label: 'Rotation', type: 'number', value: Math.round((this.rotation.y * 180) / Math.PI), step: 1, unit: '°' },
      { key: 'width', label: 'Width', type: 'number', value: Math.round(this.dimensions.x * 100), min: 5, max: 200, step: 1, unit: 'cm' },
      { key: 'depth', label: 'Depth', type: 'number', value: Math.round(this.dimensions.z * 100), min: 5, max: 200, step: 1, unit: 'cm' },
      { key: 'height', label: 'Height', type: 'number', value: Math.round(this.dimensions.y * 100), min: 10, max: 500, step: 1, unit: 'cm' },
    ];
  }

  setPropertyValue(propertyKey: string, value: any): void {
    switch (propertyKey) {
      case 'width': this.dimensions.x = Math.max(0.05, Number(value) / 100); break;
      case 'depth': this.dimensions.z = Math.max(0.05, Number(value) / 100); break;
      case 'height': this.dimensions.y = Math.max(0.1, Number(value) / 100); break;
      default: super.setPropertyValue(propertyKey, value); break;
    }
  }

  renderObject(context: RenderContext): THREE.Object3D {
    const colGroup = new THREE.Group();
    colGroup.name = `column_${this.id}`;
    colGroup.userData = { type: 'column', id: this.id, entity: this };

    const effectiveHeight = context.cutawayHeight !== undefined
      ? Math.min(this.dimensions.y, context.cutawayHeight)
      : this.dimensions.y;

    const w = this.dimensions.x;
    const d = this.dimensions.z;
    const h = effectiveHeight;

    const geom = new THREE.BoxGeometry(w, h, d);
    // BoxGeometry material faces: 0=+X (right), 1=-X (left), 2=+Y (top), 3=-Y (bottom), 4=+Z (front), 5=-Z (back)
    const fallback = this.finish || { type: 'paint', color: '#f1f5f9' };
    const getMat = (finish?: SurfaceFinishConfig) =>
      context.finishService.getMaterial(finish || fallback, { side: THREE.FrontSide });

    const matRight = getMat(this.finishRight);
    const matLeft = getMat(this.finishLeft);
    const matTop = getMat(this.finish);
    const matBottom = getMat(this.finish);
    const matFront = getMat(this.finishFront);
    const matBack = getMat(this.finishBack);

    const materials = [matRight, matLeft, matTop, matBottom, matFront, matBack];
    const mesh = new THREE.Mesh(geom, materials);
    mesh.userData = { type: 'column', id: this.id, entity: this };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    colGroup.add(mesh);

    colGroup.position.set(this.position.x, this.position.y + h / 2, this.position.z);
    colGroup.rotation.y = this.rotation.y;

    if (context.edgeMaterial || context.showCelOutlines !== false) {
      const lineMat = context.edgeMaterial || new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLine = new THREE.LineSegments(edges, lineMat);
      mesh.add(edgeLine);
    }

    return colGroup;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      type: this.columnType,
      width: this.dimensions.x,
      depth: this.dimensions.z,
      height: this.dimensions.y,
      area: this.area,
      worldPos: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotationY: this.rotation.y,
      stubIds: this.stubIds ? [...this.stubIds] : undefined,
      roomId: this.roomId,
      roomIds: this.roomIds ? [...this.roomIds] : undefined,
      roomName: this.roomName,
      finish: this.finish ? { ...this.finish } : undefined,
      finishFront: this.finishFront ? { ...this.finishFront } : undefined,
      finishBack: this.finishBack ? { ...this.finishBack } : undefined,
      finishLeft: this.finishLeft ? { ...this.finishLeft } : undefined,
      finishRight: this.finishRight ? { ...this.finishRight } : undefined,
    };
  }

  fromEntity(entity: ColumnEntity): this {
    this.id = entity.id;
    this.name = entity.name;
    this.columnType = entity.type;
    this.dimensions = { x: entity.width || 0.4, y: entity.height || 2.7, z: entity.depth || 0.4 };
    this.position = entity.worldPos
      ? { x: entity.worldPos.x, y: entity.worldPos.y || 0, z: entity.worldPos.z }
      : { x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: entity.rotationY || 0, z: 0 };
    this.area = entity.area;
    this.stubIds = entity.stubIds ? [...entity.stubIds] : undefined;
    this.roomId = entity.roomId;
    this.roomIds = entity.roomIds ? [...entity.roomIds] : undefined;
    this.roomName = entity.roomName;
    this.finish = entity.finish;
    this.finishFront = entity.finishFront;
    this.finishBack = entity.finishBack;
    this.finishLeft = entity.finishLeft;
    this.finishRight = entity.finishRight;
    return this;
  }
}
