import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FinishFurniture } from '../src/application/commands/FurnitureCommands';
import { FinishColumn, FinishFloor, FinishWall } from '../src/application/commands/StructuralCommands';
import { normalizeSurfaceLayer, preserveSurfaceLayer } from '../src/core/types/surfaceLayer';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { SurfaceMaterialFactory } from "../src/engine/materials/SurfaceMaterialFactory";
import { createEditor } from './support/editor';

test('higher signed layers receive stronger depth bias and keep depth testing', () => {
  const service = new SurfaceMaterialFactory();
  const layers = [-3, -1, 0, 1, 7];
  const materials = layers.map((layer) => service.getMaterial({ type: 'paint', color: '#ff0000', layer }));
  for (let i = 0; i < layers.length; i++) {
    assert.equal(materials[i].polygonOffset, layers[i] !== 0);
    assert.equal(materials[i].depthTest, true);
    assert.equal(materials[i].depthWrite, true);
    assert.equal(materials[i].polygonOffsetFactor, -(i - 2));
    assert.equal(materials[i].polygonOffsetUnits, -4 * (i - 2));
    if (i) assert.ok(materials[i].polygonOffsetUnits < materials[i - 1].polygonOffsetUnits);
  }
});

test('identical finishes on different layers do not share mutable materials', () => {
  const service = new SurfaceMaterialFactory();
  const base = service.getMaterial({ type: 'paint', color: '#ff0000' });
  const higher = service.getMaterial({ type: 'paint', color: '#ff0000', layer: 2 });
  assert.notEqual(base, higher);
  assert.equal(base.polygonOffset, false);
  assert.equal(higher.polygonOffsetUnits, -4);
  assert.equal(service.getMaterial({ type: 'paint', color: '#ff0000', layer: 0 }), base);
});

test('layer normalization accepts negative integers and bounds invalid imported values', () => {
  assert.equal(normalizeSurfaceLayer(), 0);
  assert.equal(normalizeSurfaceLayer(NaN), 0);
  assert.equal(normalizeSurfaceLayer(Infinity), 0);
  assert.equal(normalizeSurfaceLayer(-7), -7);
  assert.equal(normalizeSurfaceLayer(2.5), 2);
  assert.equal(normalizeSurfaceLayer(1e9), 1000);
  assert.equal(normalizeSurfaceLayer(-1e9), -1000);
});

test('changing color or finish type preserves layer unless explicitly changed', () => {
  const current = { type: 'paint' as const, color: '#ff0000', layer: -2 };
  assert.equal(preserveSurfaceLayer({ type: 'tile', variant: 'square' }, current).layer, -2);
  assert.equal(preserveSurfaceLayer({ type: 'paint', color: '#00ff00', layer: 0 }, current).layer, 0);
});

test('sparse layer numbers produce small adjacent depth offsets', () => {
  const service = new SurfaceMaterialFactory();
  const low = service.getMaterial({ type: 'paint', layer: -1000 });
  const high = service.getMaterial({ type: 'paint', layer: 1000 });
  assert.equal(low.polygonOffsetUnits, 4);
  assert.equal(high.polygonOffsetUnits, -4);
  const middle = service.getMaterial({ type: 'paint', layer: 500 });
  assert.equal(middle.polygonOffsetUnits, -4);
  assert.equal(high.polygonOffsetUnits, -8);
  assert.equal(low.polygonOffsetUnits, 4);
});

test('layers on wall faces, edges, floors, columns and furniture survive export/reload', () => {
  const parser = new PlanCodec();
  const manager = createEditor(undefined, parser);
  manager.documents.load({
    plan: {
      walls: { w: { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, depth: 10, height: 270 } },
      rooms2: { r: { title: 'Room', area: 4, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }] } },
      columns: [{ id: 'c', name: 'Column', type: 'column', width: 0.2, depth: 0.2, worldPos: { x: 1, y: 0, z: 1 }, rotationY: 0 }],
      items: { f: { name: 'chair', pc: { x: 50, y: 50 } } },
    }
  });
  const finish = { type: 'paint' as const, color: '#ff0000' };
  manager.execute(new FinishWall('w', { ...finish, layer: 1 }, 'A'));
  manager.execute(new FinishWall('w', { ...finish, layer: -1 }, 'B'));
  manager.execute(new FinishWall('w', { ...finish, layer: 3 }, 'edge_top'));
  manager.execute(new FinishFloor('r', { ...finish, layer: 4 }));
  manager.execute(new FinishColumn('c', { ...finish, layer: 5 }, 'front'));
  manager.execute(new FinishFurniture('f', { ...finish, layer: 6 }));
  manager.execute(new FinishFurniture('f', { ...finish, layer: 7 }, 'wood'));
  const loaded = parser.decode(manager.legacy.encode(manager.getDocument()));
  assert.equal(loaded.walls[0].finishSideA?.layer, 1);
  assert.equal(loaded.walls[0].finishSideB?.layer, -1);
  assert.equal(loaded.walls[0].finishEdgeTop?.layer, 3);
  assert.equal(loaded.rooms[0].floorFinish?.layer, 4);
  assert.equal(loaded.columns.length, 1);
  assert.equal(loaded.columns.find(column => column.id === 'c')?.finishFront?.layer, 5);
  assert.equal(loaded.furniture[0].finish?.layer, 6);
  assert.equal(loaded.furniture[0].sectionFinishes?.wood.layer, 7);
  assert.equal(manager.isDirty, true);
});
