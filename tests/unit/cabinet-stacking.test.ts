import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cabinetIssues, contentDependsOn, contentSupportRoot, defaultCabinet, removeCabinetPart, resolveContent, resolveContents, settleContent, stackContent, validateCabinet, type CabinetContent } from '../../src/domain/cabinet/CabinetLayout';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { CABINET_FIT_OBJECTS } from '../../src/domain/catalog/CabinetFitObjects';

const size = { x: .6, y: 1.9, z: .5 };
const roll: CabinetContent = { id: 'roll', name: 'Toilet Paper Roll', assetKey: 'fit_toilet_roll', dimensions: { x: .12, y: .1, z: .12 }, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId: 'base' };
function layout() { return { ...defaultCabinet({ dimensions: size, assetKey: 'cabinet_tall_single' }, 1), panels: [], contents: [structuredClone(roll)] }; }

describe('cabinet content stacking', () => {
  it('checks the full 256-object limit without repeatedly reading resolved parent positions', () => {
    let reads = 0;
    const c = { ...layout(), contents: Array.from({ length: 256 }, (_, index) => ({ ...roll, id: `roll_${index}`, supportId: index ? `roll_${index - 1}` : 'base', dimensions: { x: .1, y: .005, z: .1 }, get position() { reads++; return { x: 0, y: 0, z: 0 }; } })) };
    expect(cabinetIssues(c, size).size).toBe(0);
    expect(reads).toBeLessThanOrEqual(256 * 3);
    const boxes = resolveContents(c, size);
    expect(boxes.get('roll_255')!.position.y).toBeCloseTo(1.275);
    c.contents[0] = { ...c.contents[0], position: { x: 0, y: .02, z: 0 } };
    expect(resolveContents(c, size).get('roll_255')!.position.y).toBeCloseTo(1.295);
    expect(cabinetIssues(c, size).get('roll_0')).toContain('Unsupported');
  });

  it('rejects a support cycle during bulk resolution', () => {
    const c = stackContent(layout(), 'roll', ['second']);
    c.contents[0].supportId = 'second';
    expect(() => resolveContents(c, size)).toThrow('Circular cabinet stack');
  });
  it('stacks three independent rolls in contact, follows a moved shelf and persists the chain', () => {
    let c = stackContent(layout(), 'roll', ['second', 'third']);
    expect(c.contents.map(o => resolveContent(c, size, o).position.y)).toEqual([0, .1, .2]);
    expect(cabinetIssues(c, size).size).toBe(0);
    c = { ...c, panels: [{ id: 'shelf', name: 'Shelf', kind: 'shelf', at: .5, start: 'left', end: 'right', depth: { mode: 'fit', value: .02 } }], contents: c.contents.map(o => o.id === 'roll' ? { ...o, supportId: 'shelf' } : o) };
    expect(resolveContent(c, size, c.contents[2]).position.y).toBeCloseTo(.718);
    c.panels[0].at = .8;
    expect(resolveContent(c, size, c.contents[2]).position.y).toBeCloseTo(1.018);
    const codec = new PlanCodec(), entity = codec.factory.furniture({ id: 'cabinet', name: 'cabinet', displayName: 'Cabinet', assetKey: 'cabinet_tall_single', category: 'storage', dimensions: size, position: { x: 0, y: 0, z: 0 }, rotationY: 0, cabinet: c });
    const restored = codec.decode(codec.encode(new PlanDocument([entity], 2.7))).requireFurniture('cabinet').cabinet!;
    expect(restored.contents).toEqual(c.contents);
    expect(resolveContent(restored, size, restored.contents[2]).position.y).toBeCloseTo(1.018);
  });

  it('drops another object onto a roll and never attaches an object to itself or its descendants', () => {
    const c = stackContent(layout(), 'roll', ['second', 'third']);
    const placed = settleContent(c, size, { ...roll, id: 'fourth' }, { x: .02, y: .4, z: .02 });
    expect(placed.supportId).toBe('third');
    expect(resolveContent(c, size, placed).position.y).toBeCloseTo(.3);
    expect(settleContent(c, size, c.contents[0], { x: .02, y: .5, z: .02 }).supportId).toBe('base');
    expect(contentDependsOn(c, 'third', 'roll')).toBe(true);
    expect(() => validateCabinet({ ...c, contents: c.contents.map(o => o.id === 'roll' ? { ...o, supportId: 'third' } : o) })).toThrow('Circular');
  });

  it('does not treat empty corners of a rotated object bounding box as support', () => {
    const c = layout(); c.contents[0].rotationY = Math.PI / 4;
    const tiny = { ...roll, id: 'tiny', dimensions: { x: .01, y: .02, z: .01 } };
    expect(settleContent(c, size, tiny, { x: .02, y: .1, z: .02 }).supportId).toBe('base');
  });

  it('preserves absolute positions after removing a support and flags the floating remainder', () => {
    const c = stackContent(layout(), 'roll', ['second', 'third']);
    const next = removeCabinetPart(c, size, 'roll');
    validateCabinet(next);
    expect(next.contents[0].supportId).toBeUndefined();
    expect(resolveContent(next, size, next.contents[1]).position.y).toBeCloseTo(.2);
    expect(cabinetIssues(next, size).get('second')).toContain('Unsupported');
    expect(cabinetIssues(c, { ...size, y: .28 }).get('third')).toContain('Outside usable interior');
  });

  it('inherits basket attachment through a stack so all items move with the tilt-out front', () => {
    const c = defaultCabinet({ dimensions: size, assetKey: 'cabinet_laundry_tiltout' }, 1);
    c.contents = [{ ...roll, supportId: 'basket_lower_0' }];
    const stacked = stackContent(c, 'roll', ['second']);
    expect(contentSupportRoot(stacked, stacked.contents[1])).toBe('basket_lower_0');
  });

  it('builds the requested clothing piles with finite geometry inside their advertised dimensions', () => {
    const codec = new PlanCodec(), builder = new FurnitureMeshBuilder();
    const keys = ['fit_folded_tshirts_5', 'fit_folded_sweatshirts_5', 'fit_folded_pants_3', 'fit_folded_towels_5', 'fit_toilet_rolls_3'];
    for (const key of keys) {
      const asset = CABINET_FIT_OBJECTS.find(a => a.key === key)!;
      const entity = codec.factory.furniture({ id: key, name: key, displayName: asset.name, assetKey: key, category: 'decor', dimensions: asset.defaultDimensions, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
      const model = builder.build(entity), bounds = new THREE.Box3().setFromObject(model), actual = bounds.getSize(new THREE.Vector3());
      for (const axis of ['x', 'y', 'z'] as const) { expect(Number.isFinite(actual[axis])).toBe(true); expect(actual[axis]).toBeGreaterThan(0); expect(actual[axis]).toBeLessThanOrEqual(asset.defaultDimensions[axis] + .001); }
    }
  });
});
