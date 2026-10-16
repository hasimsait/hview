import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import { ELECTRICAL_ASSETS } from '../../src/domain/catalog/ElectricalAssets';
import { HOUSEHOLD_APPLIANCES } from '../../src/domain/catalog/HouseholdAppliances';
import type { AssetDefinition } from '../../src/domain/catalog/AssetDefinition';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import type { FurnitureCategory } from '../../src/domain/model/PlanData';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, FinishFurniture, ReplaceFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
function item(asset: AssetDefinition) {
  return codec.factory.furniture({ id: asset.key, name: asset.key, displayName: asset.name, assetKey: asset.key,
    category: asset.category as FurnitureCategory, dimensions: asset.defaultDimensions,
    position: { x: 1, y: asset.placement?.defaultElevation ?? 0, z: 2 }, rotationY: .7 });
}

describe('electrical fittings and household appliances', () => {
  it.each([...ELECTRICAL_ASSETS, ...HOUSEHOLD_APPLIANCES])('$name has real geometry, bounded dimensions and owned GPU resources', asset => {
    const model = builder.build(item(asset)), bounds = new THREE.Box3().setFromObject(model), dims = asset.defaultDimensions;
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(bounds.min[axis], axis).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -dims[axis] / 2) - .0003);
      expect(bounds.max[axis], axis).toBeLessThanOrEqual((axis === 'y' ? dims[axis] : dims[axis] / 2) + .0003);
    }
    expect(catalog.recipe(asset.key)).toBe(asset.recipe);
    expect(asset.name).not.toMatch(/\b(priz|anahtar|bordo|krem|haki)\b/i);
    const resources = new ResourcePool();
    const palette = resources.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = resources.size, lease = resources.ownTree(model);
    expect(resources.size).toBeGreaterThan(baseline);
    lease.dispose(); expect(resources.size).toBe(baseline);
    palette.dispose(); expect(resources.size).toBe(0);
  });

  it('models recessed socket wells with open pin holes and grounding contacts', () => {
    for (const asset of ELECTRICAL_ASSETS.filter(a => a.electrical?.control.includes('socket'))) {
      const model = builder.build(item(asset)), h = asset.defaultDimensions.y, w = asset.defaultDimensions.x;
      model.updateMatrixWorld(true);
      const bubble = asset.electrical!.series === 'bubble';
      const centers = asset.electrical!.control === 'double_socket' ? [-w * .225, w * .225] : [0];
      for (const x of centers) for (const sign of [-1, 1]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x + (bubble ? sign * h * .11 : 0), h / 2 + (bubble ? 0 : sign * h * .11), 1), new THREE.Vector3(0, 0, -1));
        const hit = ray.intersectObject(model, true).find(hit => hit.object instanceof THREE.Mesh);
        expect(hit?.object.userData.section, asset.key).toBe('Pin Openings');
      }
      const contacts: THREE.Object3D[] = [];
      model.traverse(child => { if (child.userData.section === 'Grounding Contacts') contacts.push(child); });
      expect(contacts).toHaveLength(centers.length * 2);
    }
  });

  it('keeps Bubble frame and insert materials independent and splits double rockers', () => {
    const socket = ELECTRICAL_ASSETS.find(a => a.key === 'vrc_bubble_socket_cream_khaki')!;
    const model = builder.build(item(socket));
    const frame = model.children.find(c => c.userData.section === 'Frame') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const insert = model.children.find(c => c.userData.section === 'Socket Insert') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(frame.material.color.getHexString()).toBe('e9dec5');
    expect(insert.material.color.getHexString()).toBe('555541');
    expect(frame.material).not.toBe(insert.material);
    const double = builder.build(item(ELECTRICAL_ASSETS.find(a => a.key === 'vrc_bubble_double_switch_burgundy')!));
    expect(double.children.filter(c => c.userData.section.includes('Rocker'))).toHaveLength(2);
  });

  it('restores all saved Bubble variants to thin 10 cm circles in legacy and canonical plans', () => {
    const bubble = ELECTRICAL_ASSETS.filter(asset => asset.electrical?.series === 'bubble');
    const old = bubble.map(asset => ({ ...item(asset).toData(), dimensions: { x: .15, y: .1, z: .1 },
      sectionFinishes: { frame: { type: 'paint' as const, color: '#663344' } } }));
    const raw = rawPlan();
    const canonical = { schemaVersion: 1, document: { version: 3, totalHeight: 3,
      elements: old.map(data => ({ kind: 'furniture.standard', data })) } };
    const legacy = { plan: { ...raw.plan, items: Object.fromEntries(old.map(data => [data.id,
      { name: data.assetKey, assetKey: data.assetKey, dimensions: data.dimensions, position: data.position,
        pc: { x: 100, y: 200 }, rotationY: data.rotationY, sectionFinishes: data.sectionFinishes }])) } };
    for (const input of [legacy, canonical]) {
      const doc = codec.decode(input);
      for (const original of old) {
        const corrected = doc.requireFurniture(original.id);
        expect(corrected.dimensions).toEqual({ x: .1, y: .1, z: .025 });
        expect(corrected.rotationY).toBe(original.rotationY);
        expect(corrected.position.y).toBe(original.position.y);
        expect(corrected.sectionFinishes?.frame.color).toBe('#663344');
        const normal = new THREE.Vector3(Math.sin(original.rotationY), 0, Math.cos(original.rotationY));
        const back = new THREE.Vector3().copy(corrected.position).addScaledVector(normal, -.025 / 2);
        const oldBack = new THREE.Vector3().copy(original.position).addScaledVector(normal, -.1 / 2);
        expect(back.distanceTo(oldBack)).toBeLessThan(1e-9);
        const frame = builder.build(corrected).children.find(child => child.userData.section === 'Frame') as THREE.Mesh;
        const bounds = new THREE.Box3().setFromObject(frame), size = bounds.getSize(new THREE.Vector3());
        expect(size.x).toBeCloseTo(.1, 5); expect(size.y).toBeCloseTo(.1, 5);
        expect(size.z).toBeCloseTo(.025, 5);
        // A circular annular face fits within a 5 cm radius at every vertex.
        const vertices = frame.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) expect(Math.hypot(vertices.getX(i), vertices.getY(i))).toBeLessThanOrEqual(.050001);
      }
      const reloaded = codec.decode(codec.encode(doc));
      for (const corrected of doc.furniture) expect(reloaded.requireFurniture(corrected.id).toData()).toEqual(corrected.toData());
    }
  });

  it('replaces rectangular outlets with fixed Bubble proportions and keeps movement, finishes and undo available', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    const asset = ELECTRICAL_ASSETS[3];
    const original = { ...item(asset).toData(), dimensions: { x: .15, y: .1, z: .1 } };
    editor.execute(new AddFurniture(original));
    editor.execute(new ReplaceFurniture(original.id, 'vrc_bubble_double_switch_burgundy'));
    expect(editor.getDocument().requireFurniture(original.id).dimensions).toEqual({ x: .1, y: .1, z: .025 });
    editor.execute(new TransformFurniture(original.id, { x: 2, y: 1.2, z: 3 }, .4, { x: .15, y: .1, z: .1 }));
    const moved = editor.getDocument().requireFurniture(original.id);
    expect(moved.position).toEqual({ x: 2, y: 1.2, z: 3 });
    expect(moved.rotationY).toBe(.4);
    expect(moved.dimensions).toEqual({ x: .1, y: .1, z: .025 });
    editor.undo(); editor.undo();
    expect(editor.getDocument().requireFurniture(original.id).toData()).toEqual(original);
  });

  it('upgrades the old cabinet-shaped appliances in legacy and canonical plans while retaining identity and placement', () => {
    const old = [
      { ...item(HOUSEHOLD_APPLIANCES[0]).toData(), assetKey: 'robot-cleaner', dimensions: { x: .35, y: .6, z: .46 }, category: 'decor' as const },
      { ...item(HOUSEHOLD_APPLIANCES[1]).toData(), assetKey: 'bactericidal_air_recirculator', dimensions: { x: .29, y: .6, z: .31 }, category: 'decor' as const },
    ];
    const raw = rawPlan();
    const rawItems = Object.fromEntries(old.map(data => [data.id, { name: data.assetKey, assetKey: data.assetKey, pc: { x: 100, y: 200 }, position: data.position, rotationY: data.rotationY, dimensions: data.dimensions }]));
    const canonical = { schemaVersion: 1, document: { version: 3, totalHeight: 3, elements: old.map(data => ({ kind: 'furniture.standard', data })) } };
    for (const input of [{ plan: { ...raw.plan, items: rawItems } }, canonical]) {
      const doc = codec.decode(input), vacuum = doc.requireFurniture(old[0].id), purifier = doc.requireFurniture(old[1].id);
      expect(vacuum).toMatchObject({ assetKey: 'robot_vacuum', category: 'appliance', dimensions: { x: .35, y: .15, z: .46 }, position: old[0].position, rotationY: old[0].rotationY });
      expect(purifier).toMatchObject({ assetKey: 'air_purifier', category: 'appliance', dimensions: old[1].dimensions });
      expect(builder.build(vacuum).getObjectByName(`dock_${vacuum.id}`)).toBeTruthy();
      expect(builder.build(purifier).getObjectByName(`air_intake_${purifier.id}`)).toBeTruthy();
    }
    // An intentional modern height or a custom-sized legacy model remains editable.
    expect(codec.factory.furniture({ ...old[0], assetKey: 'robot_vacuum' }).dimensions.y).toBe(.6);
    expect(codec.factory.furniture({ ...old[0], dimensions: { x: .5, y: .6, z: .5 } }).dimensions.y).toBe(.6);
  });

  it('uses a low robot body with a dock and a white cylindrical purifier with hundreds of intake openings', () => {
    const vacuum = builder.build(item(HOUSEHOLD_APPLIANCES[0]));
    const body = vacuum.children.find(c => c.userData.section === 'Body') as THREE.Mesh;
    expect(body.geometry.type).toBe('CylinderGeometry');
    expect(new THREE.Box3().setFromObject(body).max.y).toBeLessThan(.1);
    expect(vacuum.children.some(c => c.userData.section === 'Charging Contacts')).toBe(true);
    const purifier = builder.build(item(HOUSEHOLD_APPLIANCES[1]));
    const housing = purifier.children.find(c => c.userData.section === 'Housing') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(housing.geometry.type).toBe('CylinderGeometry');
    expect(housing.material.color.getHexString()).toBe('f3f1eb');
    const intake = purifier.getObjectByName('air_intake_air_purifier') as THREE.Mesh;
    expect(intake.geometry.attributes.position.count).toBeGreaterThan(5000);
    expect(intake.children).toHaveLength(0); // No duplicate outlines over the perforations.
  });

  it('persists socket variants, part colours, replacements and undo in both export formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const asset of [...ELECTRICAL_ASSETS, ...HOUSEHOLD_APPLIANCES]) editor.execute(new AddFurniture(item(asset).toData()));
    const id = 'viko_karre_socket_white';
    editor.execute(new ReplaceFurniture(id, 'vrc_bubble_socket_cream_khaki'));
    editor.execute(new FinishFurniture(id, { type: 'paint', color: '#663344' }, 'Frame'));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      expect(codec.decode(encoded).requireFurniture(id)).toMatchObject({ assetKey: 'vrc_bubble_socket_cream_khaki', category: 'fixture', sectionFinishes: { frame: { color: '#663344' } } });
    }
    editor.undo(); editor.undo();
    expect(editor.getDocument().requireFurniture(id).assetKey).toBe('viko_karre_socket_white');
  });
});
