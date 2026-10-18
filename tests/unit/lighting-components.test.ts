import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LIGHTING_COMPONENTS } from '../../src/domain/catalog/LightingComponents';
import { FLOOR_DRAINS } from '../../src/domain/catalog/FloorDrains';
import { AssetCatalog } from '../../src/domain/catalog/AssetCatalog';
import type { AssetDefinition } from '../../src/domain/catalog/AssetDefinition';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { Luminaire } from '../../src/domain/elements/Furniture';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { isFixtureLight, type FixtureLight } from '../../src/engine/lighting/FixtureLight';
import type { ViewportSettings } from '../../src/core/types/services';
import { EditorSession } from '../../src/application/EditorSession';
import { AddFurniture, ConfigureLuminaire, FinishFurniture, TransformFurniture } from '../../src/application/commands/FurnitureCommands';
import { rawPlan } from './fixtures';

const catalog = new AssetCatalog(), codec = new PlanCodec(catalog), builder = new FurnitureMeshBuilder(catalog);
const item = (a: AssetDefinition, scale = 1) => codec.factory.furniture({ id: a.key, name: a.key, assetKey: a.key, category: a.category as 'decor' | 'bathroom',
  displayName: a.name, position: { x: 0, y: 0, z: 0 }, rotationY: 0,
  dimensions: { x: a.defaultDimensions.x * scale, y: a.defaultDimensions.y * scale, z: a.defaultDimensions.z * scale } });
const lights = (root: THREE.Object3D) => { const result: FixtureLight[] = []; root.traverse(o => { if (isFixtureLight(o)) result.push(o); }); return result; };
const glowMeshes = (root: THREE.Object3D) => { const result: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh && o.userData.isLightEmissive) result.push(o); }); return result; };

describe('lighting components and floor drains', () => {
  it('registers 15 controllable light fittings across seven collections and five floor drains', () => {
    expect(LIGHTING_COMPONENTS).toHaveLength(15); expect(FLOOR_DRAINS).toHaveLength(5);
    expect(new Set(LIGHTING_COMPONENTS.map(a => a.collection)).size).toBe(7);
    for (const a of [...LIGHTING_COMPONENTS, ...FLOOR_DRAINS]) {
      expect(catalog.get(a.key)).toEqual(a);
      expect(a.source).toMatchObject({ dimensions: 'reference', retailer: 'Generic' });
      expect(a.capabilities?.resizable).toBe(true);
      expect(item(a) instanceof Luminaire).toBe(Boolean(a.capabilities?.lighting));
    }
  });

  it.each([...LIGHTING_COMPONENTS, ...FLOOR_DRAINS])('$name renders editable geometry within its resized envelope', a => {
    for (const scale of [.6, 1, 1.5]) {
      const entity = item(a, scale), root = builder.build(entity), bounds = new THREE.Box3().setFromObject(root);
      const sections = new Set<string>(); root.traverse(o => { if (o instanceof THREE.Mesh) sections.add(o.userData.section); });
      expect(sections.size).toBeGreaterThanOrEqual(2);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(bounds.min[axis]).toBeGreaterThanOrEqual((axis === 'y' ? 0 : -entity.dimensions[axis] / 2) - .001);
        expect(bounds.max[axis]).toBeLessThanOrEqual((axis === 'y' ? entity.dimensions.y : entity.dimensions[axis] / 2) + .001);
      }
      const emitters = lights(root);
      if (a.lightingComponent) { expect(emitters.length).toBeGreaterThan(0); expect(glowMeshes(root).length).toBeGreaterThan(0); }
      else expect(emitters).toHaveLength(0);
    }
  });

  it('aims beams down, up or both and distributes track and linear sources', () => {
    for (const a of LIGHTING_COMPONENTS) {
      const root = builder.build(item(a)); root.updateMatrixWorld(true);
      const emitters = lights(root);
      if (a.lightingComponent!.kind === 'track') expect(emitters).toHaveLength(a.lightingComponent!.style === 'straight' ? 3 : 5);
      if (a.lightingComponent!.kind === 'cabinet_light' || a.key === 'lighting_pendant_linear') expect(emitters).toHaveLength(a.lightingComponent!.style === 'vertical' ? 1 : 3);
      const directions = emitters.filter((l): l is THREE.SpotLight => l instanceof THREE.SpotLight).map(l =>
        l.target.getWorldPosition(new THREE.Vector3()).sub(l.getWorldPosition(new THREE.Vector3())).normalize());
      if (a.lightingComponent!.kind === 'cove_light') {
        expect(emitters).toHaveLength(1);
        const area = emitters[0] as THREE.RectAreaLight;
        expect(area).toBeInstanceOf(THREE.RectAreaLight);
        expect(area.getWorldDirection(new THREE.Vector3()).negate().y).toBeCloseTo(1);
        expect(area.width).toBeCloseTo(a.defaultDimensions.x * .98);
      }
      else if (a.key === 'lighting_wall_up_down') expect(directions.map(d => Math.sign(d.y)).sort()).toEqual([-1, 1]);
      else expect(directions.every(d => d.y < -.9)).toBe(true);
    }
  });

  it.each([...LIGHTING_COMPONENTS, catalog.get('chandelier')!, catalog.get('chandelier_cascading')!])('$name controls actual light and visible glow together without rebuilding', a => {
    const resources = new ResourcePool(), settings = { spotLightIntensity: 1, chandelierIntensity: 1 } as ViewportSettings;
    const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources, () => settings, () => undefined);
    const entity = item(a) as Luminaire, root = builder.build(entity);
    appearance.apply(root, entity); const lease = resources.ownTree(root), emitters = lights(root), glow = glowMeshes(root);
    expect(emitters.every(l => l.visible && l.intensity >= 2.5)).toBe(true);
    appearance.applyLighting(root, entity.withEmission({ enabled: false }));
    expect(emitters.every(l => !l.visible && l.intensity === 0)).toBe(true);
    expect(glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === '334155')).toBe(true);
    appearance.applyLighting(root, entity.withEmission({ enabled: true, intensity: .5, color: '#ed794c' }));
    for (const l of emitters) { expect(l.intensity).toBe(l.userData.baseIntensity * .5); expect(l.color.getHexString()).toBe('ed794c'); }
    const type = emitters[0].userData.fixtureType;
    settings[type === 'chandelier' ? 'chandelierIntensity' : 'spotLightIntensity'] = 0;
    appearance.applyLighting(root, entity);
    expect(emitters.every(l => !l.visible)).toBe(true);
    expect(glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === '334155')).toBe(true);
    lease.dispose();
  });

  it('gives existing chandeliers enough room-light output and isolates each fixture glow material', () => {
    for (const key of ['chandelier', 'chandelier_cascading']) {
      const a = catalog.get(key)!, entity = item(a) as Luminaire, on = builder.build(entity), off = builder.build(entity);
      const resources = new ResourcePool();
      const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources,
        () => ({ spotLightIntensity: 1, chandelierIntensity: 1 } as ViewportSettings), () => undefined);
      appearance.apply(on, entity); appearance.apply(off, entity.withEmission({ enabled: false }));
      expect(lights(on)[0].intensity).toBeGreaterThanOrEqual(18);
      expect(glowMeshes(on).every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() !== '334155')).toBe(true);
      resources.ownTree(on).dispose(); resources.ownTree(off).dispose();
    }
  });

  it('models open grate slots and a separate tile insert rather than a solid cover', () => {
    const firstHit = (key: string, x: number, z: number) => {
      const root = builder.build(item(catalog.get(key)!)); root.updateMatrixWorld(true);
      return new THREE.Raycaster(new THREE.Vector3(x, .1, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true)
        .find(hit => hit.object instanceof THREE.Mesh)?.object.userData.section;
    };
    expect(firstHit('drain_square_steel', 0, 0)).toBe('Inlet');
    expect(firstHit('drain_round_steel', 0, .00375)).toBe('Inlet');
    expect(firstHit('drain_tile_insert', .393, 0)).toBe('Inlet');
    expect(firstHit('drain_tile_insert', 0, 0)).toBe('Tile Insert');
  });

  it('persists lighting settings, independent drain finishes and resized dimensions in both plan formats', () => {
    const editor = new EditorSession(codec.factory); editor.load(codec.decode(rawPlan()));
    for (const a of [...LIGHTING_COMPONENTS, ...FLOOR_DRAINS]) editor.execute(new AddFurniture(item(a).toData()));
    const lamp = 'lighting_pendant_linear', drain = 'drain_tile_insert';
    editor.execute(new ConfigureLuminaire(lamp, { enabled: false, intensity: 1.7, color: '#ed794c' }));
    editor.execute(new TransformFurniture(lamp, { x: 2, y: 2.2, z: 1 }, .3, { x: 1.5, y: .7, z: .08 }));
    editor.execute(new FinishFurniture(drain, { type: 'tile', color: '#a59c88', variant: 'square' }, 'Tile Insert'));
    for (const encoded of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      const restored = codec.decode(encoded);
      expect(restored.requireLuminaire(lamp)).toMatchObject({ dimensions: { x: 1.5 }, emissionEnabled: false, intensity: 1.7, emissionColor: '#ed794c' });
      expect(restored.requireFurniture(drain).sectionFinishes?.tile_insert).toMatchObject({ type: 'tile', color: '#a59c88' });
    }
  });

  it('releases geometry, cloned housing colours and spotlight targets', () => {
    const pool = new ResourcePool(); const palette = pool.ownTree(Object.assign(new THREE.Object3D(), { material: builder.palette }));
    const baseline = pool.size;
    for (const a of [...LIGHTING_COMPONENTS, ...FLOOR_DRAINS]) { pool.ownTree(builder.build(item(a))).dispose(); expect(pool.size).toBe(baseline); }
    palette.dispose(); expect(pool.size).toBe(0);
  });
});
