import type { CabinetLayout } from '../../domain/cabinet/CabinetLayout';
import { cabinetDoorPose, cabinetInternalDrawer, cabinetLeaves } from '../../domain/cabinet/CabinetFronts';
import type { Furniture } from '../../domain/elements/Furniture';
import type * as THREE from 'three';

function equalExcept(a: object, b: object, ignored: readonly string[]): boolean {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .every(key => ignored.includes(key) || Reflect.get(a, key) === Reflect.get(b, key));
}

/** Immutable layout shares all boards and contents when only a motion control changes. */
export function sameCabinetGeometry(a?: CabinetLayout, b?: CabinetLayout): boolean {
  if (a === b) return true;
  if (!a || !b || !equalExcept(a, b, ['doors', 'frontSections', 'internalDrawers', 'contents'])) return false;
  if (a.contents !== b.contents && (a.contents.length !== b.contents.length || a.contents.some((content, i) => !equalExcept(content, b.contents[i], ['lightConfig'])))) return false;
  if (!equalExcept(a.doors, b.doors, ['angles'])) return false;
  const frontsA = a.frontSections ?? [], frontsB = b.frontSections ?? [];
  if (frontsA.length !== frontsB.length || frontsA.some((front, i) =>
    !equalExcept(front, frontsB[i], ['doors', 'drawerExtensions']) || !equalExcept(front.doors, frontsB[i].doors, ['angles']))) return false;
  const drawersA = a.internalDrawers ?? [], drawersB = b.internalDrawers ?? [];
  return drawersA.length === drawersB.length && drawersA.every((drawer, i) => equalExcept(drawer, drawersB[i], ['extension']));
}

export function applyCabinetMotion(root: THREE.Object3D, item: Furniture): void {
  const layout = item.cabinet;
  if (!layout) return;
  for (const leaf of cabinetLeaves(layout, item.dimensions)) {
    const pivot = root.getObjectByName(`cabinet_door_${leaf.index}`);
    if (!pivot) continue;
    const pose = cabinetDoorPose(item.dimensions, layout, leaf.index);
    pivot.position.set(pose.position.x, pose.position.y, pose.position.z);
    pivot.rotation.set(pose.rotationX, pose.rotationY, 0);
  }
  for (const drawer of layout.internalDrawers ?? []) {
    const pivot = root.getObjectByName(`cabinet_part_drawer_${drawer.id}`);
    if (pivot) pivot.position.z = cabinetInternalDrawer(layout, item.dimensions, drawer).travel * drawer.extension;
  }
}
