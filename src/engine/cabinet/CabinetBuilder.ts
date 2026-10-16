import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { StandardFurniture, type Furniture } from '../../domain/elements/Furniture';
import { cabinetDoorPose, defaultCabinet, footprint, interiorOrigin, resolveContent, resolvePanel, type CabinetBox } from '../../domain/cabinet/CabinetLayout';

export function buildCabinet(c: AssetBuildContext, buildContent?: (entity: Furniture) => THREE.Object3D): void {
  const layout = c.entity.cabinet ?? defaultCabinet(c.entity.toData(), c.definition?.cabinetDoors ?? 2), t = layout.panelThickness, b = layout.backThickness;
  const carcassDepth = c.d - (layout.doors.count ? t : 0), carcassZ = layout.doors.count ? -t / 2 : 0;
  const body = c.materials.whitePaint, origin = interiorOrigin(c.entity.dimensions, layout);
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
  const count = layout.doors.count;
  for (let index = 0; index < count; index++) {
    const left = count === 2 ? index === 0 : layout.doors.hinge === 'left', width = (c.w - .004) / count - .002;
    const pivot = new THREE.Group(); pivot.name = `cabinet_door_${index}`; pivot.userData = { cabinetDoor: index, cabinetPart: `door_${index}`, swingSign: left ? -1 : 1 };
    const pose = cabinetDoorPose(c.entity.dimensions, layout, index);
    pivot.position.set(pose.position.x, pose.position.y, pose.position.z); pivot.rotation.y = pose.rotationY;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(width, c.h - .004, t), body); leaf.position.set((left ? 1 : -1) * width / 2, c.h / 2, 0);
    leaf.userData = { section: `Door ${index + 1}`, cabinetPart: `door_${index}`, cabinetDoor: index, isSwingLeaf: true }; leaf.castShadow = leaf.receiveShadow = true; pivot.add(leaf);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.012, Math.min(.128, c.h / 3), .025), c.materials.metalChrome);
    handle.position.set((left ? 1 : -1) * (width - .035), c.h / 2, t / 2 + .0125); handle.userData = { section: 'Handles', cabinetPart: `door_${index}`, cabinetDoor: index }; pivot.add(handle); c.parent.add(pivot);
  }
  for (const content of layout.contents) {
    const resolved = resolveContent(layout, c.entity.dimensions, content), f = footprint(content.dimensions, content.rotationY), group = new THREE.Group();
    group.name = `cabinet_content_${content.id}`; group.userData = { cabinetPart: content.id, cabinetContent: content };
    group.position.set(origin.x + resolved.position.x + f.x / 2, origin.y + resolved.position.y, origin.z + resolved.position.z + f.z / 2); group.rotation.y = content.rotationY;
    const entity = new StandardFurniture({ id: content.id, assetKey: content.assetKey, name: content.assetKey, displayName: content.name, category: 'decor', position: { x: 0, y: 0, z: 0 }, rotationY: 0, dimensions: content.dimensions, finish: content.finish, sectionFinishes: content.sectionFinishes });
    const model = buildContent?.(entity);
    if (model) { model.traverse(child => { child.userData.cabinetPart = content.id; child.userData.cabinetContent = content; }); group.add(model); }
    c.parent.add(group);
  }
}
