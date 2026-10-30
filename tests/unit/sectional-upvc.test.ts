import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { WindowOpening } from '../../src/domain/elements/Opening';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { OpeningMeshBuilder } from '../../src/engine/geometry/OpeningMeshBuilder';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { rawPlan } from './fixtures';

const codec = new PlanCodec(), factory = codec.factory;

describe('complete L-shaped sofa', () => {
  it.each(['left', 'right'])('joins the %s chaise to two seats with arms only at the outer edges', side => {
    const asset = factory.catalog.get(`sofa_sectional_${side}`)!;
    const item = factory.furniture({ id: 'sofa', name: asset.key, displayName: asset.name, assetKey: asset.key, category: 'seating', dimensions: { x: 2.65, y: .9, z: 1.73 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const root = new FurnitureMeshBuilder(factory.catalog).build(item);
    const arms: THREE.Mesh[] = [], seats: THREE.Mesh[] = [];
    root.traverse(part => { if (part instanceof THREE.Mesh) { if (part.userData.section === 'Armrests') arms.push(part); if (part.userData.section === 'Seat') seats.push(part); } });
    expect(arms).toHaveLength(2); expect(seats).toHaveLength(3);
    for (const arm of arms) expect(Math.abs(arm.position.x)).toBeGreaterThan(item.dimensions.x / 2 - .15);
    const chaise = root.getObjectByName('sectional_chaise_cushion')!;
    expect(Math.sign(chaise.position.x)).toBe(side === 'left' ? -1 : 1);
    const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(2.65); expect(size.y).toBeCloseTo(.9); expect(size.z).toBeCloseTo(1.73);
    expect(bounds.min.y).toBeCloseTo(0);
    const cushions = seats.map(seat => new THREE.Box3().setFromObject(seat)).sort((a, b) => a.min.x - b.min.x);
    for (let i = 1; i < cushions.length; i++) expect(cushions[i].min.x - cushions[i - 1].max.x).toBeLessThan(.04);
    for (const encoded of [codec.encode(new PlanDocument([item])), new LegacyPlanWriter().encode(new PlanDocument([item]))]) {
      const restored = codec.decode(encoded).requireFurniture(item.id); expect(restored.assetKey).toBe(item.assetKey); expect(restored.dimensions).toEqual(item.dimensions);
    }
  });
});

describe('two-sash side-hung uPVC windows', () => {
  it.each([['window', 1.15, 1.42, .85], ['window', 1.4, 1.5, .85], ['french_window', 1.98, 2.5, 0]] as const)('has two separately glazed sashes and a fixed centre at %s width %s', (type, width, height, floorHeight) => {
    const doc = codec.decode(rawPlan()), source = doc.get('window') as WindowOpening;
    const window = new WindowOpening({ ...source.toData(), type, width, height, floorHeight, curtainState: 'removed' });
    const builder = new OpeningMeshBuilder(), root = builder.buildOpening(window, doc.requireWall(window.wallId));
    const panes: THREE.Mesh[] = []; root.traverse(part => { if (part instanceof THREE.Mesh && part.userData.isGlazing) panes.push(part); });
    expect(panes).toHaveLength(2); expect(panes.map(p => p.userData.hingeSide)).toEqual(['left', 'right']);
    expect(panes[0].position.x).toBeLessThan(0); expect(panes[1].position.x).toBeGreaterThan(0);
    const mullion = root.getObjectByName('windowFixedMullion_window') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(mullion.position.x).toBe(0); expect(mullion.material.metalness).toBe(0); expect(mullion.material.color.getHexString()).toBe('f5f4ef');
    const frame = root.getObjectByName('windowFrame_window')!;
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3(); frame.children.filter(part => !part.name.startsWith('windowSill')).forEach(part => bounds.union(new THREE.Box3().setFromObject(part)));
    expect(bounds.min.y).toBeCloseTo(floorHeight); expect(bounds.max.y).toBeCloseTo(floorHeight + height);
    expect(builder.interactionTarget(root)).toBeUndefined();
    const before = panes.map(p => p.position.clone()); builder.update(root, new WindowOpening({ ...window.toData(), openAngle: 90 }));
    expect(panes.map(p => p.position)).toEqual(before); // The legacy door angle must not slide a window sash.
    for (const pane of panes) { const mat = pane.material as THREE.MeshPhysicalMaterial; expect(mat.transmission).toBe(0); expect(mat.opacity).toBeLessThan(.3); expect(mat.depthWrite).toBe(false); }
  });
  it('updates both glazing panes and the frame without rebuilding or recolouring a neighbouring window', () => {
    const doc = codec.decode(rawPlan()), window = doc.get('window') as WindowOpening, wall = doc.requireWall(window.wallId);
    const glass = new THREE.MeshStandardMaterial({ color: '#ddeeff', opacity: .2, transparent: true });
    const factory = { getMaterial: (finish: { type: string; color?: string }) => finish.type === 'glass' ? glass : new THREE.MeshStandardMaterial({ color: finish.color }) } as unknown as SurfaceMaterialFactory;
    const builder = new OpeningMeshBuilder(factory), root = builder.buildOpening(window, wall), other = builder.buildOpening(window, wall);
    const left = root.getObjectByName('windowGlass_left_window') as THREE.Mesh, right = root.getObjectByName('windowGlass_right_window') as THREE.Mesh, geometry = left.geometry;
    builder.update(root, window.withFinish({ type: 'glass', color: '#ddeeff' }).withFrameColor('#4a4540') as WindowOpening);
    expect(left.material).toBe(glass); expect(right.material).toBe(glass); expect(left.geometry).toBe(geometry);
    expect(((root.getObjectByName('windowFixedMullion_window') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString()).toBe('4a4540');
    expect(((other.getObjectByName('windowFixedMullion_window') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString()).toBe('f5f4ef');
    builder.update(root, window); expect(left.material).toBe(right.material); expect(left.material).not.toBe(glass);
  });
});
