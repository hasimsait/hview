import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ConfigureCabinet } from '../../src/application/commands/CabinetCommands';
import { EditorSession } from '../../src/application/EditorSession';
import { defaultCabinet, validateCabinet } from '../../src/domain/cabinet/CabinetLayout';
import { LegacyPlanWriter } from '../../src/domain/codec/LegacyPlanWriter';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { PlanDocument } from '../../src/domain/model/PlanDocument';
import type { LightFixtureConfig } from '../../src/domain/model/PlanData';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { isFixtureLight, type FixtureLight } from '../../src/engine/lighting/FixtureLight';
import { FurnitureAppearance } from '../../src/engine/materials/FurnitureAppearance';
import type { SurfaceMaterialFactory } from '../../src/engine/materials/SurfaceMaterialFactory';
import { FurnitureSceneNode } from '../../src/engine/nodes/FurnitureSceneNode';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import type { ViewportSettings } from '../../src/core/types/services';

const codec = new PlanCodec(), builder = new FurnitureMeshBuilder(codec.factory.catalog);
function cabinet() {
  const dimensions = { x: .6, y: 1.9, z: .4 };
  const layout = { ...defaultCabinet({ dimensions, assetKey: 'cabinet_tall_single' }, 1), panels: [], contents: [
    { id: 'led', name: 'Vertical LED', assetKey: 'lighting_cabinet_vertical', dimensions: { x: .018, y: 1.2, z: .015 }, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId: 'base', lightConfig: { enabled: true, intensity: .5, color: '#ed794c' } },
    { id: 'second', name: 'Second light', assetKey: 'lighting_pendant_globe', dimensions: { x: .1, y: .2, z: .1 }, position: { x: .3, y: 0, z: .02 }, rotationY: 0, supportId: 'base', lightConfig: { enabled: false } },
  ] };
  return codec.factory.furniture({ id: 'cabinet', name: 'Cabinet', displayName: 'Cabinet', assetKey: 'cabinet_tall_single', category: 'storage', position: { x: 0, y: 0, z: 0 }, dimensions, rotationY: 0, cabinet: layout });
}
function parts(root: THREE.Object3D, id: string) {
  const lights: FixtureLight[] = [], glow: THREE.Mesh[] = [];
  root.getObjectByName(`cabinet_content_${id}`)!.traverse(child => {
    if (isFixtureLight(child)) lights.push(child);
    if (child instanceof THREE.Mesh && child.userData.isLightEmissive) glow.push(child);
  });
  return { lights, glow };
}
describe('cabinet content lighting', () => {
  it('controls each nested light and diffuser independently, with the correct global fixture slider', () => {
    const resources = new ResourcePool(), settings = { spotLightIntensity: 2, chandelierIntensity: .25 } as ViewportSettings;
    const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources, () => settings, () => undefined);
    const item = cabinet(), root = builder.build(item);
    appearance.apply(root, item);
    const lease = resources.ownTree(root), led = parts(root, 'led'), other = parts(root, 'second');
    expect(led.lights).toHaveLength(1);
    expect(led.lights[0].intensity).toBe(2.5);
    expect(led.lights[0].color.getHexString()).toBe('ed794c');
    expect(led.glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === 'ed794c')).toBe(true);
    expect(other.lights.every(light => light.intensity === 0 && !light.visible)).toBe(true);
    expect(other.glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === '334155')).toBe(true);
    const secondOn = item.withCabinet({ ...item.cabinet!, contents: item.cabinet!.contents.map(content => content.id === 'second' ? { ...content, lightConfig: { enabled: true } } : content) });
    appearance.applyLighting(root, secondOn);
    expect(other.lights[0].intensity).toBe(other.lights[0].userData.baseIntensity * .25);
    expect(led.lights[0].intensity).toBe(2.5);
    settings.spotLightIntensity = 0;
    appearance.applyLighting(root, secondOn);
    expect(led.lights[0].intensity).toBe(0);
    expect(led.glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() === '334155')).toBe(true);
    expect(other.lights[0].intensity).toBe(other.lights[0].userData.baseIntensity * .25);
    expect(other.glow.every(mesh => (mesh.material as THREE.MeshBasicMaterial).color.getHexString() !== '334155')).toBe(true);
    lease.dispose();
  });

  it('retains meshes during light edits and restores output on undo and both plan round trips', () => {
    const original = cabinet(), editor = new EditorSession(codec.factory), resources = new ResourcePool();
    editor.load(new PlanDocument([original]));
    const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources, () => ({ spotLightIntensity: 1, chandelierIntensity: 1 } as ViewportSettings), () => undefined);
    const build = vi.fn(builder.build.bind(builder));
    const node = new FurnitureSceneNode(original, { build }, appearance, resources, new PickRegistry());
    const first = parts(node.group, 'led'), layout = original.cabinet!;
    editor.execute(new ConfigureCabinet(original.id, { ...layout, contents: layout.contents.map(content => content.id === 'led' ? { ...content, lightConfig: { ...content.lightConfig, enabled: false } } : content) }));
    const changed = editor.getDocument().requireFurniture(original.id);
    node.reconcile(changed);
    expect(build).toHaveBeenCalledOnce();
    expect(parts(node.group, 'led').lights[0]).toBe(first.lights[0]);
    expect(first.lights[0].intensity).toBe(0);
    for (const serialized of [codec.encode(editor.getDocument()), new LegacyPlanWriter().encode(editor.getDocument())]) {
      expect(codec.decode(serialized).requireFurniture(original.id).cabinet).toEqual(changed.cabinet);
    }
    editor.undo(); node.reconcile(editor.getDocument().requireFurniture(original.id));
    expect(first.lights[0].intensity).toBe(1.25);
    editor.redo(); node.reconcile(editor.getDocument().requireFurniture(original.id));
    expect(first.lights[0].intensity).toBe(0);
    expect(build).toHaveBeenCalledOnce();
    node.dispose(); expect(resources.size).toBe(0);
  });

  it.each([null, [], { enabled: 'no' }, { color: 123 }, { intensity: -1 }, { intensity: 3.1 }, { intensity: NaN }])('rejects malformed nested light settings: %j', config => {
    const layout = structuredClone(cabinet().cabinet!);
    layout.contents[0].lightConfig = config as unknown as LightFixtureConfig;
    expect(() => validateCabinet(layout)).toThrow();
  });

  it('keeps older contents with no light settings valid and lit by default', () => {
    const original = cabinet(), layout = structuredClone(original.cabinet!);
    delete layout.contents[0].lightConfig;
    expect(validateCabinet(layout)).toEqual(layout);
    const item = original.withCabinet(layout), root = builder.build(item), resources = new ResourcePool();
    const appearance = new FurnitureAppearance({} as SurfaceMaterialFactory, resources, () => ({ spotLightIntensity: 1, chandelierIntensity: 1 } as ViewportSettings), () => undefined);
    appearance.apply(root, item);
    expect(parts(root, 'led').lights[0].intensity).toBe(2.5);
    resources.ownTree(root).dispose();
  });
});
