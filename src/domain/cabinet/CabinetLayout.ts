import type { FurnitureData, LightFixtureConfig, SurfaceFinishConfig, Vector3D } from '../model/PlanData';
import { SurfaceFinish } from '../model/SurfaceFinish';
import { finite, identifier, positive } from '../model/Immutable';
import { cabinetDrawerTrays, cabinetBasket, cabinetHasDoors, cabinetLeafSettings, cabinetLeaves, type CabinetDoors, type CabinetFrontSection } from './CabinetFronts';
import { cabinetBaseHeight, type CabinetPlinth } from './CabinetPlinth';
export { cabinetDoorPose } from './CabinetFronts';

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
  lightConfig?: LightFixtureConfig;
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
export interface CabinetInternalDrawer {
  id: string;
  name: string;
  bottom: number;
  height: number;
  depth: number;
  setback: number;
  extension: number;
  finish?: SurfaceFinishConfig;
}
export interface CabinetLayout {
  version: 1;
  doorStyle?: 'panel_glass' | 'full_glass';
  /** Height extensions rest on the bookcase top instead of adding another base. */
  openBottom?: boolean;
  /** Optional traditional fronts; fixing centres are measured between pull feet. */
  frontDetail?: { profile: 'framed'; handleCentres: number; pairedDrawerPulls: boolean; corniceHeight?: number };
  panelThickness: number;
  backThickness: number;
  plinth?: CabinetPlinth;
  doors: CabinetDoors;
  frontSections?: CabinetFrontSection[];
  panels: CabinetPanel[];
  contents: CabinetContent[];
  internalDrawers?: CabinetInternalDrawer[];
}
export interface CabinetBox { id: string; name: string; position: Vector3D; dimensions: Vector3D; rotationY?: number; invalid?: boolean; }
export const CABINET_EPSILON = .0005;
export function validateCabinet(layout: CabinetLayout): CabinetLayout {
  if (!layout || layout.version !== 1) throw new Error('Unsupported cabinet layout');
  if (layout.doorStyle !== undefined && !['panel_glass', 'full_glass'].includes(layout.doorStyle)) throw new Error('Invalid cabinet door style');
  if (layout.openBottom !== undefined && typeof layout.openBottom !== 'boolean') throw new Error('Invalid cabinet base');
  if (layout.frontDetail && (layout.frontDetail.profile !== 'framed' || !Number.isFinite(layout.frontDetail.handleCentres) || layout.frontDetail.handleCentres < .032 || layout.frontDetail.handleCentres > .32 || typeof layout.frontDetail.pairedDrawerPulls !== 'boolean')) throw new Error('Invalid cabinet front detail');
  if (layout.frontDetail?.corniceHeight !== undefined && (finite(layout.frontDetail.corniceHeight, 'Cornice height') < 0 || layout.frontDetail.corniceHeight > .25)) throw new Error('Invalid cabinet cornice height');
  for (const [key, value] of [['Panel', layout.panelThickness], ['Back', layout.backThickness]] as const) if (positive(value, `${key} thickness`) > .1) throw new Error('Cabinet panels must be at most 100 mm thick');
  if (layout.plinth) {
    if (positive(layout.plinth.height, 'Plinth height') > .5) throw new Error('Plinth height must be at most 50 cm');
    if (finite(layout.plinth.setback, 'Plinth setback') < 0) throw new Error('Plinth setback must not be negative');
  }
  const validateDoors = (doors: CabinetDoors, tilt = false) => {
    if (![0, 1, 2].includes(doors?.count) || !['left', 'right'].includes(doors.hinge) || doors.angles?.length !== 2) throw new Error('Cabinets have zero, one or two doors');
    if (doors.split !== undefined && (finite(doors.split, 'Door split') < .1 || doors.split > .9)) throw new Error('Invalid door split');
    doors.angles.forEach(angle => { if (finite(angle, 'Door angle') < 0 || angle > (tilt ? 60 : 170)) throw new Error('Invalid cabinet door angle'); });
    if (doors.hinges !== undefined) {
      if (!Array.isArray(doors.hinges) || doors.hinges.length !== 2) throw new Error('Cabinet needs two hinge settings');
      for (const hinge of doors.hinges) {
        if (!hinge || !Object.hasOwn(CABINET_HINGE_TYPES, hinge.type)) throw new Error('Invalid cabinet hinge type');
        if (finite(hinge.travel, 'Hinge travel') < 0 || hinge.travel > .05) throw new Error('Hinge travel must be between 0 and 50 mm');
      }
    }
  };
  validateDoors(layout.doors);
  if (layout.internalDrawers !== undefined && (!Array.isArray(layout.internalDrawers) || layout.internalDrawers.length > 32)) throw new Error('Too many internal drawers');
  for (const d of layout.internalDrawers ?? []) {
    finite(d.bottom, 'Internal drawer bottom'); if (positive(d.depth, 'Internal drawer depth') < .02) throw new Error('Drawer depth must be at least 20 mm');
    if (positive(d.height, 'Internal drawer height') < .02) throw new Error('Drawer box must be at least 20 mm high');
    if (finite(d.setback, 'Drawer setback') < 0 || finite(d.extension, 'Drawer extension') < 0 || d.extension > 1) throw new Error('Invalid internal drawer');
  }
  if (layout.frontSections !== undefined) {
    if (!Array.isArray(layout.frontSections) || !layout.frontSections.length || layout.frontSections.length > 16) throw new Error('Invalid cabinet front sections');
    const ids = new Set<string>();
    for (const s of layout.frontSections) {
      identifier(s.id); if (ids.has(s.id)) throw new Error('Duplicate front section'); ids.add(s.id);
      finite(s.bottom, 'Front bottom'); if (s.top !== 'top') finite(s.top, 'Front top');
      if (!['swing', 'tilt-out', 'drawer'].includes(s.opening)) throw new Error('Invalid cabinet front opening');
      validateDoors(s.doors, s.opening === 'tilt-out');
      if (s.drawerDepth !== undefined && positive(s.drawerDepth, 'Drawer depth') < .02) throw new Error('Drawer depth must be at least 20 mm');
      if (s.drawerBoxHeight !== undefined && positive(s.drawerBoxHeight, 'Drawer box height') < .02) throw new Error('Drawer box must be at least 20 mm high');
      if (s.drawerExtensions !== undefined && (s.drawerExtensions.length !== 2 || s.drawerExtensions.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Drawer extension must be between 0 and 1');
      if (s.basketDepth !== undefined) positive(s.basketDepth, 'Basket depth');
    }
  }
  if (!Array.isArray(layout.panels) || !Array.isArray(layout.contents) || layout.panels.length > 256 || layout.contents.length > 256) throw new Error('Cabinet layout is too large');
  const ids = new Set<string>(['left', 'right', 'bottom', 'top', 'base', 'plinth_front', 'plinth_left', 'plinth_right', 'shell_left', 'shell_right', 'shell_base', 'shell_top', 'shell_back', 'door_0', 'door_1']);
  for (const [index, leaf] of cabinetLeafSettings(layout).entries()) { ids.add(`door_${index}`); if (leaf.section?.opening === 'drawer') ids.add(`drawer_${leaf.section.id}_${leaf.localIndex}`); if (leaf.section?.opening === 'tilt-out') ids.add(`basket_${leaf.section.id}_${leaf.localIndex}`); }
  for (const d of layout.internalDrawers ?? []) ids.add(`drawer_${d.id}`);
  for (const p of [...layout.panels, ...layout.contents, ...(layout.internalDrawers ?? [])]) { identifier(p.id); if (ids.has(p.id)) throw new Error('Duplicate cabinet part'); ids.add(p.id); if (p.finish) SurfaceFinish.optional(p.finish); if ('sectionFinishes' in p && p.sectionFinishes) Object.values(p.sectionFinishes).forEach(finish => SurfaceFinish.optional(finish)); if (typeof p.name !== 'string') throw new Error('Cabinet part needs a name'); }
  for (const p of layout.panels) {
    if (!['shelf', 'divider'].includes(p.kind)) throw new Error('Invalid cabinet panel'); finite(p.at, 'Panel position');
    for (const ref of [p.start, p.end]) if (typeof ref === 'number') finite(ref, 'Panel endpoint'); else if (typeof ref !== 'string' || !['left', 'right', 'bottom', 'top'].includes(ref) && !layout.panels.some(other => other.id === ref && other.kind !== p.kind)) throw new Error('Panel endpoint must refer to a perpendicular panel');
    if (!p.depth || !['fit', 'fixed'].includes(p.depth.mode) || finite(p.depth.value, 'Shelf depth') < 0) throw new Error('Invalid panel depth');
    if (p.thickness !== undefined && (positive(p.thickness, 'Panel thickness') > .1)) throw new Error('Panel thickness must be at most 100 mm');
  }
  for (const o of layout.contents) {
    identifier(o.assetKey); for (const axis of ['x', 'y', 'z'] as const) { positive(o.dimensions?.[axis], 'Content dimensions'); finite(o.position?.[axis], 'Content position'); }
    finite(o.rotationY, 'Content rotation');
    if (o.lightConfig !== undefined) {
      const config = o.lightConfig;
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid content light settings');
      if (config.enabled !== undefined && typeof config.enabled !== 'boolean') throw new Error('Invalid content light state');
      if (config.color !== undefined && typeof config.color !== 'string') throw new Error('Invalid content light color');
      if (config.intensity !== undefined && (finite(config.intensity, 'Content light intensity') < 0 || config.intensity > 3)) throw new Error('Content light intensity must be between 0 and 3');
      if (config.temperatureKelvin !== undefined && (finite(config.temperatureKelvin, 'Content light temperature') < 2700 || config.temperatureKelvin > 6500)) throw new Error('Content light temperature must be between 2700 and 6500 K');
      if (config.lumens !== undefined && (finite(config.lumens, 'Content light output') < 0 || config.lumens > 100000)) throw new Error('Content light output must be between 0 and 100000 lm');
    }
    const seen = new Set([o.id]);
    let parent = o.supportId;
    while (parent && layout.contents.some(p => p.id === parent)) {
      if (seen.has(parent)) throw new Error('Circular cabinet stack');
      seen.add(parent); parent = layout.contents.find(p => p.id === parent)!.supportId;
    }
    if (o.supportId !== undefined && o.supportId !== 'base' && !layout.panels.some(p => p.id === o.supportId && p.kind === 'shelf') && !layout.contents.some(p => p.id === o.supportId) && !(layout.internalDrawers ?? []).some(d => o.supportId === `drawer_${d.id}`) && !cabinetLeafSettings(layout).some(l => l.section?.opening === 'drawer' && o.supportId === `drawer_${l.section.id}_${l.localIndex}`) && !cabinetLeafSettings(layout).some(l => l.section?.opening === 'tilt-out' && o.supportId === `basket_${l.section.id}_${l.localIndex}`)) throw new Error('Missing cabinet support');
  }
  return layout;
}
export function cabinetHinge(c: CabinetLayout, index: number): CabinetHinge {
  const leaf = cabinetLeafSettings(c)[index];
  return leaf?.doors.hinges?.[leaf.localIndex] ?? { type: 'pivot', travel: 0 };
}
export function interior(size: Vector3D, c: CabinetLayout): Vector3D {
  return { x: size.x - c.panelThickness * 2, y: size.y - cabinetBaseHeight(c) - c.panelThickness * (c.openBottom ? 1 : 2), z: size.z - c.backThickness - (cabinetHasDoors(c) ? c.panelThickness : 0) };
}
export function interiorOrigin(size: Vector3D, c: CabinetLayout): Vector3D { return { x: -size.x / 2 + c.panelThickness, y: cabinetBaseHeight(c) + (c.openBottom ? 0 : c.panelThickness), z: -size.z / 2 + c.backThickness }; }
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
/** True for the object itself or any item resting directly/indirectly on it. */
export function contentDependsOn(c: CabinetLayout, id: string, ancestor: string): boolean {
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current); current = c.contents.find(o => o.id === current)?.supportId;
  }
  return false;
}
/** Shelf/base/basket attachment inherited by every item in a vertical stack. */
export function contentSupportRoot(c: CabinetLayout, o: CabinetContent): string | undefined {
  let current = o; const seen = new Set([o.id]);
  while (current.supportId) {
    const parent = c.contents.find(p => p.id === current.supportId);
    if (!parent) return current.supportId;
    if (seen.has(parent.id)) throw new Error('Circular cabinet stack');
    seen.add(parent.id); current = parent;
  }
  return undefined;
}
/** A pass owns its derived boxes; edits and undo never reuse stale coordinates. */
class CabinetContentResolver {
  readonly contents: Map<string, CabinetContent>;
  readonly structural: CabinetBox[];
  readonly boxes = new Map<string, CabinetBox>();
  private readonly resolving = new Set<string>();
  constructor(c: CabinetLayout, size: Vector3D) {
    this.contents = new Map(c.contents.map(o => [o.id, o]));
    this.structural = structuralSupports(c, size);
  }
  resolve(o: CabinetContent): CabinetBox {
    const cached = this.boxes.get(o.id); if (cached) return cached;
    if (this.resolving.has(o.id)) throw new Error('Circular cabinet stack');
    this.resolving.add(o.id);
    const parent = o.supportId ? this.contents.get(o.supportId) : undefined;
    const box = parent ? this.resolve(parent) : this.structural.find(p => p.id === o.supportId);
    const resolved = { id: o.id, name: o.name, dimensions: o.dimensions, rotationY: o.rotationY, position: { x: o.position.x + (box?.position.x ?? 0), y: o.position.y + (box ? box.position.y + box.dimensions.y : 0), z: o.position.z + (box?.position.z ?? 0) } };
    this.boxes.set(o.id, resolved); this.resolving.delete(o.id);
    return resolved;
  }
  dependsOn(id: string, ancestor: string): boolean {
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current && !seen.has(current)) {
      if (current === ancestor) return true;
      seen.add(current); current = this.contents.get(current)?.supportId;
    }
    return false;
  }
}
export function resolveContent(c: CabinetLayout, size: Vector3D, o: CabinetContent): CabinetBox {
  return new CabinetContentResolver(c, size).resolve(o);
}
export function resolveContents(c: CabinetLayout, size: Vector3D): ReadonlyMap<string, CabinetBox> {
  const resolver = new CabinetContentResolver(c, size);
  for (const o of c.contents) resolver.resolve(o);
  return resolver.boxes;
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
function overSupport(position: Vector3D, f: { x: number; z: number }, surface: CabinetBox): boolean {
  const sf = footprint(surface.dimensions, surface.rotationY), angle = surface.rotationY ?? 0;
  const dx = position.x + f.x / 2 - surface.position.x - sf.x / 2;
  const dz = position.z + f.z / 2 - surface.position.z - sf.z / 2;
  return Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) <= surface.dimensions.x / 2 + CABINET_EPSILON &&
    Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) <= surface.dimensions.z / 2 + CABINET_EPSILON;
}
function supportedOn(o: CabinetBox, surface: CabinetBox): boolean {
  return Math.abs(o.position.y - surface.position.y - surface.dimensions.y) <= CABINET_EPSILON && overSupport(o.position, footprint(o.dimensions, o.rotationY), surface);
}
function structuralSupports(c: CabinetLayout, size: Vector3D): CabinetBox[] {
  const i = interior(size, c);
  return [{ id: 'base', name: 'Base', position: { x: 0, y: -c.panelThickness, z: 0 }, dimensions: { x: Math.max(.001, i.x), y: c.panelThickness, z: Math.max(.001, i.z) } }, ...c.panels.filter(p => p.kind === 'shelf').map(p => resolvePanel(c, size, p)).filter(p => !p.invalid), ...cabinetLeaves(c, size).flatMap(l => { const b = cabinetBasket(c, size, l); return b ? [b.floor] : []; }), ...cabinetDrawerTrays(c, size).map(d => d.floor)];
}
function supports(c: CabinetLayout, size: Vector3D, excluded?: string): CabinetBox[] {
  const resolver = new CabinetContentResolver(c, size);
  return [...resolver.structural, ...c.contents.filter(o => !excluded || !resolver.dependsOn(o.id, excluded)).map(o => resolver.resolve(o))];
}
/** Make independently editable copies attached in a vertical chain; one command can undo all copies. */
export function stackContent(c: CabinetLayout, id: string, ids: string[]): CabinetLayout {
  const original = c.contents.find(o => o.id === id);
  if (!original) throw new Error('Missing stack object');
  if (c.contents.length + ids.length > 256) throw new Error('Cabinet layout is too large');
  const used = new Set([...c.contents, ...c.panels].map(o => o.id));
  let support = original;
  const copies = ids.map(id => {
    identifier(id); if (used.has(id)) throw new Error('Duplicate cabinet part'); used.add(id);
    const copy: CabinetContent = { ...original, id, supportId: support.id, position: { x: 0, y: 0, z: 0 } };
    support = copy; return copy;
  });
  return { ...c, contents: [...c.contents, ...copies] };
}
/** Called only on deliberate placement/movement. Loading/resizing never rearranges contents. */
export function settleContent(c: CabinetLayout, size: Vector3D, o: CabinetContent, absolute?: Vector3D): CabinetContent {
  const resolved = resolveContent(c, size, o), pos = absolute ?? resolved.position, f = footprint(o.dimensions, o.rotationY);
  const candidates = supports(c, size, o.id).filter(s => s.position.y + s.dimensions.y <= pos.y + .002 && overSupport(pos, f, s)).sort((a, b) => (b.position.y + b.dimensions.y) - (a.position.y + a.dimensions.y));
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
  const resolver = new CabinetContentResolver(c, size), contentBoxes = c.contents.map(o => resolver.resolve(o));
  const leaves = cabinetLeaves(c, size), surfaces = [...resolver.structural, ...contentBoxes];
  const flag = (id: string, reason: string) => result.set(id, [...new Set([...(result.get(id) ?? []), reason])]);
  if (c.plinth && c.plinth.setback > size.z - c.panelThickness * 2) flag('plinth_front', 'Plinth setback exceeds cabinet depth');
  if (i.x <= 0 || i.y <= 0 || i.z <= 0) { flag('shell_left', 'Cabinet smaller than panel thicknesses'); flag('shell_right', 'Cabinet smaller than panel thicknesses'); }
  const boxes = [...c.panels.map(p => resolvePanel(c, size, p)), ...contentBoxes, ...leaves.flatMap(l => cabinetBasket(c, size, l)?.walls ?? []), ...cabinetDrawerTrays(c, size).flatMap(d => d.walls)];
  for (const l of leaves) if (l.bottom < cabinetBaseHeight(c) || l.top > size.y || l.top <= l.bottom + .004) flag(`door_${l.index}`, 'Front outside cabinet height');
  for (const a of leaves) for (const b of leaves) if (a.section?.id !== b.section?.id && Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) > CABINET_EPSILON) flag(`door_${a.index}`, 'Overlapping front sections');
  for (const box of boxes) {
    const f = footprint(box.dimensions, box.rotationY);
    if (box.invalid || box.position.x < -CABINET_EPSILON || box.position.y < -CABINET_EPSILON || box.position.z < -CABINET_EPSILON || box.position.x + f.x > i.x + CABINET_EPSILON || box.position.y + box.dimensions.y > i.y + CABINET_EPSILON || box.position.z + f.z > i.z + CABINET_EPSILON) flag(box.id, 'Outside usable interior');
    for (const other of boxes) if (other.id !== box.id && penetrates(box, other)) flag(box.id, `Intersects ${other.name}`);
  }
  for (const box of contentBoxes) if (!surfaces.some(s => s.id !== box.id && supportedOn(box, s) && !resolver.dependsOn(s.id, box.id))) flag(box.id, 'Unsupported');
  return result;
}
export function removeCabinetPart(c: CabinetLayout, size: Vector3D, id: string): CabinetLayout {
  const nextDrawers = c.internalDrawers?.filter(d => `drawer_${d.id}` !== id);
  return { ...c, internalDrawers: nextDrawers, panels: c.panels.filter(p => p.id !== id).map(p => ({ ...p, start: p.start === id ? endpoint(c, size, p.start, true) : p.start, end: p.end === id ? endpoint(c, size, p.end, false) : p.end })), contents: c.contents.filter(o => o.id !== id).map(o => o.supportId === id ? { ...o, supportId: undefined, position: resolveContent(c, size, o).position } : o) };
}
export function withCabinetFrontSections(c: CabinetLayout, size: Vector3D, frontSections: CabinetFrontSection[]): CabinetLayout {
  const next = { ...c, frontSections }, valid = new Set(supports(next, size).map(s => s.id));
  return { ...next, contents: c.contents.map(o => o.supportId && !valid.has(o.supportId) ? { ...o, supportId: undefined, position: resolveContent(c, size, o).position } : o) };
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
  const layout: CabinetLayout = { version: 1, panelThickness: .018, backThickness: .006, doors: { count: doors, hinge: 'left', angles: [0, 0] },
    panels: Array.from({ length: count }, (_, index) => ({ id: `shelf_${index + 1}`, name: `Shelf ${index + 1}`, kind: 'shelf', at: (data.dimensions.y - .036) * (index + 1) / (count + 1), start: 'left', end: 'right', depth: { mode: 'fit', value: .02 } })), contents: [] };
  if (data.assetKey === 'mirror_cabinet_upper') { layout.panelThickness = .015; layout.doors.count = 2; layout.doors.split = .625; }
  if (data.assetKey.startsWith('ikea_billy_oxberg_')) {
    layout.backThickness = .003; layout.doorStyle = data.assetKey.includes('_glass_') ? 'full_glass' : 'panel_glass'; layout.doors.count = 2;
    layout.plinth = { height: .10, setback: .03 };
    layout.panels = Array.from({ length: 5 }, (_, i) => ({ id: `shelf_${i + 1}`, name: `Shelf ${i + 1}`, kind: 'shelf', at: .1 + (data.dimensions.y - .1) * (i + 1) / 6 - .018, start: 'left', end: 'right', depth: { mode: 'fit', value: .012 } }));
  }
  if (data.assetKey.includes('billy_') && data.assetKey.includes('_extension_')) {
    layout.backThickness = .018; layout.openBottom = true; layout.plinth = undefined; layout.panels = [];
    layout.doors.count = data.assetKey.startsWith('ikea_billy_oxberg_') ? 2 : 0;
    layout.doorStyle = 'full_glass';
  }
  if (data.assetKey === 'cabinet_drawers_three' || data.assetKey === 'cabinet_drawers_deep') {
    const cuts = data.assetKey === 'cabinet_drawers_three' ? [0, data.dimensions.y * .25, data.dimensions.y * .625] : [0, data.dimensions.y * .5];
    layout.panels = [];
    layout.frontSections = cuts.map((bottom, i) => ({ id: `drawer_front_${i + 1}`, bottom, top: cuts[i + 1] ?? 'top', opening: 'drawer', doors: { count: 1, hinge: 'left', angles: [0, 0] }, drawerExtensions: [0, 0] }));
  }
  if (data.assetKey === 'cabinet_wardrobe_drawers') {
    layout.panels = [{ id: 'drawer_cover', name: 'Shelf above drawers', kind: 'shelf', at: .58, start: 'left', end: 'right', depth: { mode: 'fit', value: .02 } }];
    layout.internalDrawers = [0, 1].map(i => ({ id: `internal_${i + 1}`, name: `Internal drawer ${i + 1}`, bottom: .025 + i * .25, height: .20, depth: Math.max(.03, interior(data.dimensions, layout).z - .04), setback: .02, extension: 0 }));
  }
  if (data.assetKey === 'cabinet_laundry_tiltout') {
    const h = data.dimensions.y / 3;
    layout.frontSections = [
      { id: 'lower', bottom: 0, top: h, opening: 'tilt-out', doors: { count: 1, hinge: 'left', angles: [0, 0] } },
      { id: 'middle', bottom: h, top: 2 * h, opening: 'tilt-out', doors: { count: 1, hinge: 'left', angles: [0, 0] } },
      { id: 'upper', bottom: 2 * h, top: 'top', opening: 'swing', doors: { count: 2, hinge: 'left', angles: [0, 0] } },
    ];
    layout.panels = [h, h * 2, h * 2.5].map((height, i) => ({ id: `shelf_${i + 1}`, name: `Shelf ${i + 1}`, kind: 'shelf', at: height - .027, start: 'left', end: 'right', depth: { mode: 'fit', value: .02 } }));
  }
  return layout;
}
