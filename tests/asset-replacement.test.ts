import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReplaceFurniture } from '../src/application/commands/FurnitureCommands';
import { AssetCatalog } from '../src/domain/catalog/AssetCatalog';
import { PlanCodec } from '../src/domain/codec/PlanCodec';
import { createEditor, legacyData } from './support/editor';

const registry = new AssetCatalog();
const parser = new PlanCodec(registry);
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
  const manager = createEditor(undefined, parser);
  const original = manager.documents.load(rawPlan()).furniture[0];
  manager.execute(new ReplaceFurniture(original.id, 'chair'));
  assert.equal(manager.isDirty, true);
  let json = manager.legacy.encode(manager.getDocument());
  assert.equal(legacyData(json).plan.items.sofa_1.assetKey, 'chair');
  assert.equal(legacyData(json).plan.items.sofa_1.name, 'sofa');

  for (let cycle = 0; cycle < 3; cycle++) {
    const reloaded = manager.documents.load(json).furniture[0];
    assert.equal(reloaded.assetKey, 'chair');
    assert.equal(reloaded.displayName, 'Chair');
    assert.equal(reloaded.category, 'seating');
    assert.equal(reloaded.id, original.id);
    assert.deepEqual(reloaded.position, original.position);
    assert.deepEqual(reloaded.dimensions, original.dimensions);
    assert.equal(reloaded.rotationY, original.rotationY);
    json = manager.legacy.encode(manager.getDocument());
  }
});

test('replacement metadata comes from the saved key, including category and defaults', () => {
  const item = parser.decode(rawPlan({
    assetKey: 'bed_double', width: undefined, height: undefined, self_height: undefined,
  })).furniture[0];
  const bed = registry.get('bed_double')!;
  assert.equal(item.assetKey, bed.key);
  assert.equal(item.category, bed.category);
  assert.equal(item.displayName, 'Bed Double');
  assert.deepEqual(item.dimensions, bed.defaultDimensions);
});

test('legacy plans without a saved key still resolve original names and aliases', () => {
  assert.equal(parser.decode(rawPlan()).furniture[0].assetKey, 'sofa_triple');
  assert.equal(parser.decode(rawPlan({ name: 'loveseat' })).furniture[0].assetKey, 'sofa_double');
  assert.equal(parser.decode(rawPlan({ assetKey: '' })).furniture[0].assetKey, 'sofa_triple');
});

test('parser without a registry preserves the saved replacement key', () => {
  const item = new PlanCodec().decode(rawPlan({ assetKey: 'chair' })).furniture[0];
  assert.equal(item.assetKey, 'chair');
  assert.equal(item.category, 'seating');
  assert.equal(item.displayName, 'Chair');
});

test('unregistered custom replacements survive export and reload', () => {
  const manager = createEditor(undefined, parser);
  manager.documents.load(rawPlan());
  manager.execute(new ReplaceFurniture('sofa_1', 'custom_chair', '/models/chair.glb'));
  const item = parser.decode(manager.legacy.encode(manager.getDocument())).furniture[0];
  assert.equal(item.assetKey, 'custom_chair');
  assert.equal(item.customModelUrl, '/models/chair.glb');
  assert.equal(item.displayName, 'Custom Chair');
});
