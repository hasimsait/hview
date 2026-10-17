import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { defaultWallCornice } from '../../src/domain/model/WallCornice';
import { WallMeshBuilder } from '../../src/engine/geometry/WallMeshBuilder';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { WallSceneNode } from '../../src/engine/nodes/StructuralSceneNodes';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import type { SurfaceFinishConfig } from '../../src/domain/model/PlanData';
import { EditorSession } from '../../src/application/EditorSession';
import { ConfigureWallCornice, FinishWall, SetWallSkirting } from '../../src/application/commands/StructuralCommands';
import { rawPlan } from './fixtures';

const codec = new PlanCodec();
function setup() {
  const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
  const builder = new WallMeshBuilder({ getMaterial: (f: SurfaceFinishConfig) => new THREE.MeshStandardMaterial({ color: f.color ?? '#ffffff' }) } as unknown as SurfaceMaterialFactory);
  const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.materials.palette }));
  const picking = new PickRegistry(), node = new WallSceneNode(editor.getDocument().requireWall('wall'), { build: w => builder.buildWall(w), applyMaterials: (root, wall) => builder.materials.applyMaterials(root, wall) }, resources, picking);
  editor.subscribe(change => node.reconcile(change.document.requireWall('wall')));
  return { editor, builder, node, picking, resources, dispose: () => { node.dispose(); palette.dispose(); } };
}
function meshes(root: THREE.Object3D) { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) result.push(o); }); return result; }

describe('wall surface targets and architectural trims', () => {
  it('creates skirting on its first finish, recolours it in place, removes it and restores it with undo', () => {
    const { editor, node, picking, resources, dispose } = setup();
    expect(node.group.getObjectByName('baseboard_wall')).toBeUndefined();
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#cc3344' }, 'baseboard'));
    const group = node.group.getObjectByName('baseboard_wall')!; expect(group).toBeDefined();
    const boards = meshes(group); expect(boards.length).toBeGreaterThan(1);
    expect(picking.resolve(boards[0])!.subtarget).toBe('baseboard');
    expect((boards[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('cc3344');
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#3344cc' }, 'baseboard'));
    expect(node.group.getObjectByName('baseboard_wall')).toBe(group);
    expect((boards[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('3344cc');
    editor.execute(new SetWallSkirting('wall', false)); expect(node.group.getObjectByName('baseboard_wall')).toBeUndefined();
    editor.undo(); expect(node.group.getObjectByName('baseboard_wall')).toBeDefined();
    for (const board of meshes(node.group.getObjectByName('baseboard_wall')!)) { const box = new THREE.Box3().setFromObject(board); expect(box.max.x <= .6 + .001 || box.min.x >= 1.4 - .001).toBe(true); }
    dispose(); expect(resources.size).toBe(0);
  });
  it('keeps wall top faces, window sills, end caps and side finishes independent in the actual material groups', () => {
    const { editor, node, dispose } = setup();
    const targets = { A: '#123456', B: '#654321', edge_top: '#cc0000', sill: '#0000cc', edge_start: '#00cc00', edge_end: '#cc00cc' } as const;
    for (const [side, color] of Object.entries(targets)) editor.execute(new FinishWall('wall', { type: 'paint', color }, side as keyof typeof targets));
    node.group.updateMatrixWorld(true);
    const indices = new Set<number>();
    for (const mesh of meshes(node.group).filter(m => Array.isArray(m.material))) {
      const materials = mesh.material as THREE.MeshStandardMaterial[];
      expect(materials.map(m => m.color.getHexString()).slice(0, 5)).toEqual(['123456', '654321', '00cc00', 'cc00cc', 'cc0000']);
      expect(materials[6].color.getHexString()).toBe('0000cc');
      const p = mesh.geometry.attributes.position, index = mesh.geometry.index!;
      for (const group of mesh.geometry.groups) if (group.materialIndex === 4 || group.materialIndex === 6) {
        indices.add(group.materialIndex);
        const centre = new THREE.Vector3(); for (let i = group.start; i < group.start + 3; i++) centre.add(new THREE.Vector3().fromBufferAttribute(p, index.getX(i)));
        centre.divideScalar(3).applyMatrix4(mesh.matrixWorld);
        expect(centre.y).toBeCloseTo(group.materialIndex === 4 ? 3 : .9);
      }
    }
    expect([...indices].sort()).toEqual([4, 6]); dispose();
  });
  it.each(['plain', 'cove', 'stepped', 'ogee'] as const)('builds a full-wall %s cornice at finished ceiling height and beyond the curtain rail', profile => {
    const { editor, builder, dispose } = setup();
    const wall = editor.getDocument().requireWall('wall').withCornice({ ...defaultWallCornice(true), profile, side: 'both' });
    const root = builder.buildWall(wall, undefined, undefined, undefined, { A: 2.6, B: 2.8 });
    for (const side of ['A', 'B'] as const) {
      const mesh = root.getObjectByName(`wall_cornice_wall_${side}`)!;
      const box = new THREE.Box3().setFromObject(mesh);
      expect(box.getSize(new THREE.Vector3()).x).toBeCloseTo(4); expect(box.max.y).toBeCloseTo(side === 'A' ? 2.6 : 2.8);
      expect(box.getSize(new THREE.Vector3()).y).toBeCloseTo(.12); expect(box.getSize(new THREE.Vector3()).z).toBeCloseTo(.12);
      expect(side === 'A' ? box.min.z > .24 : box.max.z < -.24).toBe(true);
    }
    expect(new OpeningMeshBuilder().buildOpening(wall.openings.find(o => o.type === 'window')!, wall).getObjectByName('curtain_pelmet_window')).toBeUndefined(); dispose();
  });
  it('consolidates multiple old window cornices, honours hidden/removed states and never recreates a disabled wall cornice', () => {
    for (const state of ['visible', 'hidden', 'removed'] as const) {
      const raw = rawPlan();
      Object.assign(raw.plan.walls.wall.holes.window, { pelmetState: state });
      Object.assign(raw.plan.walls.wall.holes, { other: { ...raw.plan.walls.wall.holes.window, pc: { x: 200, y: 0 } } });
      const doc = codec.decode(raw), wall = doc.requireWall('wall');
      expect(wall.cornice).toMatchObject({ profile: state === 'removed' ? 'none' : 'cove' });
      expect(!!wall.cornice?.hidden).toBe(state === 'hidden');
      expect(wall.openings.every(o => o.toData().pelmetState === undefined)).toBe(true);
      for (const encoded of [codec.encode(doc), new LegacyPlanWriter().encode(doc)]) expect(codec.decode(encoded).requireWall('wall').cornice).toEqual(wall.cornice);
    }
    const { editor, node, dispose } = setup(); editor.execute(new ConfigureWallCornice('wall', { ...defaultWallCornice(), profile: 'none' }));
    expect(node.group.getObjectByName('wall_cornice_wall_A')).toBeUndefined();
    const restored = codec.decode(new LegacyPlanWriter().encode(editor.getDocument())); expect(restored.requireWall('wall').cornice?.profile).toBe('none'); dispose();
  });
  it('changes cornice finish without recolouring skirting or wall faces, and keeps it through undo and both formats', () => {
    const { editor, node, dispose } = setup(); editor.execute(new SetWallSkirting('wall', true));
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#112233' }, 'A'));
    editor.execute(new FinishWall('wall', { type: 'paint', color: '#aabbcc' }, 'cornice'));
    expect((node.group.getObjectByName('wall_cornice_wall_A') as THREE.Mesh).material).toMatchObject({ color: new THREE.Color('#aabbcc') });
    for (const raw of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const wall = codec.decode(raw).requireWall('wall'); expect(wall.cornice?.finish?.color).toBe('#aabbcc'); expect(wall.finishSideA?.color).toBe('#112233'); expect(wall.finishBaseboard?.color).toBe('#f3f1ea');
    }
    editor.undo(); expect(editor.getDocument().requireWall('wall').cornice?.finish).toBeUndefined(); dispose();
  });
});
