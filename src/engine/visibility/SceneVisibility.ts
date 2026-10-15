import type { ViewportSettings } from '../../core/types/services';
import { Column } from '../../domain/elements/Column';
import { Furniture } from '../../domain/elements/Furniture';
import { Opening } from '../../domain/elements/Opening';
import type { PlanElement } from '../../domain/elements/PlanElement';
import { Room } from '../../domain/elements/Room';
import { Wall } from '../../domain/elements/Wall';
import type { Point2D } from '../../domain/model/PlanData';
import type { PlanDocument } from '../../domain/model/PlanDocument';

/** Whole-object visibility. Fragment clipping is additionally checked by the picker. */
export class SceneVisibility {
  isVisible(element: PlanElement, document: PlanDocument, settings: ViewportSettings): boolean {
    const selected = settings.isolatedRoomIds;
    const isolated = selected.length > 0;
    if (element instanceof Furniture) return element.visible !== false
      && (element.category === 'fixture' ? settings.showFixtures : settings.showFurniture)
      && (!isolated || !!element.roomId && selected.includes(element.roomId));
    if (element instanceof Room) return settings.showFloor && (!isolated || selected.includes(element.id));
    if (element instanceof Column) return settings.showWalls && (!isolated || selected.some(id => element.roomIds?.includes(id) || element.roomId === id));
    if (element instanceof Wall) return settings.showWalls && (!isolated || selected.some(id => element.roomIds?.includes(id)));
    if (element instanceof Opening) {
      if (!settings.showWalls || settings.wallCutaway && element.floorHeight >= 1.15) return false;
      if (!isolated) return true;
      const wall = document.requireWall(element.wallId);
      // A long wall can border several rooms. Use the opening's actual location.
      return document.rooms.some(room => selected.includes(room.id) && this.touchesBoundary(element.position, room.polygon, wall.thickness / 2 + 0.2));
    }
    return false;
  }
  private touchesBoundary(point: Point2D, polygon: readonly Point2D[], tolerance: number): boolean {
    return polygon.some((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
      const t = length2 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
      return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= tolerance;
    });
  }
}
