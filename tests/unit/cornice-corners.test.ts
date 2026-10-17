import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Wall } from '../../src/domain/elements/Wall';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { defaultWallCornice } from '../../src/domain/model/WallCornice';
import { Room } from '../../src/domain/elements/Room';
import type { WallCorniceConfig } from '../../src/domain/model/WallCornice';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureWallCornice, FinishWall, SetCeilingHeight } from '../../src/application/commands/StructuralCommands';
import { RemoveElement } from '../../src/application/commands/FurnitureCommands';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanSceneGraph } from '../../src/engine/nodes/PlanSceneGraph';
import { SceneNodeFactory } from '../../src/engine/nodes/SceneNodeFactory';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';
import { wallCorniceLayouts } from '../../src/engine/geometry/WallCorniceLayout';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';

function corner(angle = 90, side: 'A' | 'B' = 'A') {
  const r = angle * Math.PI / 180, cornice = { ...defaultWallCornice(true), side };
  return new PlanDocument([
    new Wall({ id: 'first', p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, thickness: .2, height: 3, material: 'a_block', cornice, openings: [] }, []),
    new Wall({ id: 'second', p1: { x: 4, y: 0 }, p2: { x: 4 + 4 * Math.cos(r), y: 4 * Math.sin(r) }, thickness: .2, height: 3, material: 'a_block', cornice, openings: [] }, []),
  ], 3);
}
const materialFactory = { getMaterial: () => new THREE.MeshStandardMaterial() } as unknown as SurfaceMaterialFactory;
function build(plan: PlanDocument, side?: 'A' | 'B') {
  const builder = new WallMeshBuilder(materialFactory);
  return plan.walls.map(wall => {
    const layout = wallCorniceLayouts(plan).get(wall.id);
    const root = builder.buildWall(wall, undefined, undefined, undefined, layout?.heights, layout?.cuts); root.updateMatrixWorld(true);
    return root.getObjectByName(`wall_cornice_${wall.id}_${side ?? wall.cornice!.side}`) as THREE.Mesh;
  });
}
// ExtrudeGeometry puts the end cap first, then the start cap in its lid group.
function cap(mesh: THREE.Mesh, end: 'start' | 'end') {
  const geometry = mesh.geometry, group = geometry.groups[0], count = group.count / 2;
  const points: THREE.Vector3[] = [];
  for (let i = group.start + (end === 'start' ? count : 0); i < group.start + (end === 'start' ? count : 0) + count; i++) {
    points.push(new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index?.getX(i) ?? i).applyMatrix4(mesh.matrixWorld));
  }
  return points;
}
function expectSeam(first: THREE.Mesh, second: THREE.Mesh, firstEnd: 'start' | 'end' = 'end', secondEnd: 'start' | 'end' = 'start') {
  const a = cap(first, firstEnd), b = cap(second, secondEnd);
  // Compare physical vertices with Float32 tolerance, without decimal-rounding boundary artefacts.
  expect(a.length).toBe(b.length);
  for (const p of a) expect(Math.min(...b.map(q => p.distanceTo(q)))).toBeLessThan(.000002);
  for (const p of b) expect(Math.min(...a.map(q => p.distanceTo(q)))).toBeLessThan(.000002);
}
function change(plan: PlanDocument, patch: Partial<WallCorniceConfig>, id = 'second') {
  const wall = plan.requireWall(id); return plan.replace(wall.withCornice({ ...wall.cornice!, ...patch }));
}

describe('cornice corner seams', () => {
  it('joins the full profile exactly at an inside 90-degree corner with curtain clearance', () => {
    const [first, second] = build(corner());
    expectSeam(first, second);
    // The entire first run stays on its side of the diagonal; the second is on the other.
    for (const [mesh, sign] of [[first, 1], [second, -1]] as const) {
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld);
        expect(sign * (p.x + p.z - 4)).toBeLessThan(.000002);
      }
    }
  });
  it.each([45, 60, 90, 120, 135, -45, -90, -135])('joins inside and outside corners at a %s-degree wall turn', angle => {
    for (const side of ['A', 'B'] as const) { const [a, b] = build(corner(angle, side)); expectSeam(a, b); }
  });
  it.each(['plain', 'cove', 'stepped', 'ogee'] as const)('keeps the whole %s profile continuous with different wall thickness, clearance and projection', profile => {
    let plan = change(change(corner(), { profile }, 'first'), { profile, depth: .18, offset: 0 });
    const second = plan.requireWall('second'); plan = plan.replace(new Wall({ ...second.toData(), thickness: .3 }, second.openings));
    const [a, b] = build(plan); expectSeam(a, b);
  });
  it('works when either baseline is reversed and at start-to-start/end-to-end corners', () => {
    for (const reversed of ['first', 'second', 'both']) {
      let plan = corner();
      for (const id of reversed === 'both' ? ['first', 'second'] : [reversed]) {
        const w = plan.requireWall(id); plan = plan.replace(new Wall({ ...w.toData(), p1: w.p2, p2: w.p1, cornice: { ...w.cornice!, side: 'B' } }, []));
      }
      const [a, b] = build(plan); expectSeam(a, b, reversed !== 'second' ? 'start' : 'end', reversed !== 'first' ? 'end' : 'start');
    }
  });
  it('joins straight continuations and bridges small import gaps', () => {
    let plan = corner(0), w = plan.requireWall('second');
    plan = plan.replace(new Wall({ ...w.toData(), p1: { x: 4.03, y: 0 } }, []));
    const [a, b] = build(plan); expectSeam(a, b);
  });
  it('joins a wall whose endpoint already stops at the neighbouring wall face', () => {
    let plan = corner(), second = plan.requireWall('second');
    plan = plan.replace(new Wall({ ...second.toData(), p1: { x: 4, y: .1 } }, []));
    const [a, b] = build(plan); expectSeam(a, b);
  });
  it('joins all four corners of a closed room without a square-end overlap', () => {
    const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const plan = new PlanDocument(points.map((p1, i) => new Wall({ id: `w${i}`, p1, p2: points[(i + 1) % 4], thickness: .2, height: 3, material: 'a_block', cornice: { ...defaultWallCornice(true), side: 'A' }, openings: [] }, [])), 3);
    const meshes = build(plan); meshes.forEach((mesh, i) => expectSeam(mesh, meshes[(i + 1) % 4]));
  });
  it('leaves square caps when profiles, levels or visibility do not form a continuous run', () => {
    for (const patch of [{ profile: 'none' }, { profile: 'plain' }, { height: .2 }, { hidden: true }] as const) {
      const layout = wallCorniceLayouts(change(corner(), patch)).get('first')!; expect(layout.cuts.A?.end).toBeUndefined();
    }
  });
  it('joins both sides independently at different room ceiling levels and caps unequal elevations', () => {
    const room = new Room({ id: 'inside', name: 'Inside', area: 16, polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], height: 3, ceilingHeight: 2.6 });
    const outside = new Room({ ...room.toData(), id: 'outside', name: 'Outside', ceilingHeight: 2.8 });
    let plan = new PlanDocument([...corner().walls.map(w => w.withCornice({ ...w.cornice!, side: 'both' }).withRoomRelationship({ roomSideA: room.id, roomSideB: outside.id, roomIds: [room.id, outside.id] })), room, outside], 3);
    for (const side of ['A', 'B'] as const) {
      const [a, b] = build(plan, side); expectSeam(a, b);
      expect(new THREE.Box3().setFromObject(a).max.y).toBeCloseTo(side === 'A' ? 2.6 : 2.8);
    }
    const second = plan.requireWall('second'); plan = plan.replace(new Wall({ ...second.toData(), height: 2.5 }, []));
    const layout = wallCorniceLayouts(plan).get('first')!;
    expect(layout.cuts.A?.end).toBeUndefined(); expect(layout.cuts.B?.end).toBeUndefined();
  });
  it('keeps mitres at the dropped ceiling and rebuilds a neighbour on edits, removal and undo', () => {
    const room = new Room({ id: 'room', name: 'Living room', area: 16, polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], height: 3, ceilingHeight: 2.6 });
    const plan = new PlanDocument([...corner().walls.map(w => w.withRoomRelationship({ roomSideA: room.id, roomIds: [room.id] })), room], 3);
    const editor = new EditorSession(new PlanCodec().factory); editor.load(plan);
    const builder = new WallMeshBuilder(materialFactory), pool = new ResourcePool(), picking = new PickRegistry();
    const palette = pool.ownTree(Object.assign(new THREE.Object3D(), { material: builder.materials.palette }));
    const empty = () => new THREE.Group();
    const factory = new SceneNodeFactory({ wall: { build: w => { const l = wallCorniceLayouts(editor.getDocument()).get(w.id); return builder.buildWall(w, undefined, undefined, undefined, l?.heights, l?.cuts); }, applyMaterials: (root, w) => builder.materials.applyMaterials(root, w) }, column: { build: empty, applyMaterials: () => {} }, room: { build: empty, applyMaterials: () => {} }, opening: { build: empty, update: () => {} }, furniture: { build: empty }, appearance: { apply: () => {} } }, pool, picking);
    const graph = new PlanSceneGraph(factory, { walls: new THREE.Group(), openings: new THREE.Group(), floors: new THREE.Group(), furniture: new THREE.Group(), fixtures: new THREE.Group() });
    graph.reconcile(plan); editor.subscribe(e => graph.reconcile(e.document));
    const mesh = (id: string) => { const root = graph.get(id)!.group; root.updateMatrixWorld(true); return root.getObjectByName(`wall_cornice_${id}_A`) as THREE.Mesh; };
    expectSeam(mesh('first'), mesh('second')); expect(new THREE.Box3().setFromObject(mesh('first')).max.y).toBeCloseTo(2.6);
    const original = mesh('first'); editor.execute(new ConfigureWallCornice('second', { ...plan.requireWall('second').cornice!, offset: .05 }));
    expect(mesh('first')).not.toBe(original); expectSeam(mesh('first'), mesh('second'));
    const after = mesh('first'); editor.execute(new FinishWall('second', { type: 'paint', color: '#abcdef' }, 'cornice')); expect(mesh('first')).toBe(after);
    editor.execute(new SetCeilingHeight(room.id, 2.4)); expectSeam(mesh('first'), mesh('second')); expect(new THREE.Box3().setFromObject(mesh('first')).max.y).toBeCloseTo(2.4);
    editor.execute(new RemoveElement('second')); expect(wallCorniceLayouts(editor.getDocument()).get('first')!.cuts.A?.end).toBeUndefined(); expect(mesh('first')).not.toBe(after);
    editor.undo(); expectSeam(mesh('first'), mesh('second')); graph.dispose(); palette.dispose(); expect(pool.size).toBe(0);
  });
});
