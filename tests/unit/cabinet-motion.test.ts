import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PlanCodec } from '../../src/domain/codec/PlanCodec';
import { setCabinetDoorAngle } from '../../src/domain/cabinet/CabinetFronts';
import { FurnitureMeshBuilder } from '../../src/engine/assets/FurnitureMeshBuilder';
import { FurnitureSceneNode } from '../../src/engine/nodes/FurnitureSceneNode';
import { ResourcePool } from '../../src/engine/resources/ResourcePool';
import { PickRegistry } from '../../src/engine/picking/PickRegistry';

describe('retained cabinet motion', () => {
  it.each(['cabinet_base_single', 'cabinet_drawers_three', 'cabinet_laundry_tiltout', 'cabinet_wardrobe_drawers'])('retains every mesh and resource while %s opens and closes', key => {
    const codec = new PlanCodec(), builder = new FurnitureMeshBuilder(codec.factory.catalog);
    let item = codec.factory.furniture({ id: 'cabinet', name: key, displayName: key, assetKey: key, category: 'storage', dimensions: { x: .6, y: 1.8, z: .6 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const layout = item.cabinet!;
    const supportId = key === 'cabinet_drawers_three' ? 'drawer_drawer_front_1_0' : key === 'cabinet_wardrobe_drawers' ? 'drawer_internal_1' : key === 'cabinet_laundry_tiltout' ? 'basket_lower_0' : 'base';
    item = item.withCabinet({ ...layout, contents: [{ id: 'roll', name: 'Roll', assetKey: 'fit_toilet_roll', dimensions: { x: .1, y: .05, z: .1 }, position: { x: .02, y: 0, z: .02 }, rotationY: 0, supportId }] });
    const build = vi.fn(builder.build.bind(builder)), resources = new ResourcePool(), picking = new PickRegistry();
    const node = new FurnitureSceneNode(item, { build }, { apply() {} }, resources, picking);
    const meshes = picking.getCandidates(), first = meshes[0] as THREE.Mesh, disposed = vi.spyOn(first.geometry, 'dispose'), size = resources.size;
    const content = node.group.getObjectByName('cabinet_content_roll')!;
    node.group.updateMatrixWorld(true); const closed = content.getWorldPosition(new THREE.Vector3());
    const open = key === 'cabinet_wardrobe_drawers'
      ? item.withCabinet({ ...item.cabinet!, internalDrawers: item.cabinet!.internalDrawers!.map((drawer, i) => i ? drawer : { ...drawer, extension: 1 }) })
      : item.withCabinet(setCabinetDoorAngle(item.cabinet!, 0, key === 'cabinet_laundry_tiltout' ? 40 : 90));
    node.reconcile(open); node.group.updateMatrixWorld(true);
    expect(build).toHaveBeenCalledOnce(); expect(disposed).not.toHaveBeenCalled(); expect(resources.size).toBe(size);
    expect(picking.getCandidates()).toEqual(meshes);
    if (supportId !== 'base') expect(content.getWorldPosition(new THREE.Vector3()).distanceTo(closed)).toBeGreaterThan(.01);
    node.reconcile(item); node.group.updateMatrixWorld(true); expect(content.getWorldPosition(new THREE.Vector3()).distanceTo(closed)).toBeLessThan(1e-8);
    node.reconcile(item.withDimensions({ ...item.dimensions, x: .7 })); expect(build).toHaveBeenCalledTimes(2); expect(disposed).toHaveBeenCalledOnce();
    node.dispose(); expect(resources.size).toBe(0); expect(picking.getCandidates()).toHaveLength(0);
  });

  it('rebuilds leaf geometry when hinge hardware changes', () => {
    const codec = new PlanCodec(), builder = new FurnitureMeshBuilder(codec.factory.catalog), resources = new ResourcePool();
    const item = codec.factory.furniture({ id: 'cabinet', name: 'Cabinet', displayName: 'Cabinet', assetKey: 'cabinet_base_single', category: 'storage', dimensions: { x: .6, y: .85, z: .6 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0 });
    const build = vi.fn(builder.build.bind(builder)), node = new FurnitureSceneNode(item, { build }, { apply() {} }, resources, new PickRegistry());
    node.reconcile(item.withCabinet({ ...item.cabinet!, doors: { ...item.cabinet!.doors, hinges: [{ type: 'fully-cranked', travel: .02 }, { type: 'pivot', travel: 0 }] } }));
    expect(build).toHaveBeenCalledTimes(2); node.dispose();
  });
});
