import * as THREE from 'three';
import type { WindowDressingStyle } from '../../domain/model/WindowDressing';

/** Standalone and window-fitted dressings share metric geometry, with their bottom at zero. */
export function buildWindowDressing(parent: THREE.Group, w: number, h: number, d: number, style: WindowDressingStyle, openness: number,
  fabric: THREE.Material, sheer: THREE.Material, hardware: THREE.Material): void {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, section: string, x = 0, y = 0, z = 0, textile = false, transparent = false) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
    mesh.userData = { section, isTextile: textile, isSheer: transparent, skipOutline: textile };
    mesh.castShadow = !transparent; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, mat: THREE.Material, section: string) =>
    add(new THREE.BoxGeometry(width, height, depth), mat, section, x, y, z);
  const railHeight = Math.min(.025, h * .05);
  if (['roller', 'roman', 'venetian'].includes(style)) {
    box(0, h - railHeight / 2, 0, w, railHeight, d, hardware, 'Headrail');
    const room = h - railHeight * 2, stack = h * (style === 'roller' ? .025 : .12);
    const drop = room * (1 - openness) + stack * openness, top = h - railHeight * 1.5;
    if (style === 'venetian') {
      const count = Math.max(6, Math.min(48, Math.round(h / .05))), pitch = drop / count;
      for (let i = 0; i < count; i++) {
        const slat = box(0, top - pitch * (i + .5), 0, w * .98, Math.min(.002, h * .005), d * .9, fabric, 'Slats');
        slat.rotation.x = .12;
      }
      for (const sign of [-1, 1]) box(sign * w * .3, top - drop / 2, d * .46, Math.min(.012, w * .02), drop, d * .02, hardware, 'Ladder Tapes');
    } else {
      const geo = new THREE.PlaneGeometry(w * .98, drop, 32, style === 'roman' ? 48 : 8), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const down = .5 - pos.getY(i) / drop;
        pos.setZ(i, style === 'roman' ? Math.sin(down * Math.PI * 12) * d * .32 : Math.sin(pos.getX(i) / w * Math.PI * 4) * d * .015);
      }
      geo.computeVertexNormals(); add(geo, fabric, 'Fabric', 0, top - drop / 2, 0, true);
      if (style === 'roller') {
        const roller = new THREE.CylinderGeometry(Math.min(d * .36, railHeight * .7), Math.min(d * .36, railHeight * .7), w * .98, 24); roller.rotateZ(Math.PI / 2);
        add(roller, fabric, 'Roller', 0, h - railHeight * .72, 0, true);
      }
    }
    box(0, Math.max(railHeight / 2, top - drop), 0, w * .99, railHeight * .65, d * .85, hardware, 'Bottom Rail');
    return;
  }
  const top = h - railHeight - .004, bottom = Math.min(.015, h * .015), drop = Math.max(.001, top - bottom);
  const panels = (material: THREE.Material, open: number, z: number, translucent: boolean, section: string) => {
    const width = w * .5 * (1 - .72 * open), segments = 48;
    for (const direction of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(width, drop, segments, 16), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const across = pos.getX(i) / width + .5, down = .5 - pos.getY(i) / drop;
        pos.setZ(i, Math.sin(across * Math.PI * 12 + down * .2) * d * (.14 + down * .045));
      }
      geo.computeVertexNormals();
      add(geo, material, section, direction * (w - width) / 2, (top + bottom) / 2, z, true, translucent);
    }
  };
  if (style === 'layered') {
    for (const sign of [-1, 1]) box(0, h - railHeight / 2, sign * d * .22, w, railHeight, d * .2, hardware, 'Tracks');
    panels(sheer, 0, -d * .22, true, 'Sheer Fabric'); panels(fabric, openness, d * .2, false, 'Blackout Fabric');
  } else {
    box(0, h - railHeight / 2, 0, w, railHeight, d * .3, hardware, 'Track');
    panels(style === 'sheer' ? sheer : fabric, openness, 0, style === 'sheer', style === 'sheer' ? 'Sheer Fabric' : 'Blackout Fabric');
  }
}
