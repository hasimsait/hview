import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlanParserService } from '../src/services/plan/PlanParserService';
import { PlanExportService } from '../src/services/plan/PlanExportService';
import { PlanManagerService } from '../src/services/plan/PlanManagerService';
import { AssetRegistryService } from '../src/services/rendering/AssetRegistryService';

const registry = new AssetRegistryService();
const parser = new PlanParserService(registry);
const exporter = new PlanExportService();
const rawPlan = (overrides: Record<string, unknown> = {}) => ({
  plan: {
    items: {
      sofa_1: {
        name: 'sofa', pc: { x: 120, y: 240 }, angle: 45,
        width: 210, height: 90, self_height: 80, f0offset: 15,
        ...overrides,
      },
    },
  },
});

test('sofa replaced with chair survives repeated export/reload cycles', () => {
  const manager = new PlanManagerService(parser, exporter);
  const original = manager.loadPlan(rawPlan()).furniture[0];
  manager.replaceFurnitureAsset(original.id, 'chair');
  assert.equal(manager.hasUnsavedChanges(), true);
  let json = manager.exportPlanJson();
  assert.equal(JSON.parse(json).plan.items.sofa_1.assetKey, 'chair');
  assert.equal(JSON.parse(json).plan.items.sofa_1.name, 'sofa');

  for (let cycle = 0; cycle < 3; cycle++) {
    const reloaded = manager.loadPlan(json).furniture[0];
    assert.equal(reloaded.assetKey, 'chair');
    assert.equal(reloaded.displayName, 'Chair');
    assert.equal(reloaded.category, 'seating');
    assert.equal(reloaded.id, original.id);
    assert.deepEqual(reloaded.position, original.position);
    assert.deepEqual(reloaded.dimensions, original.dimensions);
    assert.equal(reloaded.rotationY, original.rotationY);
    json = manager.exportPlanJson();
  }
});

test('replacement metadata comes from the saved key, including category and defaults', () => {
  const item = parser.parse(rawPlan({
    assetKey: 'bed_double', width: undefined, height: undefined, self_height: undefined,
  })).furniture[0];
  const bed = registry.getAsset('bed_double')!;
  assert.equal(item.assetKey, bed.key);
  assert.equal(item.category, bed.category);
  assert.equal(item.displayName, 'Bed Double');
  assert.deepEqual(item.dimensions, bed.defaultDimensions);
});

test('legacy plans without a saved key still resolve original names and aliases', () => {
  assert.equal(parser.parse(rawPlan()).furniture[0].assetKey, 'sofa_triple');
  assert.equal(parser.parse(rawPlan({ name: 'loveseat' })).furniture[0].assetKey, 'sofa_double');
  assert.equal(parser.parse(rawPlan({ assetKey: '' })).furniture[0].assetKey, 'sofa_triple');
});

test('parser without a registry preserves the saved replacement key', () => {
  const item = new PlanParserService().parse(rawPlan({ assetKey: 'chair' })).furniture[0];
  assert.equal(item.assetKey, 'chair');
  assert.equal(item.category, 'seating');
  assert.equal(item.displayName, 'Chair');
});

test('unregistered custom replacements survive export and reload', () => {
  const manager = new PlanManagerService(parser, exporter);
  manager.loadPlan(rawPlan());
  manager.replaceFurnitureAsset('sofa_1', 'custom_chair', '/models/chair.glb');
  const item = parser.parse(manager.exportPlanJson()).furniture[0];
  assert.equal(item.assetKey, 'custom_chair');
  assert.equal(item.customModelUrl, '/models/chair.glb');
  assert.equal(item.displayName, 'Custom Chair');
});
