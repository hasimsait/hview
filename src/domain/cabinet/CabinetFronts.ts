import type { CabinetBox, CabinetHinge, CabinetLayout } from './CabinetLayout';
import type { Vector3D } from '../model/PlanData';

export interface CabinetDoors {
  count: 0 | 1 | 2;
  hinge: 'left' | 'right';
  split?: number;
  angles: [number, number];
  hinges?: [CabinetHinge, CabinetHinge];
}
export interface CabinetFrontSection {
  id: string;
  bottom: number;
  top: number | 'top';
  opening: 'swing' | 'tilt-out' | 'drawer';
  doors: CabinetDoors;
  basketDepth?: number;
  drawerDepth?: number;
  drawerBoxHeight?: number;
  drawerExtensions?: [number, number];
}
export interface CabinetLeaf {
  index: number;
  localIndex: number;
  section?: CabinetFrontSection;
  doors: CabinetDoors;
  bottom: number;
  top: number;
  width: number;
  left: boolean;
  angle: number;
  tilt: boolean;
  drawer: boolean;
  extension: number;
}
export function cabinetLeafSettings(c: CabinetLayout) {
  return (c.frontSections ?? [{ doors: c.doors }]).flatMap(section => Array.from({ length: section.doors.count }, (_, localIndex) => ({ section: 'id' in section ? section as CabinetFrontSection : undefined, doors: section.doors, localIndex })));
}
export function cabinetLeaves(c: CabinetLayout, size: Vector3D): CabinetLeaf[] {
  return cabinetLeafSettings(c).map(({ section, doors, localIndex }, index) => ({ index, localIndex, section, doors,
    bottom: section?.bottom ?? 0, top: !section || section.top === 'top' ? size.y : section.top,
    width: (size.x - .004) * (doors.count === 2 ? (localIndex === 0 ? doors.split ?? .5 : 1 - (doors.split ?? .5)) : 1) - .002, left: doors.count === 2 ? localIndex === 0 : doors.hinge === 'left',
    angle: section?.opening === 'drawer' ? (section.drawerExtensions?.[localIndex] ?? 0) * 100 : doors.angles[localIndex],
    drawer: section?.opening === 'drawer', extension: section?.opening === 'drawer' ? section.drawerExtensions?.[localIndex] ?? 0 : 0, tilt: section?.opening === 'tilt-out' }));
}
export function cabinetHasDoors(c: CabinetLayout): boolean { return cabinetLeafSettings(c).length > 0; }
export function updateCabinetLeaf(c: CabinetLayout, index: number, update: (doors: CabinetDoors, localIndex: number) => CabinetDoors): CabinetLayout {
  const leaf = cabinetLeafSettings(c)[index]; if (!leaf) return c;
  if (!leaf.section) return { ...c, doors: update(c.doors, leaf.localIndex) };
  return { ...c, frontSections: c.frontSections!.map(s => s.id === leaf.section!.id ? { ...s, doors: update(s.doors, leaf.localIndex) } : s) };
}
export function setCabinetDoorAngle(c: CabinetLayout, index: number, angle: number): CabinetLayout {
  const leaf = cabinetLeafSettings(c)[index];
  if (leaf?.section?.opening === 'drawer') {
    const extensions: [number, number] = [...(leaf.section.drawerExtensions ?? [0, 0])];
    extensions[leaf.localIndex] = Math.max(0, Math.min(1, angle / 100));
    return { ...c, frontSections: c.frontSections!.map(s => s.id === leaf.section!.id ? { ...s, drawerExtensions: extensions } : s) };
  }
  return updateCabinetLeaf(c, index, (doors, localIndex) => { const angles: [number, number] = [...doors.angles]; angles[localIndex] = angle; return { ...doors, angles }; });
}
export function cabinetDoorPose(size: Vector3D, c: CabinetLayout, index: number, degrees?: number) {
  const leaf = cabinetLeaves(c, size)[index], angle = (degrees ?? leaf.angle) * Math.PI / 180;
  if (leaf.drawer) {
    const depth = leaf.section?.drawerDepth ?? Math.max(.02, size.z - c.backThickness - c.panelThickness - .025);
    const extension = degrees === undefined ? leaf.extension : Math.max(0, Math.min(1, degrees / 100));
    return { position: { x: leaf.doors.count === 2 ? (leaf.localIndex ? size.x / 2 - .002 - leaf.width / 2 : -size.x / 2 + .002 + leaf.width / 2) : 0, y: leaf.bottom + .002, z: size.z / 2 - c.panelThickness / 2 + depth * .9 * extension }, rotationY: 0, rotationX: 0 };
  }
  if (leaf.tilt) return { position: { x: leaf.doors.count === 2 ? (leaf.localIndex ? 1 : -1) * (size.x / 4) : 0, y: leaf.bottom + .002, z: size.z / 2 - c.panelThickness / 2 }, rotationY: 0, rotationX: angle };
  const sign = leaf.left ? 1 : -1, hinge = leaf.doors.hinges?.[leaf.localIndex];
  const travel = !hinge || hinge.type === 'pivot' ? 0 : hinge.travel * Math.sin(Math.min(Math.PI / 2, angle));
  return { position: { x: sign * (-size.x / 2 + .002 + travel), y: leaf.bottom, z: size.z / 2 - c.panelThickness / 2 + travel }, rotationY: -sign * angle, rotationX: 0 };
}
/** Basket panels in the same closed interior coordinates as shelves and stored objects. */
export function cabinetBasket(c: CabinetLayout, size: Vector3D, leaf: CabinetLeaf): { floor: CabinetBox; walls: CabinetBox[] } | undefined {
  if (!leaf.tilt || !leaf.section) return;
  const t = c.panelThickness, origin = { x: -size.x / 2 + t, y: t, z: -size.z / 2 + c.backThickness };
  const pose = cabinetDoorPose(size, c, leaf.index, 0), w = Math.max(.001, leaf.width - .06), h = Math.max(.001, (leaf.top - leaf.bottom) * .58);
  const depth = leaf.section.basketDepth ?? Math.max(.001, size.z - c.backThickness - t - .025), b = .008;
  const x = pose.position.x - w / 2 - origin.x, y = pose.position.y + .028 - origin.y, z = pose.position.z - t / 2 - .008 - depth - origin.z;
  const floor: CabinetBox = { id: `basket_${leaf.section.id}_${leaf.localIndex}`, name: `Basket ${leaf.index + 1}`, position: { x, y, z }, dimensions: { x: w, y: b, z: depth } };
  const wall = (px: number, py: number, pz: number, width: number, height: number, d: number): CabinetBox => ({ id: `door_${leaf.index}`, name: floor.name, position: { x: px, y: py, z: pz }, dimensions: { x: width, y: height, z: d } });
  return { floor, walls: [wall(x, y, z, w, b, depth), wall(x, y + b, z, w, h, b), wall(x, y + b, z, b, h, depth), wall(x + w - b, y + b, z, b, h, depth)] };
}
export interface CabinetDrawerTray {
  floor: CabinetBox;
  walls: CabinetBox[];
  usable: Vector3D;
  travel: number;
  extension: number;
}
/** Drawer boxes are evaluated closed for fit; extension only changes their rendered pose. */
export function cabinetDrawerDefaultHeight(c: CabinetLayout, size: Vector3D, bottom: number, top: number): number {
  return Math.max(.02, Math.min(top - bottom - .04, size.y - c.panelThickness - bottom - .025));
}
export function cabinetDrawer(c: CabinetLayout, size: Vector3D, leaf: CabinetLeaf): CabinetDrawerTray | undefined {
  if (!leaf.drawer || !leaf.section) return;
  const t = c.panelThickness, origin = { x: -size.x / 2 + t, y: t, z: -size.z / 2 + c.backThickness };
  const pose = cabinetDoorPose(size, c, leaf.index, 0), width = Math.max(.02, leaf.width - .05);
  const depth = leaf.section.drawerDepth ?? Math.max(.02, size.z - c.backThickness - t - .025);
  const height = leaf.section.drawerBoxHeight ?? cabinetDrawerDefaultHeight(c, size, leaf.bottom, leaf.top);
  return drawerTray(`drawer_${leaf.section.id}_${leaf.localIndex}`, `Drawer ${leaf.index + 1}`, { x: pose.position.x - width / 2 - origin.x, y: leaf.bottom + .025 - origin.y, z: pose.position.z - t / 2 - .008 - depth - origin.z }, width, height, depth, leaf.extension, `door_${leaf.index}`);
}
function drawerTray(id: string, name: string, position: Vector3D, width: number, height: number, depth: number, extension: number, owner = id): CabinetDrawerTray {
  const wall = .012, bottom = .008, p = position;
  const box = (suffix: string, x: number, y: number, z: number, w: number, h: number, d: number): CabinetBox => ({ id: owner, name: `${name} ${suffix}`, position: { x, y, z }, dimensions: { x: Math.max(.001, w), y: Math.max(.001, h), z: Math.max(.001, d) } });
  const floor: CabinetBox = { id, name, position: p, dimensions: { x: width, y: bottom, z: depth } };
  return { floor, walls: [box('floor', p.x, p.y, p.z, width, bottom, depth), box('left', p.x, p.y + bottom, p.z, wall, height - bottom, depth), box('right', p.x + width - wall, p.y + bottom, p.z, wall, height - bottom, depth), box('back', p.x + wall, p.y + bottom, p.z, width - wall * 2, height - bottom, wall), box('front', p.x + wall, p.y + bottom, p.z + depth - wall, width - wall * 2, height - bottom, wall)],
    usable: { x: Math.max(.001, width - wall * 2), y: Math.max(.001, height - bottom), z: Math.max(.001, depth - wall * 2) }, travel: depth * .9, extension };
}
export function cabinetInternalDrawer(c: CabinetLayout, size: Vector3D, drawer: NonNullable<CabinetLayout['internalDrawers']>[number]): CabinetDrawerTray {
  const width = Math.max(.02, size.x - c.panelThickness * 2 - .024), depth = drawer.depth;
  const innerDepth = size.z - c.backThickness - (cabinetHasDoors(c) ? c.panelThickness : 0);
  return drawerTray(`drawer_${drawer.id}`, drawer.name, { x: .012, y: drawer.bottom, z: innerDepth - drawer.setback - depth }, width, drawer.height, depth, drawer.extension);
}
export function cabinetDrawerTrays(c: CabinetLayout, size: Vector3D): CabinetDrawerTray[] {
  return [...cabinetLeaves(c, size).flatMap(leaf => { const tray = cabinetDrawer(c, size, leaf); return tray ? [tray] : []; }), ...(c.internalDrawers ?? []).map(drawer => cabinetInternalDrawer(c, size, drawer))];
}

export function splitCabinetFront(c: CabinetLayout, size: Vector3D, sectionId: string | undefined, at: number, id: string): CabinetLayout {
  const sections = c.frontSections ?? [{ id: 'front', bottom: 0, top: 'top', opening: 'swing', doors: structuredClone(c.doors) } as CabinetFrontSection];
  const section = sections.find(s => s.id === sectionId) ?? sections[0], top = section.top === 'top' ? size.y : section.top;
  if (at <= section.bottom + .04 || at >= top - .04 || sections.length >= 16) return c;
  return { ...c, frontSections: sections.flatMap(s => s !== section ? [s] : [{ ...s, top: at }, { ...structuredClone(s), id, bottom: at }]) };
}
