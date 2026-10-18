import * as THREE from 'three';
import type { AssetBuildContext } from './AssetBuildContext';

function roundedRect(w: number, h: number, radius: number, x = -w / 2, y = 0): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y); shape.lineTo(x + w - radius, y); shape.quadraticCurveTo(x + w, y, x + w, y + radius);
  shape.lineTo(x + w, y + h - radius); shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  shape.lineTo(x + radius, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y); shape.closePath();
  return shape;
}
function circleHole(x: number, y: number, radius: number): THREE.Path {
  const path = new THREE.Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); return path;
}

export function buildElectricalFitting(c: AssetBuildContext): void {
  const spec = c.definition?.electrical;
  if (!spec) throw new Error('Electrical fitting needs a catalogue specification');
  const { w, h, d, materials: m } = c, bubble = spec.series === 'bubble';
  const innerWidth = spec.control === 'double_socket' ? .88 : .76;
  const frame = c.coloredMaterial?.(spec.frameColor, m.whitePaint) ?? m.whitePaint;
  const insert = c.coloredMaterial?.(spec.insertColor, m.whitePaint) ?? m.whitePaint;
  frame.roughness = bubble ? .16 : .32; insert.roughness = bubble ? .2 : .32;
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x = 0, y = 0, z = 0, smooth = false) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.name = `${section.toLowerCase().replace(/ /g, '_')}_${c.entity.id}`;
    mesh.userData = { section, skipOutline: smooth }; mesh.castShadow = mesh.receiveShadow = true;
    c.parent.add(mesh); return mesh;
  };
  const extrude = (shape: THREE.Shape, depth: number) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });

  if (bubble) {
    // A smooth convex annular shell: the opening remains genuinely hollow.
    const curve = new THREE.SplineCurve([
      [.29, -.35], [.38, -.5], [.46, -.3], [.5, 0], [.49, .22], [.45, .42], [.39, .5], [.32, .4], [.29, .22], [.29, -.35],
    ].map(([r, z]) => new THREE.Vector2(r, z)));
    const points = curve.getPoints(72).map(p => new THREE.Vector2(Math.min(.5, Math.max(.29, p.x)), Math.min(.5, Math.max(-.5, p.y))));
    const geometry = new THREE.LatheGeometry(points, 64);
    geometry.rotateX(Math.PI / 2); geometry.scale(w, h, d);
    // Lathe radii initially span X/Z; after rotation they span X/Y.
    add(geometry, frame, 'Frame', 0, h / 2, 0, true);
  } else {
    const outer = roundedRect(w, h, h * .025);
    const opening = roundedRect(w * innerWidth, h * .76, h * .012, -w * innerWidth / 2, h * .12);
    outer.holes.push(new THREE.Path(opening.getPoints().reverse()));
    add(extrude(outer, d * .45), frame, 'Frame', 0, 0, -d / 2);
  }

  const socket = spec.control === 'socket' || spec.control === 'double_socket';
  if (!socket) {
    const double = spec.control === 'double_switch';
    if (bubble) {
      const radius = Math.min(w, h) * .27, gap = radius * .025;
      for (let i = 0; i < (double ? 2 : 1); i++) {
        const rocker = new THREE.Shape();
        if (double) {
          const delta = Math.asin(gap / radius);
          rocker.absarc(0, 0, radius, i === 0 ? Math.PI / 2 + delta : -Math.PI / 2 + delta,
            i === 0 ? Math.PI * 1.5 - delta : Math.PI / 2 - delta, false);
        } else rocker.absarc(0, 0, radius, 0, Math.PI * 2, false);
        rocker.closePath();
        add(extrude(rocker, d * .1), insert, double ? i === 0 ? 'Left Rocker' : 'Right Rocker' : 'Rocker', 0, h / 2, d * .22, true);
      }
    } else {
      const gap = w * .012, width = w * .68;
      for (let i = 0; i < (double ? 2 : 1); i++) {
        const rockerW = double ? (width - gap) / 2 : width;
        const shape = roundedRect(rockerW, h * .68, h * .012);
        add(extrude(shape, d * .42), insert, double ? i === 0 ? 'Left Rocker' : 'Right Rocker' : 'Rocker',
          double ? (i === 0 ? -1 : 1) * (rockerW + gap) / 2 : 0, h * .16, -d * .02);
      }
    }
    return;
  }

  const contacts = c.coloredMaterial?.('#c1c5c9', m.whitePaint) ?? m.metalChrome;
  if (contacts !== m.metalChrome) { contacts.metalness = .25; contacts.roughness = .3; }

  const centers = spec.control === 'double_socket' ? [-w * .225, w * .225] : [0];
  const wellRadius = h * (bubble ? .225 : .265), outerRadius = h * (bubble ? .285 : .31);
  if (!bubble) {
    const panel = roundedRect(w * innerWidth, h * .76, h * .012, -w * innerWidth / 2, h * .12);
    for (const x of centers) panel.holes.push(circleHole(x, h / 2, outerRadius * .98));
    add(extrude(panel, d * .1), insert, 'Socket Insert', 0, 0, -d * .1);
  }
  centers.forEach(x => {
    const wall = new THREE.LatheGeometry([
      [outerRadius, d * .1], [outerRadius, d * .3], [wellRadius + h * .02, d * .3],
      [wellRadius, d * .16], [wellRadius, -d * .24], [wellRadius - h * .012, -d * .24],
    ].map(([r, z]) => new THREE.Vector2(r, z)), 48);
    wall.rotateX(Math.PI / 2);
    add(wall, insert, 'Socket Insert', x, h / 2, 0, bubble);
    const floor = new THREE.Shape(); floor.absarc(0, 0, wellRadius, 0, Math.PI * 2, false);
    const pinRadius = h * .036, pinSpacing = h * .11;
    for (const direction of [-1, 1]) floor.holes.push(circleHole(bubble ? direction * pinSpacing : 0, bubble ? 0 : direction * pinSpacing, pinRadius));
    add(extrude(floor, d * .04), insert, 'Socket Insert', x, h / 2, -d * .28, true);
    add(new THREE.CircleGeometry(wellRadius, 48), m.metalBlack, 'Pin Openings', x, h / 2, -d * .3, true);
    for (const direction of [-1, 1]) {
      const contact = new THREE.BoxGeometry(h * .055, h * .085, d * .12);
      const mesh = add(contact, contacts, 'Grounding Contacts',
        x + (bubble ? 0 : direction * wellRadius * .88), h / 2 + (bubble ? direction * wellRadius * .88 : 0), d * .04);
      if (!bubble) mesh.rotation.z = Math.PI / 2;
    }
    add(new THREE.CircleGeometry(h * .025, 16), contacts, 'Fixing Screws', x, h / 2, -d * .23, true);
    add(new THREE.BoxGeometry(h * .032, h * .006, d * .008), m.metalBlack, 'Screw Slots', x, h / 2, -d * .222, true);
  });
}
