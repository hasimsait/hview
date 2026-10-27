import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { StandardFurniture } from '../../src/domain/elements/Furniture';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { cabinetIssues, validateCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { cabinetLeaves } from '../../src/domain/cabinet/CabinetFronts';

describe('framed wardrobe fronts', () => {
  const codec = new PlanCodec();
  const wardrobe = new StandardFurniture({ id: 'test_wardrobe', displayName: 'Test wardrobe', name: 'cabinet_wardrobe', assetKey: 'cabinet_wardrobe', category: 'storage', dimensions: { x: .96, y: 2.72, z: .75 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0,
    cabinet: { version: 1, panelThickness: .018, backThickness: .006, plinth: { height: .1, setback: .025 }, doors: { count: 2, hinge: 'left', angles: [0, 0] }, panels: [], contents: [],
      frontDetail: { profile: 'framed', handleCentres: .096, pairedDrawerPulls: true, corniceHeight: .085 },
      frontSections: [{ id: 'drawer', bottom: .1, top: .75, opening: 'drawer', doors: { count: 1, hinge: 'left', angles: [0, 0] } }, { id: 'doors', bottom: .75, top: 2.1, opening: 'swing', doors: { count: 2, hinge: 'left', angles: [65, 0] } }, { id: 'upper', bottom: 2.1, top: 2.635, opening: 'swing', doors: { count: 2, hinge: 'left', angles: [0, 0] } }] } });
  it('keeps the framed panels and 96 mm pull fixings on each moving front', () => {
    const root = new FurnitureMeshBuilder(codec.factory.catalog).build(wardrobe);
    const lowerDoor = root.getObjectByName('cabinet_door_1')!;
    expect(lowerDoor.rotation.y).not.toBe(0);
    expect(lowerDoor.children.filter(c => c.userData.section === 'Door 2')).toHaveLength(5);
    const feet = lowerDoor.children.filter(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry);
    expect(feet).toHaveLength(2);
    expect(feet[0].position.distanceTo(feet[1].position)).toBeCloseTo(.096, 6);
    const drawer = root.getObjectByName('cabinet_door_0')!;
    expect(drawer.children.filter(c => c instanceof THREE.Mesh && c.geometry instanceof THREE.TubeGeometry)).toHaveLength(2);
    const crown = root.getObjectByName('cabinet_part_cornice_fascia')!;
    const bounds = new THREE.Box3().setFromObject(crown);
    expect(bounds.min.y).toBeCloseTo(2.635); expect(bounds.max.y).toBeCloseTo(2.72);
  });
  it('rejects non-finite fixing centres and oversized crown heights', () => {
    expect(() => validateCabinet({ ...wardrobe.cabinet!, frontDetail: { ...wardrobe.cabinet!.frontDetail!, handleCentres: NaN } })).toThrow();
    expect(() => validateCabinet({ ...wardrobe.cabinet!, frontDetail: { ...wardrobe.cabinet!.frontDetail!, corniceHeight: .4 } })).toThrow();
  });
  it('loads and exports the photo-fitted working wardrobe with seven lower doors and three drawers', () => {
    const document = codec.decode(readFileSync('public/sample.plan', 'utf8'));
    const fitted = document.elements.filter(e => e instanceof StandardFurniture && e.roomId === '_3h613' && e.cabinet?.frontDetail) as StandardFurniture[];
    expect(fitted).toHaveLength(4);
    const leaves = fitted.flatMap(e => cabinetLeaves(e.cabinet!, e.dimensions));
    expect(leaves.filter(l => !l.drawer && l.bottom < 2.1)).toHaveLength(7);
    expect(leaves.filter(l => l.drawer)).toHaveLength(3);
    expect(fitted.reduce((sum, e) => sum + e.dimensions.x, 0)).toBeCloseTo(3.67);
    expect(fitted.find(e => e.id === '3a3e62a4-bd64-4cf7-a8ab-c1ba56f5f9c9')!.dimensions.x).toBe(1.3);
    for (const item of fitted) expect([...cabinetIssues(item.cabinet!, item.dimensions)]).toEqual([]);
    const reloaded = codec.decode(codec.encode(document));
    for (const item of fitted) expect(reloaded.requireFurniture(item.id).cabinet).toEqual(item.cabinet);
  });
});
