import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { StandardFurniture, type Furniture } from '../../domain/elements/Furniture';
import { cabinetDoorPose, defaultCabinet, footprint, interiorOrigin, resolveContent, resolvePanel, type CabinetBox } from '../../domain/cabinet/CabinetLayout';

import { cabinetBasket, cabinetHasDoors, cabinetLeaves } from '../../domain/cabinet/CabinetFronts';

export function buildCabinet(c: AssetBuildContext, buildContent?: (entity: Furniture) => THREE.Object3D): void {
  const layout = c.entity.cabinet ?? defaultCabinet(c.entity.toData(), c.definition?.cabinetDoors ?? 2), t = layout.panelThickness, b = layout.backThickness;
  const carcassDepth = c.d - (cabinetHasDoors(layout) ? t : 0), carcassZ = cabinetHasDoors(layout) ? -t / 2 : 0;
  const kitchen = ['kitchen_box_door_double', 'kitchen_box_wall'].includes(c.entity.assetKey);
  const body = kitchen ? c.materials.fabricLight : ['ward_double', 'ward_single'].includes(c.entity.assetKey) ? c.materials.woodLight : c.materials.whitePaint;
  const origin = interiorOrigin(c.entity.dimensions, layout);
  const box = (id: string, section: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const group = new THREE.Group(); group.name = `cabinet_part_${id}`; group.userData.cabinetPart = id;
    group.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.001, w), Math.max(.001, h), Math.max(.001, d)), body);
    mesh.userData = { section, cabinetPart: id }; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); c.parent.add(group); return group;
  };
  box('shell_left', 'Frame', -c.w / 2 + t / 2, c.h / 2, carcassZ, t, c.h, carcassDepth);
  box('shell_right', 'Frame', c.w / 2 - t / 2, c.h / 2, carcassZ, t, c.h, carcassDepth);
  box('shell_base', 'Frame', 0, t / 2, carcassZ, c.w - 2 * t, t, carcassDepth);
  box('shell_top', 'Frame', 0, c.h - t / 2, carcassZ, c.w - 2 * t, t, carcassDepth);
  box('shell_back', 'Back Panel', 0, c.h / 2, -c.d / 2 + b / 2, c.w - 2 * t, c.h - 2 * t, b);
  const addPart = (p: CabinetBox, section: string) => box(p.id, section, origin.x + p.position.x + p.dimensions.x / 2, origin.y + p.position.y + p.dimensions.y / 2, origin.z + p.position.z + p.dimensions.z / 2, p.dimensions.x, p.dimensions.y, p.dimensions.z);
  for (const panel of layout.panels) { const group = addPart(resolvePanel(layout, c.entity.dimensions, panel), panel.kind === 'shelf' ? 'Shelves' : 'Dividers'); group.traverse(child => { child.userData.cabinetPanel = panel; }); }
  const leaves = cabinetLeaves(layout, c.entity.dimensions), pivots = new Map<string, THREE.Group>();
  for (const door of leaves) {
    const { index, left, width, tilt } = door, height = Math.max(.001, door.top - door.bottom - .004);
    const pivot = new THREE.Group(); pivot.name = `cabinet_door_${index}`;
    pivot.userData = { cabinetDoor: index, cabinetPart: `door_${index}`, swingSign: tilt ? 1 : left ? -1 : 1, swingAxis: tilt ? 'x' : 'y' };
    const pose = cabinetDoorPose(c.entity.dimensions, layout, index), closed = cabinetDoorPose(c.entity.dimensions, layout, index, 0);
    pivot.position.set(pose.position.x, pose.position.y, pose.position.z); pivot.rotation.set(pose.rotationX, pose.rotationY, 0);
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x: number, y: number, z: number) => {
      const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z);
      part.userData = { section, cabinetPart: `door_${index}`, cabinetDoor: index, isSwingCollider: true };
      part.castShadow = part.receiveShadow = true; pivot.add(part); return part;
    };
    const leaf = mesh(new THREE.BoxGeometry(Math.max(.001, width), height, t), body, `Door ${index + 1}`, tilt ? 0 : (left ? 1 : -1) * width / 2, tilt ? height / 2 : (height + .004) / 2, 0);
    leaf.userData.isSwingLeaf = true;
    mesh(new THREE.BoxGeometry(tilt ? Math.min(.128, width * .6) : .012, tilt ? .012 : Math.min(.128, height / 3), .025), c.materials.metalChrome, 'Handles', tilt ? 0 : (left ? 1 : -1) * (width - .035), tilt ? height - .04 : height / 2, t / 2 + .0125);
    const basket = cabinetBasket(layout, c.entity.dimensions, door);
    if (basket) {
      pivots.set(basket.floor.id, pivot);
      pivot.userData.closedPosition = closed.position;
      basket.walls.forEach((box, wall) => {
        const d = box.dimensions, p = box.position;
        const add = (x: number, y: number, z: number, w: number, h: number, depth: number) => mesh(new THREE.BoxGeometry(w, h, depth), body, 'Laundry Basket', origin.x + x + w / 2 - closed.position.x, origin.y + y + h / 2 - closed.position.y, origin.z + z + depth / 2 - closed.position.z);
        if (wall === 0) add(p.x, p.y, p.z, d.x, d.y, d.z);
        else {
          // Open lattice walls keep the basket visible without covering the interior in a solid block.
          const across = wall === 1 ? d.x : d.z, n = Math.max(2, Math.ceil(across / .05)), rail = .008;
          for (let row = 0; row < 5; row++) add(p.x, p.y + row * (d.y - rail) / 4, p.z, d.x, rail, d.z);
          for (let col = 0; col <= n; col++) add(p.x + (wall === 1 ? col * (d.x - rail) / n : 0), p.y, p.z + (wall === 1 ? 0 : col * (d.z - rail) / n), wall === 1 ? rail : d.x, d.y, wall === 1 ? d.z : rail);
        }
      });
    }
    c.parent.add(pivot);
  }
  for (const content of layout.contents) {
    const resolved = resolveContent(layout, c.entity.dimensions, content), f = footprint(content.dimensions, content.rotationY), group = new THREE.Group();
    group.name = `cabinet_content_${content.id}`; group.userData = { cabinetPart: content.id, cabinetContent: content };
    group.position.set(origin.x + resolved.position.x + f.x / 2, origin.y + resolved.position.y, origin.z + resolved.position.z + f.z / 2); group.rotation.y = content.rotationY;
    const entity = new StandardFurniture({ id: content.id, assetKey: content.assetKey, name: content.assetKey, displayName: content.name, category: 'decor', position: { x: 0, y: 0, z: 0 }, rotationY: 0, dimensions: content.dimensions, finish: content.finish, sectionFinishes: content.sectionFinishes });
    const model = buildContent?.(entity);
    if (model) { model.traverse(child => { child.userData.cabinetPart = content.id; child.userData.cabinetContent = content; }); group.add(model); }
    const pivot = content.supportId ? pivots.get(content.supportId) : undefined;
    if (pivot) {
      const offset = pivot.userData.closedPosition;
      group.position.sub(new THREE.Vector3(offset.x, offset.y, offset.z)); group.userData.cabinetClosedOffset = offset; pivot.add(group);
    } else c.parent.add(group);
  }
}
