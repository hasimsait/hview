import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { StandardFurniture, type Furniture } from '../../domain/elements/Furniture';
import { cabinetDoorPose, contentSupportRoot, defaultCabinet, footprint, interiorOrigin, resolveContent, resolvePanel, type CabinetBox } from '../../domain/cabinet/CabinetLayout';

import { cabinetDrawer, cabinetInternalDrawer, cabinetBasket, cabinetHasDoors, cabinetLeaves } from '../../domain/cabinet/CabinetFronts';
import { cabinetBaseHeight } from '../../domain/cabinet/CabinetPlinth';
import { bookcaseMaterials } from '../assets/builders/BookcaseMaterials';

export function buildCabinet(c: AssetBuildContext, buildContent?: (entity: Furniture) => THREE.Object3D): void {
  const layout = c.entity.cabinet ?? defaultCabinet(c.entity.toData(), c.definition?.cabinetDoors ?? 2), t = layout.panelThickness, b = layout.backThickness;
  const carcassDepth = c.d - (cabinetHasDoors(layout) ? t : 0), carcassZ = cabinetHasDoors(layout) ? -t / 2 : 0;
  const kitchen = ['kitchen_box_door_double', 'kitchen_box_wall'].includes(c.entity.assetKey);
  const bookcase = bookcaseMaterials(c), mirrorCabinet = c.entity.assetKey === 'mirror_cabinet_upper';
  const body = bookcase?.frame ?? (mirrorCabinet ? c.materials.cabinetSage : kitchen ? c.materials.fabricLight : ['ward_double', 'ward_single'].includes(c.entity.assetKey) ? c.materials.woodLight : c.materials.whitePaint);
  const origin = interiorOrigin(c.entity.dimensions, layout);
  const box = (id: string, section: string, x: number, y: number, z: number, w: number, h: number, d: number, material = body) => {
    const group = new THREE.Group(); group.name = `cabinet_part_${id}`; group.userData.cabinetPart = id;
    group.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.001, w), Math.max(.001, h), Math.max(.001, d)), material);
    mesh.userData = { section, cabinetPart: id }; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); c.parent.add(group); return group;
  };
  const baseHeight = cabinetBaseHeight(layout), bodyHeight = c.h - baseHeight;
  if (layout.plinth) {
    const depth = Math.max(t, c.d - layout.plinth.setback);
    box('plinth_front', 'Plinth', 0, baseHeight / 2, c.d / 2 - layout.plinth.setback - t / 2, c.w - 2 * t, baseHeight, t);
    for (const side of [-1, 1]) box(side < 0 ? 'plinth_left' : 'plinth_right', 'Plinth', side * (c.w / 2 - t / 2), baseHeight / 2, -layout.plinth.setback / 2, t, baseHeight, depth);
  }
  box('shell_left', 'Frame', -c.w / 2 + t / 2, baseHeight + bodyHeight / 2, carcassZ, t, bodyHeight, carcassDepth);
  box('shell_right', 'Frame', c.w / 2 - t / 2, baseHeight + bodyHeight / 2, carcassZ, t, bodyHeight, carcassDepth);
  box('shell_base', 'Frame', 0, baseHeight + t / 2, carcassZ, c.w - 2 * t, t, carcassDepth);
  box('shell_top', bookcase ? 'Top' : 'Frame', 0, c.h - t / 2, carcassZ, c.w - 2 * t, t, carcassDepth, bookcase?.top);
  box('shell_back', 'Back Panel', 0, baseHeight + bodyHeight / 2, -c.d / 2 + b / 2, c.w - 2 * t, bodyHeight - 2 * t, b, bookcase?.back);
  const addPart = (p: CabinetBox, section: string) => box(p.id, section, origin.x + p.position.x + p.dimensions.x / 2, origin.y + p.position.y + p.dimensions.y / 2, origin.z + p.position.z + p.dimensions.z / 2, p.dimensions.x, p.dimensions.y, p.dimensions.z, section === 'Shelves' ? bookcase?.shelves : undefined);
  for (const panel of layout.panels) { const group = addPart(resolvePanel(layout, c.entity.dimensions, panel), panel.kind === 'shelf' ? 'Shelves' : 'Dividers'); group.traverse(child => { child.userData.cabinetPanel = panel; }); }
  const leaves = cabinetLeaves(layout, c.entity.dimensions), pivots = new Map<string, THREE.Group>();
  for (const door of leaves) {
    const { index, left, width, tilt, drawer } = door, height = Math.max(.001, door.top - door.bottom - .004);
    const pivot = new THREE.Group(); pivot.name = `cabinet_door_${index}`;
    pivot.userData = { cabinetDoor: index, cabinetPart: `door_${index}`, swingSign: tilt ? 1 : left ? -1 : 1, swingAxis: tilt ? 'x' : 'y', slide: drawer };
    const pose = cabinetDoorPose(c.entity.dimensions, layout, index), closed = cabinetDoorPose(c.entity.dimensions, layout, index, 0);
    pivot.position.set(pose.position.x, pose.position.y, pose.position.z); pivot.rotation.set(pose.rotationX, pose.rotationY, 0);
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x: number, y: number, z: number) => {
      const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z);
      part.userData = { section, cabinetPart: `door_${index}`, cabinetDoor: index, isSwingCollider: true };
      part.castShadow = part.receiveShadow = true; pivot.add(part); return part;
    };
    const leaf = mesh(new THREE.BoxGeometry(Math.max(.001, width), height, t), mirrorCabinet ? c.materials.mirrorNonReflective : body, mirrorCabinet ? 'Mirrors' : `Door ${index + 1}`, (tilt || drawer) ? 0 : (left ? 1 : -1) * width / 2, (tilt || drawer) ? height / 2 : (height + .004) / 2, pose.leafOffsetZ);
    leaf.userData.isSwingLeaf = true;
    if (!mirrorCabinet) mesh(new THREE.BoxGeometry((tilt || drawer) ? Math.min(.128, width * .6) : .012, (tilt || drawer) ? .012 : Math.min(.128, height / 3), .025), c.materials.metalChrome, 'Handles', (tilt || drawer) ? 0 : (left ? 1 : -1) * (width - .035), drawer ? height * .70 : tilt ? height - .04 : height / 2, pose.leafOffsetZ + t / 2 + .0125);
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
    const tray = cabinetDrawer(layout, c.entity.dimensions, door);
    if (tray) {
      pivots.set(tray.floor.id, pivot); pivot.userData.closedPosition = closed.position;
      pivot.userData.drawerUsable = tray.usable;
      for (const box of tray.walls) {
        const p = box.position, d = box.dimensions;
        mesh(new THREE.BoxGeometry(d.x, d.y, d.z), body, 'Drawer Box', origin.x + p.x + d.x / 2 - closed.position.x, origin.y + p.y + d.y / 2 - closed.position.y, origin.z + p.z + d.z / 2 - closed.position.z);
      }
      for (const side of [-1, 1]) box(`drawer_rail_${index}_${side}`, 'Telescopic Slides', origin.x + tray.floor.position.x + (side < 0 ? -.004 : tray.floor.dimensions.x + .004), origin.y + tray.floor.position.y + .025, origin.z + tray.floor.position.z + tray.floor.dimensions.z / 2, .006, .025, tray.floor.dimensions.z, c.materials.metalChrome);
    }
    c.parent.add(pivot);
  }
  for (const drawer of layout.internalDrawers ?? []) {
    const tray = cabinetInternalDrawer(layout, c.entity.dimensions, drawer), pivot = new THREE.Group();
    pivot.name = `cabinet_part_${tray.floor.id}`;
    pivot.position.z = tray.travel * tray.extension;
    pivot.userData = { cabinetPart: tray.floor.id, closedPosition: { x: 0, y: 0, z: 0 }, drawerUsable: tray.usable, internalDrawer: drawer.id };
    for (const part of tray.walls) {
      const p = part.position, d = part.dimensions, mesh = new THREE.Mesh(new THREE.BoxGeometry(d.x, d.y, d.z), body);
      mesh.position.set(origin.x + p.x + d.x / 2, origin.y + p.y + d.y / 2, origin.z + p.z + d.z / 2);
      mesh.userData = { section: 'Internal Drawer', cabinetPart: tray.floor.id, isSwingCollider: true };
      mesh.castShadow = mesh.receiveShadow = true; pivot.add(mesh);
    }
    for (const side of [-1, 1]) box(`${tray.floor.id}_rail_${side}`, 'Telescopic Slides', origin.x + tray.floor.position.x + (side < 0 ? -.004 : tray.floor.dimensions.x + .004), origin.y + drawer.bottom + .025, origin.z + tray.floor.position.z + drawer.depth / 2, .006, .025, drawer.depth, c.materials.metalChrome);
    pivots.set(tray.floor.id, pivot); c.parent.add(pivot);
  }
  for (const content of layout.contents) {
    const resolved = resolveContent(layout, c.entity.dimensions, content), f = footprint(content.dimensions, content.rotationY), group = new THREE.Group();
    group.name = `cabinet_content_${content.id}`; group.userData = { cabinetPart: content.id, cabinetContent: content };
    group.position.set(origin.x + resolved.position.x + f.x / 2, origin.y + resolved.position.y, origin.z + resolved.position.z + f.z / 2); group.rotation.y = content.rotationY;
    const entity = new StandardFurniture({ id: content.id, assetKey: content.assetKey, name: content.assetKey, displayName: content.name, category: 'decor', position: { x: 0, y: 0, z: 0 }, rotationY: 0, dimensions: content.dimensions, finish: content.finish, sectionFinishes: content.sectionFinishes });
    const model = buildContent?.(entity);
    if (model) { model.traverse(child => { child.userData.cabinetPart = content.id; child.userData.cabinetContent = content; }); group.add(model); }
    const rootSupport = contentSupportRoot(layout, content);
    const pivot = rootSupport ? pivots.get(rootSupport) : undefined;
    if (pivot) {
      const offset = pivot.userData.closedPosition;
      group.position.sub(new THREE.Vector3(offset.x, offset.y, offset.z)); group.userData.cabinetClosedOffset = offset; pivot.add(group);
    } else c.parent.add(group);
  }
}
