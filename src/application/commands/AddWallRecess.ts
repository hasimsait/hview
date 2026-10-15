import { Column } from '../../domain/elements/Column';
import { Wall } from '../../domain/elements/Wall';
import type { PlanDocument } from '../../domain/model/PlanDocument';
import type { CommandContext,EditorCommand } from './EditorCommand';
export interface RecessOptions { width?: number; height?: number; elevation?: number; depth?: number; distanceAlongWall?: number; }
export class AddWallRecess implements EditorCommand {
  readonly label = 'Add wall recess';
  constructor(readonly id: string, private readonly wallId: string, private readonly options: RecessOptions = {}) { }
  execute(document: PlanDocument, { factory }: CommandContext): PlanDocument {
    const wallId = this.wallId;
    const host = document.require(wallId);
    const wall = host instanceof Column ? host.wallShape(document.totalHeight) : host instanceof Wall ? host : null;
    if (!wall) throw new Error('A recess needs a wall or column');

    const dx = wall.p2.x - wall.p1.x;
    const dz = wall.p2.y - wall.p1.y;
    const wallLen = Math.hypot(dx, dz);
    if (wallLen < 0.2) throw new Error('Wall is too short for a recess');

    const width = this.options?.width ?? 1.20;
    const height = this.options?.height ?? 1.70;
    const elevation = this.options?.elevation ?? 0.70;
    const depth = this.options?.depth ?? Math.max(0.1, wall.thickness || 0.12);

    let dist = this.options?.distanceAlongWall;
    if (dist === undefined) {
      if (wallLen >= width + 0.45) {
        dist = 0.25 + width / 2;
      } else {
        dist = wallLen / 2;
      }
    }

    const t = Math.max(0.05, Math.min(0.95, dist / wallLen));
    const posX = wall.p1.x + t * dx;
    const posZ = wall.p1.y + t * dz;
    const angle = Math.atan2(dz, dx);
    const rotationY = -angle;

    const roomId = wall.roomSideA || wall.roomSideB || wall.roomIds?.[0];

    const entity = factory.furniture({
      id: this.id,
      name: 'wall_recess',
      displayName: 'Wall Recess (Niche)',
      category: 'fixture',
      position: { x: posX, y: elevation, z: posZ },
      rotationY,
      dimensions: { x: width, y: height, z: depth },
      assetKey: 'wall_recess',
      roomId,
      visible: true,
      rawItem: { wallThickness: wall.thickness, wallId: wall.id },
      sectionFinishes: {
        recess_wall: wall.finishSideA || wall.finish || {
          type: 'tile',
          variant: 'canakkale_wabi_maburu_bej_34x111',
          color: '#cec8ba',
          roughness: 0.22,
        },
        sides: {
          type: 'tile',
          variant: 'canakkale_diadem_bej_59x59',
          color: '#d3c7b8',
          roughness: 0.76,
        },
        back: wall.finishSideB || wall.finish || {
          type: 'plaster',
          variant: 'smooth',
          color: '#efede8',
          roughness: 0.85,
        },
      },
    });

    return document.add(entity);
  }
}
