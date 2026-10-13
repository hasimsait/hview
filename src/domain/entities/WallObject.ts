import * as THREE from 'three';
import { SceneObject, SurfaceDescriptor, PropertyDescriptor, RenderContext } from './SceneObject';
import { WallEntity, Point2D, SurfaceFinishConfig, OpeningEntity, CavityModifier, WallFrameStyle } from '../../core/types/plan';

export class WallObject extends SceneObject {
  readonly objectType = 'wall' as const;
  p1: Point2D;
  p2: Point2D;
  thickness: number;
  height: number;
  material: string;
  color?: string;

  finish?: SurfaceFinishConfig;
  finishSideA?: SurfaceFinishConfig;
  finishSideB?: SurfaceFinishConfig;
  finishEdgeStart?: SurfaceFinishConfig;
  finishEdgeEnd?: SurfaceFinishConfig;
  finishEdgeTop?: SurfaceFinishConfig;
  finishBaseboard?: SurfaceFinishConfig;
  finishEdges?: SurfaceFinishConfig;

  openings: OpeningEntity[] = [];
  cavities: CavityModifier[] = [];
  startOffset?: number;
  endOffset?: number;

  roomSideA?: string;
  roomSideB?: string;
  roomIds?: string[];
  frameStyle?: WallFrameStyle;
  frameColor?: string;
  rawWall?: any;

  constructor(id: string, p1: Point2D = { x: 0, y: 0 }, p2: Point2D = { x: 1, y: 0 }, thickness: number = 0.1, height: number = 2.7) {
    super(id, `Wall ${id}`);
    this.p1 = { ...p1 };
    this.p2 = { ...p2 };
    this.thickness = thickness;
    this.height = height;
    this.material = 'a_block';
    this.updateTransformFromEndpoints();
  }

  updateTransformFromEndpoints(): void {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const len = Math.hypot(dx, dy);
    this.dimensions = { x: len, y: this.height, z: this.thickness };
    this.position = { x: (this.p1.x + this.p2.x) / 2, y: this.height / 2, z: (this.p1.y + this.p2.y) / 2 };
    this.rotation = { x: 0, y: -Math.atan2(dy, dx), z: 0 };
  }

  getSurfaces(): SurfaceDescriptor[] {
    const surfaces: SurfaceDescriptor[] = [
      { key: 'side_a', label: 'Side A (+Z Face)', category: 'face' },
      { key: 'side_b', label: 'Side B (-Z Face)', category: 'face' },
      { key: 'edge_start', label: 'Start End Cap (p1)', category: 'edge' },
      { key: 'edge_end', label: 'End End Cap (p2)', category: 'edge' },
      { key: 'edge_top', label: 'Top Sill', category: 'edge' },
      { key: 'baseboard', label: 'Baseboard (Bottom)', category: 'edge' },
      { key: 'edges', label: 'All Edges', category: 'edge' },
    ];

    if (this.cavities && this.cavities.length > 0) {
      surfaces.push(
        { key: 'cavity_back', label: 'Recess Back Wall', category: 'cavity' },
        { key: 'cavity_returns', label: 'Recess Return Jambs', category: 'cavity' }
      );
    }

    return surfaces;
  }

  getSurfaceFinish(surfaceKey: string): SurfaceFinishConfig | undefined {
    switch (surfaceKey) {
      case 'A':
      case 'side_a':
        return this.finishSideA || this.finish;
      case 'B':
      case 'side_b':
        return this.finishSideB || this.finish;
      case 'edge_start':
        return this.finishEdgeStart || this.finishEdges || this.finish;
      case 'edge_end':
        return this.finishEdgeEnd || this.finishEdges || this.finish;
      case 'edge_top':
        return this.finishEdgeTop || this.finishEdges || this.finish;
      case 'baseboard':
      case 'edge_bottom':
        return this.finishBaseboard || this.finish;
      case 'edges':
        return this.finishEdges || this.finish;
      case 'cavity_back':
        return this.cavities?.[0]?.finishBack || this.finishSideA || this.finish;
      case 'cavity_returns':
        return this.cavities?.[0]?.finishReturns || this.finishEdges || this.finish;
      default:
        return this.finish;
    }
  }

  setSurfaceFinish(surfaceKey: string, finish: SurfaceFinishConfig | undefined): void {
    switch (surfaceKey) {
      case 'A':
      case 'side_a':
        this.finishSideA = finish;
        break;
      case 'B':
      case 'side_b':
        this.finishSideB = finish;
        break;
      case 'edge_start':
        this.finishEdgeStart = finish;
        break;
      case 'edge_end':
        this.finishEdgeEnd = finish;
        break;
      case 'edge_top':
        this.finishEdgeTop = finish;
        break;
      case 'baseboard':
      case 'edge_bottom':
        this.finishBaseboard = finish;
        break;
      case 'edges':
        this.finishEdges = finish;
        this.finishEdgeStart = finish;
        this.finishEdgeEnd = finish;
        this.finishEdgeTop = finish;
        break;
      case 'cavity_back':
        for (const c of this.cavities) c.finishBack = finish;
        break;
      case 'cavity_returns':
        for (const c of this.cavities) c.finishReturns = finish;
        break;
      case 'both':
        this.finishSideA = finish;
        this.finishSideB = finish;
        this.finish = finish;
        break;
      default:
        this.finish = finish;
        break;
    }
  }

  getInspectableProperties(): PropertyDescriptor[] {
    const len = Math.hypot(this.p2.x - this.p1.x, this.p2.y - this.p1.y);
    return [
      { key: 'length', label: 'Wall Length', type: 'number', value: Math.round(len * 100), min: 10, max: 2000, step: 1, unit: 'cm' },
      { key: 'thickness', label: 'Thickness', type: 'number', value: Math.round(this.thickness * 100), min: 5, max: 80, step: 1, unit: 'cm' },
      { key: 'height', label: 'Height', type: 'number', value: Math.round(this.height * 100), min: 50, max: 500, step: 1, unit: 'cm' },
    ];
  }

  setPropertyValue(propertyKey: string, value: any): void {
    switch (propertyKey) {
      case 'thickness':
        this.thickness = Math.max(0.05, Number(value) / 100);
        this.dimensions.z = this.thickness;
        break;
      case 'height':
        this.height = Math.max(0.5, Number(value) / 100);
        this.dimensions.y = this.height;
        break;
    }
  }

  renderObject(context: RenderContext): THREE.Object3D {
    if (context.wallGeometryService) {
      return context.wallGeometryService.buildWall(
        this.toEntity(),
        context.cutawayHeight,
        context.wallCutouts,
        context.recessHoles
      );
    }
    // Fallback minimal group if no geometry service is injected
    const group = new THREE.Group();
    group.name = `wall_${this.id}`;
    group.userData = { type: 'wall', id: this.id, entity: this };
    return group;
  }

  toEntity(): WallEntity {
    return {
      id: this.id,
      p1: { ...this.p1 },
      p2: { ...this.p2 },
      thickness: this.thickness,
      height: this.height,
      material: this.material,
      color: this.color,
      finish: this.finish ? { ...this.finish } : undefined,
      finishSideA: this.finishSideA ? { ...this.finishSideA } : undefined,
      finishSideB: this.finishSideB ? { ...this.finishSideB } : undefined,
      finishEdgeStart: this.finishEdgeStart ? { ...this.finishEdgeStart } : undefined,
      finishEdgeEnd: this.finishEdgeEnd ? { ...this.finishEdgeEnd } : undefined,
      finishEdgeTop: this.finishEdgeTop ? { ...this.finishEdgeTop } : undefined,
      finishBaseboard: this.finishBaseboard ? { ...this.finishBaseboard } : undefined,
      finishEdges: this.finishEdges ? { ...this.finishEdges } : undefined,
      openings: this.openings.map((o) => ({ ...o })),
      cavities: this.cavities.map((c) => ({ ...c })),
      startOffset: this.startOffset,
      endOffset: this.endOffset,
      roomSideA: this.roomSideA,
      roomSideB: this.roomSideB,
      roomIds: this.roomIds ? [...this.roomIds] : undefined,
      frameStyle: this.frameStyle,
      frameColor: this.frameColor,
      rawWall: this.rawWall,
    };
  }

  toJSON(): Record<string, any> {
    return this.toEntity();
  }

  fromEntity(entity: WallEntity): this {
    this.id = entity.id;
    this.name = `Wall ${entity.id}`;
    this.p1 = { ...entity.p1 };
    this.p2 = { ...entity.p2 };
    this.thickness = entity.thickness;
    this.height = entity.height;
    this.material = entity.material || 'a_block';
    this.color = entity.color;
    this.finish = entity.finish;
    this.finishSideA = entity.finishSideA;
    this.finishSideB = entity.finishSideB;
    this.finishEdgeStart = entity.finishEdgeStart;
    this.finishEdgeEnd = entity.finishEdgeEnd;
    this.finishEdgeTop = entity.finishEdgeTop;
    this.finishBaseboard = entity.finishBaseboard;
    this.finishEdges = entity.finishEdges;
    this.openings = entity.openings ? entity.openings.map((o) => ({ ...o })) : [];
    this.cavities = entity.cavities ? entity.cavities.map((c) => ({ ...c })) : [];
    this.startOffset = entity.startOffset;
    this.endOffset = entity.endOffset;
    this.roomSideA = entity.roomSideA;
    this.roomSideB = entity.roomSideB;
    this.roomIds = entity.roomIds ? [...entity.roomIds] : undefined;
    this.frameStyle = entity.frameStyle;
    this.frameColor = entity.frameColor;
    this.rawWall = entity.rawWall;
    this.updateTransformFromEndpoints();
    return this;
  }
}
