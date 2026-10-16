import type { FurnitureData, SurfaceFinishConfig, Vector3D } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { finite, identifier, positive } from '../model/Immutable';

/** All dimensions are metres. Interior coordinates start at inside left/base/back. */
export interface CabinetPanel {
  id: string;
  name: string;
  kind: 'shelf' | 'divider';
  at: number;
  start: string | number;
  end: string | number;
  depth: { mode: 'fit' | 'fixed'; value: number };
  thickness?: number;
  finish?: SurfaceFinishConfig;
}
export interface CabinetContent {
  id: string;
  name: string;
  assetKey: string;
  dimensions: Vector3D;
  /** Bottom-left-back offset from support top; unparented objects use interior origin. */
  position: Vector3D;
  rotationY: number;
  supportId?: string;
  finish?: SurfaceFinishConfig;
  sectionFinishes?: Record<string, SurfaceFinishConfig>;
}
export interface CabinetHinge {
  type: 'pivot' | 'straight-arm' | 'half-cranked' | 'fully-cranked';
  /** Planning travel in metres, inward from the hinged edge and outward from the front. */
  travel: number;
}
export const CABINET_HINGE_TYPES: Record<CabinetHinge['type'], string> = {
  pivot: 'Fixed pivot',
  'straight-arm': 'Concealed — straight arm',
  'half-cranked': 'Concealed — half-cranked arm',
  'fully-cranked': 'Concealed — fully cranked arm',
};
export interface CabinetLayout {
  version: 1;
  panelThickness: number;
  backThickness: number;
  doors: { count: 0 | 1 | 2; hinge: 'left' | 'right'; angles: [number, number]; hinges?: [CabinetHinge, CabinetHinge] };
  panels: CabinetPanel[];
  contents: CabinetContent[];
}
export interface CabinetBox { id: string; name: string; position: Vector3D; dimensions: Vector3D; rotationY?: number; invalid?: boolean; }
export const CABINET_EPSILON = .0005;
export function validateCabinet(layout: CabinetLayout): CabinetLayout {
  if (!layout || layout.version !== 1) throw new Error('Unsupported cabinet layout');
  for (const [key, value] of [['Panel', layout.panelThickness], ['Back', layout.backThickness]] as const) if (positive(value, `${key} thickness`) > .1) throw new Error('Cabinet panels must be at most 100 mm thick');
  if (![0, 1, 2].includes(layout.doors?.count) || !['left', 'right'].includes(layout.doors.hinge) || layout.doors.angles?.length !== 2) throw new Error('Cabinets have zero, one or two doors');
  layout.doors.angles.forEach(angle => { if (finite(angle, 'Door angle') < 0 || angle > 170) throw new Error('Cabinet door angles must be between 0 and 170'); });
  if (layout.doors.hinges !== undefined) {
    if (!Array.isArray(layout.doors.hinges) || layout.doors.hinges.length !== 2) throw new Error('Cabinet needs two hinge settings');
    for (const hinge of layout.doors.hinges) {
      if (!hinge || !Object.hasOwn(CABINET_HINGE_TYPES, hinge.type)) throw new Error('Invalid cabinet hinge type');
      if (finite(hinge.travel, 'Hinge travel') < 0 || hinge.travel > .05) throw new Error('Hinge travel must be between 0 and 50 mm');
    }
  }
  if (!Array.isArray(layout.panels) || !Array.isArray(layout.contents) || layout.panels.length > 256 || layout.contents.length > 256) throw new Error('Cabinet layout is too large');
  const ids = new Set<string>(['left', 'right', 'bottom', 'top', 'base', 'shell_left', 'shell_right', 'shell_base', 'shell_top', 'shell_back', 'door_0', 'door_1']);
  for (const p of [...layout.panels, ...layout.contents]) { identifier(p.id); if (ids.has(p.id)) throw new Error('Duplicate cabinet part'); ids.add(p.id); if (p.finish) SurfaceFinish.optional(p.finish); if ('sectionFinishes' in p && p.sectionFinishes) Object.values(p.sectionFinishes).forEach(finish => SurfaceFinish.optional(finish)); if (typeof p.name !== 'string') throw new Error('Cabinet part needs a name'); }
  for (const p of layout.panels) {
    if (!['shelf', 'divider'].includes(p.kind)) throw new Error('Invalid cabinet panel'); finite(p.at, 'Panel position');
    for (const ref of [p.start, p.end]) if (typeof ref === 'number') finite(ref, 'Panel endpoint'); else if (typeof ref !== 'string' || !['left', 'right', 'bottom', 'top'].includes(ref) && !layout.panels.some(other => other.id === ref && other.kind !== p.kind)) throw new Error('Panel endpoint must refer to a perpendicular panel');
    if (!p.depth || !['fit', 'fixed'].includes(p.depth.mode) || finite(p.depth.value, 'Shelf depth') < 0) throw new Error('Invalid panel depth');
    if (p.thickness !== undefined && (positive(p.thickness, 'Panel thickness') > .1)) throw new Error('Panel thickness must be at most 100 mm');
  }
  for (const o of layout.contents) {
    identifier(o.assetKey); for (const axis of ['x', 'y', 'z'] as const) { positive(o.dimensions?.[axis], 'Content dimensions'); finite(o.position?.[axis], 'Content position'); }
    finite(o.rotationY, 'Content rotation');
    if (o.supportId !== undefined && o.supportId !== 'base' && !layout.panels.some(p => p.id === o.supportId && p.kind === 'shelf')) throw new Error('Missing cabinet support');
  }
  return layout;
}
export function cabinetHinge(c: CabinetLayout, index: number): CabinetHinge {
  return c.doors.hinges?.[index] ?? { type: 'pivot', travel: 0 };
}
/** A clearance-planning path, not a manufacturer-specific linkage simulation.
 * Arm crank affects installation geometry, not a universal travel distance.
 * All concealed arm styles therefore use the user's measured travel.
 */
export function cabinetDoorPose(size: Vector3D, c: CabinetLayout, index: number, degrees = c.doors.angles[index]): { position: Vector3D; rotationY: number } {
  const left = c.doors.count === 2 ? index === 0 : c.doors.hinge === 'left', sign = left ? 1 : -1;
  const hinge = cabinetHinge(c, index), angle = degrees * Math.PI / 180;
  const travel = hinge.type === 'pivot' ? 0 : hinge.travel * Math.sin(Math.min(Math.PI / 2, angle));
  return { position: { x: sign * (-size.x / 2 + .002 + travel), y: 0, z: size.z / 2 - c.panelThickness / 2 + travel }, rotationY: -sign * angle };
}
export function interior(size: Vector3D, c: CabinetLayout): Vector3D {
  return { x: size.x - c.panelThickness * 2, y: size.y - c.panelThickness * 2, z: size.z - c.backThickness - (c.doors.count ? c.panelThickness : 0) };
}
export function interiorOrigin(size: Vector3D, c: CabinetLayout): Vector3D { return { x: -size.x / 2 + c.panelThickness, y: c.panelThickness, z: -size.z / 2 + c.backThickness }; }
export function endpoint(c: CabinetLayout, size: Vector3D, ref: string | number, start: boolean): number {
  if (typeof ref === 'number') return ref;
  const inner = interior(size, c);
  if (ref === 'left' || ref === 'bottom') return 0;
  if (ref === 'right') return inner.x;
  if (ref === 'top') return inner.y;
  const p = c.panels.find(p => p.id === ref)!;
  return p.at + (start ? p.thickness ?? c.panelThickness : 0);
}
export function resolvePanel(c: CabinetLayout, size: Vector3D, p: CabinetPanel): CabinetBox {
  const a = endpoint(c, size, p.start, true), b = endpoint(c, size, p.end, false), t = p.thickness ?? c.panelThickness;
  const depth = p.depth.mode === 'fixed' ? p.depth.value : interior(size, c).z - p.depth.value;
  return { id: p.id, name: p.name, position: p.kind === 'shelf' ? { x: a, y: p.at, z: 0 } : { x: p.at, y: a, z: 0 },
    dimensions: p.kind === 'shelf' ? { x: Math.max(.001, b - a), y: t, z: Math.max(.001, depth) } : { x: t, y: Math.max(.001, b - a), z: Math.max(.001, depth) }, invalid: b - a <= 0 || depth <= 0 };
}
export function shelfClearances(c: CabinetLayout, size: Vector3D, id: string): { below: number; above: number } {
  const panel = c.panels.find(p => p.id === id); if (!panel || panel.kind !== 'shelf') return { below: 0, above: 0 };
  const box = resolvePanel(c, size, panel), neighbours = c.panels.filter(p => p.kind === 'shelf' && p.id !== id).map(p => resolvePanel(c, size, p)).filter(other => Math.min(other.position.x + other.dimensions.x, box.position.x + box.dimensions.x) - Math.max(other.position.x, box.position.x) > CABINET_EPSILON && Math.min(other.position.z + other.dimensions.z, box.position.z + box.dimensions.z) - Math.max(other.position.z, box.position.z) > CABINET_EPSILON);
  const lower = Math.max(0, ...neighbours.filter(p => p.position.y < box.position.y).map(p => p.position.y + p.dimensions.y));
  const upper = Math.min(interior(size, c).y, ...neighbours.filter(p => p.position.y > box.position.y).map(p => p.position.y));
  return { below: Math.max(0, box.position.y - lower), above: Math.max(0, upper - box.position.y - box.dimensions.y) };
}
export function footprint(size: Vector3D, rotationY = 0): { x: number; z: number } { return { x: Math.abs(Math.cos(rotationY)) * size.x + Math.abs(Math.sin(rotationY)) * size.z, z: Math.abs(Math.sin(rotationY)) * size.x + Math.abs(Math.cos(rotationY)) * size.z }; }
export function resolveContent(c: CabinetLayout, size: Vector3D, o: CabinetContent): CabinetBox {
  const support = c.panels.find(p => p.id === o.supportId), box = support ? resolvePanel(c, size, support) : undefined;
  return { id: o.id, name: o.name, dimensions: o.dimensions, rotationY: o.rotationY, position: { x: o.position.x + (box?.position.x ?? 0), y: o.position.y + (box ? box.position.y + box.dimensions.y : 0), z: o.position.z + (box?.position.z ?? 0) } };
}
/** Strict penetration of upright oriented boxes. Mere contact (including shelf contact) is valid. */
export function penetrates(a: CabinetBox, b: CabinetBox, epsilon = CABINET_EPSILON): boolean {
  if (Math.min(a.position.y + a.dimensions.y, b.position.y + b.dimensions.y) - Math.max(a.position.y, b.position.y) <= epsilon) return false;
  const af = footprint(a.dimensions, a.rotationY), bf = footprint(b.dimensions, b.rotationY);
  const ac = { x: a.position.x + af.x / 2, z: a.position.z + af.z / 2 }, bc = { x: b.position.x + bf.x / 2, z: b.position.z + bf.z / 2 };
  const angles = [a.rotationY ?? 0, b.rotationY ?? 0];
  for (const angle of angles) for (const offset of [0, Math.PI / 2]) {
    const x = Math.cos(angle + offset), z = -Math.sin(angle + offset);
    const radius = (box: CabinetBox) => Math.abs(x * Math.cos(box.rotationY ?? 0) - z * Math.sin(box.rotationY ?? 0)) * box.dimensions.x / 2 + Math.abs(x * Math.sin(box.rotationY ?? 0) + z * Math.cos(box.rotationY ?? 0)) * box.dimensions.z / 2;
    if (radius(a) + radius(b) - Math.abs((ac.x - bc.x) * x + (ac.z - bc.z) * z) <= epsilon) return false;
  }
  return true;
}
function supportedOn(o: CabinetBox, surface: CabinetBox): boolean {
  const f = footprint(o.dimensions, o.rotationY), x = o.position.x + f.x / 2, z = o.position.z + f.z / 2;
  return Math.abs(o.position.y - surface.position.y - surface.dimensions.y) <= CABINET_EPSILON && x >= surface.position.x - CABINET_EPSILON && x <= surface.position.x + surface.dimensions.x + CABINET_EPSILON && z >= surface.position.z - CABINET_EPSILON && z <= surface.position.z + surface.dimensions.z + CABINET_EPSILON;
}
function supports(c: CabinetLayout, size: Vector3D): CabinetBox[] {
  const i = interior(size, c);
  return [{ id: 'base', name: 'Base', position: { x: 0, y: -c.panelThickness, z: 0 }, dimensions: { x: Math.max(.001, i.x), y: c.panelThickness, z: Math.max(.001, i.z) } }, ...c.panels.filter(p => p.kind === 'shelf').map(p => resolvePanel(c, size, p)).filter(p => !p.invalid)];
}
/** Called only on deliberate placement/movement. Loading/resizing never rearranges contents. */
export function settleContent(c: CabinetLayout, size: Vector3D, o: CabinetContent, absolute?: Vector3D): CabinetContent {
  const resolved = resolveContent(c, size, o), pos = absolute ?? resolved.position, f = footprint(o.dimensions, o.rotationY);
  const candidates = supports(c, size).filter(s => s.position.y + s.dimensions.y <= pos.y + .002 && pos.x + f.x / 2 >= s.position.x && pos.x + f.x / 2 <= s.position.x + s.dimensions.x && pos.z + f.z / 2 >= s.position.z && pos.z + f.z / 2 <= s.position.z + s.dimensions.z).sort((a, b) => b.position.y - a.position.y);
  const support = candidates[0];
  return { ...o, supportId: support?.id, position: support ? { x: pos.x - support.position.x, y: 0, z: pos.z - support.position.z } : { ...pos } };
}
export function moveCabinetPart(c: CabinetLayout, size: Vector3D, id: string, centre: Vector3D, rotation: number, gravity = true): CabinetLayout {
  const origin = interiorOrigin(size, c), p = c.panels.find(p => p.id === id), o = c.contents.find(o => o.id === id);
  if (p) {
    const at = p.kind === 'shelf' ? centre.y - origin.y - (p.thickness ?? c.panelThickness) / 2 : centre.x - origin.x - (p.thickness ?? c.panelThickness) / 2;
    return { ...c, panels: c.panels.map(panel => panel.id === id ? { ...panel, at } : panel) };
  }
  if (o) {
    const f = footprint(o.dimensions, rotation), position = { x: centre.x - origin.x - f.x / 2, y: centre.y - origin.y, z: centre.z - origin.z - f.z / 2 };
    const next = gravity ? settleContent(c, size, { ...o, rotationY: rotation }, position) : { ...o, rotationY: rotation, supportId: undefined, position };
    return { ...c, contents: c.contents.map(content => content.id === id ? next : content) };
  }
  return c;
}
export function cabinetIssues(c: CabinetLayout, size: Vector3D): Map<string, string[]> {
  const result = new Map<string, string[]>(), i = interior(size, c);
  const flag = (id: string, reason: string) => result.set(id, [...new Set([...(result.get(id) ?? []), reason])]);
  if (i.x <= 0 || i.y <= 0 || i.z <= 0) { flag('shell_left', 'Cabinet smaller than panel thicknesses'); flag('shell_right', 'Cabinet smaller than panel thicknesses'); }
  const boxes = [...c.panels.map(p => resolvePanel(c, size, p)), ...c.contents.map(o => resolveContent(c, size, o))];
  for (const box of boxes) {
    const f = footprint(box.dimensions, box.rotationY);
    if (box.invalid || box.position.x < -CABINET_EPSILON || box.position.y < -CABINET_EPSILON || box.position.z < -CABINET_EPSILON || box.position.x + f.x > i.x + CABINET_EPSILON || box.position.y + box.dimensions.y > i.y + CABINET_EPSILON || box.position.z + f.z > i.z + CABINET_EPSILON) flag(box.id, 'Outside usable interior');
    for (const other of boxes) if (other.id !== box.id && penetrates(box, other)) flag(box.id, `Intersects ${other.name}`);
  }
  for (const o of c.contents) if (!supports(c, size).some(s => supportedOn(resolveContent(c, size, o), s))) flag(o.id, 'Unsupported');
  return result;
}
export function removeCabinetPart(c: CabinetLayout, size: Vector3D, id: string): CabinetLayout {
  return { ...c, panels: c.panels.filter(p => p.id !== id).map(p => ({ ...p, start: p.start === id ? endpoint(c, size, p.start, true) : p.start, end: p.end === id ? endpoint(c, size, p.end, false) : p.end })), contents: c.contents.filter(o => o.id !== id).map(o => o.supportId === id ? { ...o, supportId: undefined, position: resolveContent(c, size, o).position } : o) };
}
export function splitDivider(c: CabinetLayout, size: Vector3D, id: string): CabinetLayout {
  const p = c.panels.find(p => p.id === id); if (!p || p.kind !== 'divider') return c;
  const a = endpoint(c, size, p.start, true), b = endpoint(c, size, p.end, false);
  const cuts = c.panels.filter(s => s.kind === 'shelf' && s.at > a && s.at + (s.thickness ?? c.panelThickness) < b).filter(s => { const box = resolvePanel(c, size, s); return box.position.x <= p.at + c.panelThickness + CABINET_EPSILON && box.position.x + box.dimensions.x >= p.at - CABINET_EPSILON; }).sort((a, b) => a.at - b.at);
  if (!cuts.length) return c;
  const segments = [...cuts, undefined].map((cut, index) => ({ ...p, id: index ? `${p.id}_segment_${index}` : p.id, name: `${p.name} ${index + 1}`, start: index ? cuts[index - 1].id : p.start, end: cut?.id ?? p.end }));
  const remap = (s: CabinetPanel) => {
    if (s.kind !== 'shelf' || s.start !== id && s.end !== id) return s;
    const cutIndex = cuts.findIndex(cut => cut.id === s.id);
    const segment = cutIndex >= 0 ? segments[cutIndex + 1] : segments.find(segment => s.at >= endpoint(c, size, segment.start, true) && s.at <= endpoint(c, size, segment.end, false)) ?? segments[0];
    return { ...s, start: s.start === id ? segment.id : s.start, end: s.end === id ? segment.id : s.end };
  };
  return { ...c, panels: [...c.panels.filter(s => s.id !== id).map(remap), ...segments] };
}
export function defaultCabinet(data: Pick<FurnitureData, 'dimensions' | 'assetKey' | 'hasLids' | 'shelfCount'>, doors: 0 | 1 | 2 = 2): CabinetLayout {
  if (data.hasLids && doors === 0) doors = data.dimensions.x >= .7 ? 2 : 1;
  const count = data.assetKey === 'open_shelving' ? Math.max(0, (data.shelfCount ?? 5) - 2) : data.shelfCount ?? (data.assetKey.includes('ward') ? 1 : 2);
  return { version: 1, panelThickness: .018, backThickness: .006, doors: { count: doors, hinge: 'left', angles: [0, 0] },
    panels: Array.from({ length: count }, (_, index) => ({ id: `shelf_${index + 1}`, name: `Shelf ${index + 1}`, kind: 'shelf', at: (data.dimensions.y - .036) * (index + 1) / (count + 1), start: 'left', end: 'right', depth: { mode: 'fit', value: .02 } })), contents: [] };
}
