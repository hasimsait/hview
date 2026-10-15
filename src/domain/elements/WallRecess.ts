import { finite, identifier } from '../model/Immutable';
import type { FurnitureData, Point2D, SurfaceFinishConfig, WallData } from '../model/PlanData';
import { Furniture } from './Furniture';
import type { PlanElementVisitor } from './PlanElement';

export type RecessHost = Readonly<Pick<WallData,
  'id' | 'thickness' | 'height' | 'finish' | 'finishSideA' | 'finishSideB' |
  'finishEdges' | 'roomSideA' | 'roomSideB'
>> & {
  readonly p1: Readonly<Point2D>;
  readonly p2: Readonly<Point2D>;
  readonly roomIds?: readonly string[];
};
export interface RecessOptions {
  width?: number;
  height?: number;
  elevation?: number;
  depth?: number;
  distanceAlongWall?: number;
}
export interface RecessCut {
  readonly start: number;
  readonly end: number;
  readonly floorHeight: number;
  readonly topHeight: number;
}

/** A niche owns its placement and cut. Its host ID is document state, never vendor metadata. */
export class WallRecess extends Furniture {
  readonly kind = 'furniture.recess';

  constructor(data: FurnitureData) {
    super(data);
    if (data.recessHostId !== undefined) identifier(data.recessHostId);
    Object.freeze(this);
  }

  get hostId() { return this.state.recessHostId; }
  protected recreate(data: FurnitureData): WallRecess { return new WallRecess(data); }
  accept<R>(visitor: PlanElementVisitor<R>): R { return visitor.visitRecess(this); }

  static create(id: string, host: RecessHost, options: RecessOptions = {}): WallRecess {
    const length = Math.hypot(host.p2.x - host.p1.x, host.p2.y - host.p1.y);
    const width = options.width ?? Math.min(1.2, length - 0.1);
    const height = options.height ?? 1.7;
    const elevation = options.elevation ?? 0.7;
    const defaultDistance = length >= width + 0.45 ? 0.25 + width / 2 : length / 2;
    const distance = finite(options.distanceAlongWall ?? defaultDistance, 'Recess position');
    if (length < 0.2 || distance - width / 2 < 0 || distance + width / 2 > length) {
      throw new Error('Recess must fit within its host');
    }
    if (elevation < 0 || elevation + height > host.height) {
      throw new Error('Recess must fit within the host height');
    }
    const t = distance / length;
    return new WallRecess({
      id,
      name: 'wall_recess',
      displayName: 'Wall Recess (Niche)',
      category: 'fixture',
      assetKey: 'wall_recess',
      position: {
        x: host.p1.x + t * (host.p2.x - host.p1.x),
        y: elevation,
        z: host.p1.y + t * (host.p2.y - host.p1.y),
      },
      rotationY: -Math.atan2(host.p2.y - host.p1.y, host.p2.x - host.p1.x),
      dimensions: { x: width, y: height, z: options.depth ?? Math.max(0.1, host.thickness) },
      recessHostId: host.id,
      roomId: host.roomSideA ?? host.roomSideB ?? host.roomIds?.[0],
      visible: true,
      sectionFinishes: {
        recess_wall: host.finishSideA ?? host.finish ?? {
          type: 'tile', variant: 'canakkale_wabi_maburu_bej_34x111', color: '#cec8ba', roughness: 0.22,
        },
        sides: { type: 'tile', variant: 'canakkale_diadem_bej_59x59', color: '#d3c7b8', roughness: 0.76 },
        back: host.finishSideB ?? host.finish ?? { type: 'plaster', variant: 'smooth', color: '#efede8', roughness: 0.85 },
      },
    });
  }

  distanceAlong(host: RecessHost): number {
    const dx = host.p2.x - host.p1.x, dz = host.p2.y - host.p1.y;
    return ((this.position.x - host.p1.x) * dx + (this.position.z - host.p1.y) * dz) / Math.hypot(dx, dz);
  }

  withHost(hostId?: string): WallRecess {
    return hostId === this.hostId ? this : new WallRecess({ ...this.state, recessHostId: hostId });
  }

  /** Explicit hosts win on import; gestures select one nearest eligible host. */
  alignedWith(hosts: readonly RecessHost[], preserveHost = false): WallRecess {
    let closest: { host: RecessHost; t: number; distance: number } | undefined;
    for (const host of hosts) {
      if (preserveHost && this.hostId && host.id !== this.hostId) continue;
      const dx = host.p2.x - host.p1.x, dz = host.p2.y - host.p1.y;
      const length = Math.hypot(dx, dz);
      if (length < 0.02) continue;
      const along = this.distanceAlong(host) / length;
      if (along < -0.15 || along > 1.15) continue;
      const t = Math.max(0.02, Math.min(0.98, along));
      const distance = Math.hypot(this.position.x - host.p1.x - t * dx, this.position.z - host.p1.y - t * dz);
      if (distance > host.thickness / 2 + 0.35 || closest && distance >= closest.distance) continue;
      closest = { host, t, distance };
    }
    if (!closest) return this.withHost(undefined);
    const { host, t } = closest;
    return new WallRecess({
      ...this.state, recessHostId: host.id,
      position: { ...this.position, x: host.p1.x + t * (host.p2.x - host.p1.x), z: host.p1.y + t * (host.p2.y - host.p1.y) },
      dimensions: { ...this.dimensions, z: this.dimensions.z < 0.05 ? Math.max(0.08, host.thickness) : this.dimensions.z },
    });
  }

  cutFor(host: RecessHost): RecessCut | undefined {
    if (this.hostId !== host.id || this.visible === false) return undefined;
    const center = this.distanceAlong(host);
    return {
      start: center - this.dimensions.x / 2,
      end: center + this.dimensions.x / 2,
      floorHeight: this.position.y,
      topHeight: this.position.y + this.dimensions.y,
    };
  }

  assertSplitClear(host: RecessHost, distance: number): void {
    // Hidden recesses still belong to the document and must survive a split intact.
    if (this.hostId === host.id && Math.abs(this.distanceAlong(host) - distance) < this.dimensions.x / 2 - 0.001) {
      throw new Error('Split intersects a recess');
    }
  }

  inheritedFinish(section: string, host?: RecessHost): SurfaceFinishConfig | undefined {
    if (section === 'back') return host?.finishSideB ?? host?.finish;
    if (section === 'sides') return host?.finishEdges ?? host?.finishSideA ?? host?.finish;
    if (section === 'recess_wall') return host?.finishSideA ?? host?.finish;
    return undefined;
  }
}
