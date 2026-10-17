import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AddWindow, ConfigureWindowGeometry } from '../../src/application/commands/WindowCommands';
import { RemoveElement } from '../../src/application/commands/FurnitureCommands';
import { EditorSession } from '../../src/application/EditorSession';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { WindowOpening } from '../../src/domain/elements/Opening';
import { Wall } from '../../src/domain/elements/Wall';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { defaultWindowGeometry } from '../../src/domain/model/WindowGeometry';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { PlanSceneGraph } from '../../src/engine/nodes/PlanSceneGraph';
import { SceneNodeFactory } from '../../src/engine/nodes/SceneNodeFactory';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { rawPlan } from './fixtures';

const codec = new PlanCodec();
const config = { width: 1.2, height: 1.1, floorHeight: .8, distanceAlongWall: 2 };
function editorFixture() { const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan())); return editor; }

describe('window placement and dimension editing', () => {
  it('adds into a free wall span, owns the opening on its wall, and supplies curtains', () => {
    const editor = editorFixture(), before = editor.getDocument(); editor.execute(new AddWindow('new', 'wall'));
    const window = editor.getDocument().require('new') as WindowOpening;
    expect(window).toBeInstanceOf(WindowOpening); expect(window.curtainState).toBe('visible');
    expect(window.distanceAlongWall - window.width / 2).toBeGreaterThan(1.4); expect(window.distanceAlongWall + window.width / 2).toBeLessThan(2.5);
    expect(editor.getDocument().requireWall('wall').openings).toContain(window); expect(editor.getDocument().elements).not.toContain(window);
    editor.undo(); expect(editor.getDocument()).toBe(before); editor.redo(); expect(editor.getDocument().get('new')).toBe(window);
    expect(() => editor.execute(new AddWindow('new', 'wall'))).toThrow(/Duplicate/);
  });
  it('places explicit dimensions correctly on a diagonal wall and preserves physical position through both codecs', () => {
    const wall = new Wall({ id: 'angled', p1: { x: 1, y: 2 }, p2: { x: 4, y: 6 }, height: 3, thickness: .2, material: 'a_block', openings: [] }, []);
    const editor = new EditorSession(codec.factory); editor.load(new PlanDocument([wall], 3)); editor.execute(new AddWindow('new', wall.id, config));
    expect((editor.getDocument().get('new') as WindowOpening).position).toEqual({ x: 2.2, y: 3.6 });
    const geometry = { ...config, width: 1.6, height: 1.4, floorHeight: .5, distanceAlongWall: 3 };
    editor.execute(new ConfigureWindowGeometry('new', geometry));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const window = codec.decode(encoded).get('new') as WindowOpening;
      expect(window.toData()).toMatchObject(geometry); expect(window.position.x).toBeCloseTo(2.8); expect(window.position.y).toBeCloseTo(4.4);
    }
  });
  it('resizes an imported French window without losing glazing, curtains, frame finish or unknown metadata', () => {
    const raw = rawPlan(); Object.assign(raw.plan.walls.wall.holes.window, { type: 'french_window', frameColor: '#445566', curtainState: 'hidden', finish: { type: 'glass', variant: 'frosted' }, windowDressing: { style: 'blackout', openness: .4 }, vendor: 'keep' });
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(raw)); editor.execute(new ConfigureWindowGeometry('window', config));
    const window = editor.getDocument().require('window') as WindowOpening;
    expect(window.isFrenchWindow).toBe(true); expect(window.toData()).toMatchObject({ ...config, frameColor: '#445566', curtainState: 'hidden', finish: { variant: 'frosted' }, windowDressing: { style: 'blackout', openness: .4 }, rawOpening: { vendor: 'keep' } });
    const legacy = JSON.parse(new LegacyPlanWriter().encode(editor.getDocument()));
    expect(legacy.plan.walls.wall.holes.window).toMatchObject({ width: 120, floor_height: 80, pc: { x: 200, y: 0 }, vendor: 'keep' });
    expect(legacy.plan.walls.wall.holes.window.height).toBeCloseTo(110);
    editor.execute(new RemoveElement(window.id)); expect(editor.getDocument().get(window.id)).toBeUndefined();
    expect(codec.decode(new LegacyPlanWriter().encode(editor.getDocument())).get(window.id)).toBeUndefined(); editor.undo(); expect(editor.getDocument().get(window.id)).toBe(window);
  });
  it.each([
    { width: 0 }, { width: -1 }, { height: 0 }, { height: NaN }, { floorHeight: -.1 }, { floorHeight: 2 }, { distanceAlongWall: .1 }, { distanceAlongWall: 4 }, { width: Infinity },
  ])('rejects unusable geometry atomically: %j', patch => {
    const editor = editorFixture(), before = editor.getDocument();
    expect(() => editor.execute(new ConfigureWindowGeometry('window', { ...config, ...patch }))).toThrow(); expect(editor.getDocument()).toBe(before); expect(editor.history.canUndo).toBe(false);
  });
  it('does not create a window on an occupied or tiny wall and leaves other openings untouched', () => {
    const editor = editorFixture(); editor.execute(new ConfigureWindowGeometry('window', { width: 4, height: 3, floorHeight: 0, distanceAlongWall: 2 }));
    const before = editor.getDocument(); expect(() => editor.execute(new AddWindow('new', 'wall'))).toThrow(/No free space/); expect(editor.getDocument()).toBe(before);
    const wall = before.requireWall('wall'); expect(() => defaultWindowGeometry(new Wall({ ...wall.toData(), p2: { x: .1, y: 0 }, openings: [] }, []))).toThrow(/No free space/);
  });
  it('rebuilds the real wall cut and window dressing on resize/move, and closes the cut on deletion and undo', () => {
    const editor = editorFixture(), pool = new ResourcePool(), picking = new PickRegistry();
    const walls = new WallMeshBuilder({ getMaterial: () => new THREE.MeshStandardMaterial() } as unknown as SurfaceMaterialFactory), openings = new OpeningMeshBuilder();
    const palette = pool.ownTree(Object.assign(new THREE.Object3D(), { material: [...walls.materials.palette, ...openings.palette] })), empty = () => new THREE.Group();
    const factory = new SceneNodeFactory({ wall: { build: w => walls.buildWall(w), applyMaterials: (root, w) => walls.materials.applyMaterials(root, w) }, opening: { build: o => openings.buildOpening(o, editor.getDocument().requireWall(o.wallId)), update: (root, o) => openings.update(root, o) }, column: { build: empty, applyMaterials: () => {} }, room: { build: empty, applyMaterials: () => {} }, furniture: { build: empty }, appearance: { apply: () => {} } }, pool, picking);
    const graph = new PlanSceneGraph(factory, { walls: new THREE.Group(), openings: new THREE.Group(), floors: new THREE.Group(), furniture: new THREE.Group(), fixtures: new THREE.Group() });
    graph.reconcile(editor.getDocument()); editor.subscribe(e => graph.reconcile(e.document));
    const wallRoot = graph.get('wall')!.group, oldWindow = graph.get('window')!.group.children[0];
    const solid = (x: number, y: number) => { wallRoot.updateMatrixWorld(true); return new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(wallRoot, true).some(hit => hit.object instanceof THREE.Mesh && Array.isArray(hit.object.material)); };
    expect(solid(3, 1.2)).toBe(false); expect(solid(2, 1.2)).toBe(true);
    editor.execute(new ConfigureWindowGeometry('window', config));
    expect(graph.get('window')!.group.children[0]).not.toBe(oldWindow); expect(solid(3, 1.2)).toBe(true); expect(solid(2, 1.2)).toBe(false);
    const track = graph.get('window')!.group.getObjectByName('curtain_track_window') as THREE.Mesh; expect((track.geometry as THREE.BoxGeometry).parameters.width).toBeCloseTo(1.5);
    editor.execute(new RemoveElement('window')); expect(graph.get('window')).toBeUndefined(); expect(solid(2, 1.2)).toBe(true);
    editor.undo(); expect(solid(2, 1.2)).toBe(false); graph.dispose(); palette.dispose(); expect(pool.size).toBe(0);
  });
});
