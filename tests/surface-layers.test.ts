import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfaceFinishService } from '../src/services/rendering/SurfaceFinishService';
import { normalizeSurfaceLayer, preserveSurfaceLayer } from '../src/core/types/surfaceLayer';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { PlanExportService } from '../src/services/plan/PlanExportService';

test('higher signed layers receive stronger depth bias and keep depth testing', () => {
  const service = new SurfaceFinishService();
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
  const service = new SurfaceFinishService();
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
  const service = new SurfaceFinishService();
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
  const parser = new PlanParserService();
  const exporter = new PlanExportService();
  const manager = new PlanManagerService(parser, exporter);
  manager.loadPlan({ plan: {
    walls: { w: { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, depth: 10, height: 270 } },
    rooms2: { r: { title: 'Room', area: 4, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }] } },
    columns: [{ id: 'c', name: 'Column', type: 'column', width: 0.2, depth: 0.2, worldPos: { x: 1, y: 0, z: 1 }, rotationY: 0 }],
    items: { f: { name: 'chair', pc: { x: 50, y: 50 } } },
  } });
  const finish = { type: 'paint' as const, color: '#ff0000' };
  manager.setWallFinish('w', { ...finish, layer: 1 }, 'A');
  manager.setWallFinish('w', { ...finish, layer: -1 }, 'B');
  manager.setWallFinish('w', { ...finish, layer: 3 }, 'edge_top');
  manager.setRoomFloorFinish('r', { ...finish, layer: 4 });
  manager.setColumnFinish('c', { ...finish, layer: 5 }, 'front');
  manager.setFurnitureFinish('f', { ...finish, layer: 6 });
  manager.setFurnitureSectionFinish('f', 'wood', { ...finish, layer: 7 });
  const loaded = parser.parse(manager.exportPlanJson());
  assert.equal(loaded.walls[0].finishSideA?.layer, 1);
  assert.equal(loaded.walls[0].finishSideB?.layer, -1);
  assert.equal(loaded.walls[0].finishEdgeTop?.layer, 3);
  assert.equal(loaded.rooms[0].floorFinish?.layer, 4);
  assert.equal(loaded.columns![0].finishFront?.layer, 5);
  assert.equal(loaded.furniture[0].finish?.layer, 6);
  assert.equal(loaded.furniture[0].sectionFinishes?.wood.layer, 7);
  assert.equal(manager.hasUnsavedChanges(), true);
});
