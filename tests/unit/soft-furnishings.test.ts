import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SOFT_FURNISHINGS } from '../../src/domain/catalog/SoftFurnishings';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { WindowOpening } from '../../src/domain/elements/Opening';
import { WINDOW_DRESSING_STYLES } from '../../src/domain/model/WindowDressing';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, FinishFurniture, SetWindowCoveringOpen } from '../../src/application/commands/FurnitureCommands';
import { ConfigureWindowDressing, SetWindowCurtains } from '../../src/application/commands/StructuralCommands';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { OpeningSceneNode } from '../../src/engine/nodes/StructuralSceneNodes';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import type { ViewportSettings } from '../../src/core/types/services';
import { rawPlan } from './fixtures';
import { createTextileMaterial } from '../../src/engine/materials/TextileMaterial';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
function item(key: string, scale = 1) {
  const a = catalog.get(key)!;
  return codec.factory.furniture({ id: key, name: key, assetKey: key, displayName: a.name, category: 'decor',
    position: { x: 0, y: 0, z: 0 }, rotationY: 0, dimensions: { x: a.defaultDimensions.x * scale, y: a.defaultDimensions.y * scale, z: a.defaultDimensions.z * scale } });
}
function meshes(root: THREE.Object3D, section?: string) { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh && (!section || o.userData.section === section)) result.push(o); }); return result; }

describe('soft furnishings', () => {
  it('generates neutral opaque weave grain locally without byte overflow', () => {
    const material = createTextileMaterial(), texture = material.map as THREE.DataTexture, pixels = texture.image.data!;
    expect(texture.repeat.toArray()).toEqual([16, 16]);
    for (let i = 0; i < pixels.length; i += 4) { expect(pixels[i]).toBeGreaterThan(200); expect(pixels[i + 3]).toBe(255); }
    material.dispose(); texture.dispose();
  });
  it('registers distinct items across all requested textile categories', () => {
    expect(SOFT_FURNISHINGS).toHaveLength(34); expect(new Set(SOFT_FURNISHINGS.map(a => a.key)).size).toBe(34);
    expect(new Set(SOFT_FURNISHINGS.map(a => a.collection)).size).toBe(9);
    for (const a of SOFT_FURNISHINGS) {
      expect(catalog.recipe(a.key)).toBe('soft_furnishing');
      expect(a.source?.dimensions).toBe('reference'); expect(a.capabilities?.resizable).toBe(true);
    }
  });
  it.each(SOFT_FURNISHINGS)('$name stays in its metric envelope at multiple sizes', a => {
    for (const scale of [.65, 1, 1.4]) {
      const entity = item(a.key, scale), root = builder.build(entity), bounds = new THREE.Box3().setFromObject(root);
      expect(meshes(root).length).toBeGreaterThan(0);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(bounds.min[axis], `${a.key} minimum ${axis}`).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -entity.dimensions[axis] / 2) - .002);
        expect(bounds.max[axis], `${a.key} maximum ${axis}`).toBeLessThanOrEqual((axis === 'y' ? entity.dimensions.y : entity.dimensions[axis] / 2) + .002);
      }
      if (a.softFurnishing!.style === 'venetian') expect(meshes(root, 'Slats').length).toBeGreaterThan(5);
      else expect(meshes(root).some(m => m.userData.isTextile)).toBe(true);
    }
  });
  it('keeps sheers translucent when recoloured and leaves blackout panels opaque', () => {
    const resources = new ResourcePool();
    const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const finish = new THREE.MeshStandardMaterial({ color: '#e5c9b0' });
    finish.defines = { ...finish.defines, PROJECTION_LOCAL: 1, IS_STRETCHED: 1 };
    const appearance = new FurnitureAppearance({ getMaterial: () => finish } as unknown as SurfaceMaterialFactory, resources,
      () => ({ spotLightIntensity: 1, chandelierIntensity: 1 } as ViewportSettings), () => undefined);
    const entity = item('textile_curtain_layered').withFinish({ type: 'paint', color: '#e5c9b0' }), root = builder.build(entity);
    appearance.apply(root, entity);
    const sheer = meshes(root, 'Sheer Fabric'), blackout = meshes(root, 'Blackout Fabric');
    expect(sheer).toHaveLength(2); expect(blackout).toHaveLength(2);
    expect(sheer.every(m => (m.material as THREE.Material).opacity === .28 && (m.material as THREE.Material).depthWrite === false)).toBe(true);
    expect(sheer.every(m => (m.material as THREE.MeshStandardMaterial).defines?.PROJECTION_LOCAL === 1 && (m.material as THREE.MeshStandardMaterial).defines?.IS_STRETCHED === 1)).toBe(true);
    expect(blackout.every(m => (m.material as THREE.Material).opacity === 1)).toBe(true);
    const frontOfSheer = Math.max(...sheer.map(mesh => new THREE.Box3().setFromObject(mesh).max.z));
    const backOfBlackout = Math.min(...blackout.map(mesh => new THREE.Box3().setFromObject(mesh).min.z));
    expect(frontOfSheer).toBeLessThan(backOfBlackout);
    expect(finish.opacity).toBe(1); expect(finish.side).toBe(THREE.FrontSide);
    resources.ownTree(root).dispose(); palette.dispose(); expect(resources.size).toBe(0);
  });
  it('opens curtains from the centre and raises blinds toward a stationary headrail', () => {
    const curtain = item('textile_curtain_blackout'), blind = item('textile_blind_roman');
    for (const entity of [curtain, blind]) {
      const closed = builder.build(entity.withWindowCoveringOpen(0)), open = builder.build(entity.withWindowCoveringOpen(1));
      const section = entity === curtain ? 'Blackout Fabric' : 'Fabric';
      const firstClosed = new THREE.Box3().setFromObject(meshes(closed, section)[0]), firstOpen = new THREE.Box3().setFromObject(meshes(open, section)[0]);
      if (entity === curtain) expect(firstOpen.max.x - firstOpen.min.x).toBeLessThan((firstClosed.max.x - firstClosed.min.x) * .4);
      else {
        expect(firstOpen.min.y).toBeGreaterThan(firstClosed.min.y + blind.dimensions.y * .6);
        expect(new THREE.Box3().setFromObject(meshes(open, 'Headrail')[0]).max.y).toBeCloseTo(blind.dimensions.y);
      }
    }
  });
  it('fits six window dressings on either wall side, validates inputs and retains settings in both formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    const window = editor.getDocument().get('window') as WindowOpening, wall = editor.getDocument().requireWall('wall'), openings = new OpeningMeshBuilder();
    for (const style of WINDOW_DRESSING_STYLES) {
      editor.execute(new ConfigureWindowDressing(window.id, { style, openness: .4, color: '#998877', liningColor: '#efeadf' }));
      const updated = editor.getDocument().get(window.id) as WindowOpening;
      for (const side of [-1, 1] as const) {
        const root = openings.buildOpening(updated, wall, { ceilingHeight: 3, interiorSide: side }), dressing = root.getObjectByName('curtains_window')!;
        const bounds = new THREE.Box3().setFromObject(dressing);
        expect(bounds.max.y).toBeLessThanOrEqual(3.001);
        expect(side === -1 ? bounds.max.z < -wall.thickness / 2 : bounds.min.z > wall.thickness / 2).toBe(true);
      }
      for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) expect((codec.decode(encoded).get(window.id) as WindowOpening).windowDressing).toEqual(updated.windowDressing);
    }
    editor.undo(); expect((editor.getDocument().get(window.id) as WindowOpening).windowDressing?.style).toBe('roman');
    expect(() => editor.execute(new ConfigureWindowDressing('door', { style: 'sheer' }))).toThrow('Expected a window');
    expect(() => window.withWindowDressing({ style: 'sheer', openness: 2 })).toThrow('between 0 and 1');
    expect(() => window.withWindowDressing({ style: 'blackout', color: 'red' })).toThrow('hex color');
  });
  it('rebuilds window dressing geometry through hide, delete, change and restore without leaks', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    const original = editor.getDocument().get('window') as WindowOpening, wall = editor.getDocument().requireWall('wall'), openings = new OpeningMeshBuilder();
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: openings.palette }));
    const baseline = resources.size, node = new OpeningSceneNode(original, { build: o => openings.buildOpening(o, wall), update: (root, o) => openings.update(root, o) }, resources, new PickRegistry());
    for (const style of WINDOW_DRESSING_STYLES) {
      node.reconcile(original.withWindowDressing({ style, openness: .7 }));
      node.reconcile(original.withWindowDressing({ style, openness: .2 }).withCurtainState('hidden'));
      expect(node.group.getObjectByName('curtains_window')?.visible).toBe(false);
      node.reconcile(original.withCurtainState('removed')); expect(node.group.getObjectByName('curtains_window')).toBeUndefined();
    }
    node.dispose(); expect(resources.size).toBe(baseline); palette.dispose(); expect(resources.size).toBe(0);
    editor.execute(new SetWindowCurtains('window', 'removed'));
    editor.execute(new ConfigureWindowDressing('window', { style: 'sheer' }));
    expect((editor.getDocument().get('window') as WindowOpening).curtainState).toBe('removed');
    editor.execute(new SetWindowCurtains('window', 'visible'));
    expect((editor.getDocument().get('window') as WindowOpening).curtainState).toBe('visible');
  });
  it('retains independent textile finishes and covering positions in both formats and rejects invalid controls', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const a of SOFT_FURNISHINGS) editor.execute(new AddFurniture(item(a.key).toData()));
    editor.execute(new SetWindowCoveringOpen('textile_curtain_layered', .85));
    editor.execute(new FinishFurniture('textile_curtain_layered', { type: 'fabric', color: '#496657', variant: 'linen_weave' }, 'Blackout Fabric'));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded).requireFurniture('textile_curtain_layered');
      expect(restored.windowCoveringOpen).toBe(.85); expect(restored.sectionFinishes?.blackout_fabric.color).toBe('#496657');
    }
    expect(() => editor.execute(new SetWindowCoveringOpen('textile_rug_border', .5))).toThrow('curtain or blind');
    expect(() => editor.execute(new SetWindowCoveringOpen('textile_blind_roller', NaN))).toThrow('between 0 and 1');
  });
  it('releases cloth geometry, binding, fringe and shared weave textures', () => {
    const resources = new ResourcePool(), palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette })), baseline = resources.size;
    for (const a of SOFT_FURNISHINGS) { resources.ownTree(builder.build(item(a.key))).dispose(); expect(resources.size).toBe(baseline); }
    palette.dispose(); expect(resources.size).toBe(0);
  });
});
