import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AssetBuilderFn } from './AssetBuildContext';
import type { WindowDressingStyle } from '../../../domain/model/WindowDressing';
import { buildWindowDressing } from '../../geometry/WindowDressingGeometry';

/** Cloth is modelled in normalized coordinates, then baked into the chosen metric envelope. */
export const buildSoftFurnishing: AssetBuilderFn = c => {
  const model = c.definition?.softFurnishing;
  if (!model) return;
  const base = model.style === 'venetian' ? c.materials.whitePaint : c.materials.softFabric;
  const body = c.coloredMaterial?.(model.color, base) ?? base;
  const accent = c.coloredMaterial?.(model.accentColor, c.materials.softFabric) ?? c.materials.softFabric;
  if (model.fabric === 'velvet') body.roughness = .72;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, section: string, x = 0, y = 0, z = 0) => {
    geo.scale(c.w, c.h, c.d); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x * c.w, y * c.h, z * c.d);
    mesh.userData = { section, isTextile: true, skipOutline: true }; mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh); return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, section: string) => add(new THREE.BoxGeometry(w, h, d), mat, section, x, y, z);
  const puff = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, section: string, round = false) => {
    const geo = new THREE.SphereGeometry(1, 40, 24), p = geo.attributes.position;
    const rounded = (v: number, power: number) => Math.sign(v) * Math.pow(Math.abs(v), power) * .5;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, rounded(p.getX(i), round ? 1 : .42) * w, rounded(p.getY(i), round ? 1 : .38) * h, rounded(p.getZ(i), .65) * d);
    geo.computeVertexNormals(); return add(geo, mat, section, x, y, z);
  };
  const line = (points: THREE.Vector3[], mat: THREE.Material, section: string, radius = .002) => {
    // Build in metric space, so a wide rug or shallow quilt does not flatten its binding.
    const metric = points.map(p => new THREE.Vector3(p.x * c.w, p.y * c.h, p.z * c.d));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(metric), Math.max(8, points.length * 3), Math.min(radius, c.h * .06, c.w * .01, c.d * .01), 5, false);
    geo.scale(1 / c.w, 1 / c.h, 1 / c.d); return add(geo, mat, section);
  };
  const binding = (y: number, width = .96, depth = .96, section = 'Binding') => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) { const a = i * Math.PI / 32; points.push(new THREE.Vector3(Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** .35 * width / 2, y, Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** .35 * depth / 2)); }
    return line(points, accent, section);
  };
  const fringe = (edge: number, y: number, count = 30) => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.CylinderGeometry(.0012, .0012, c.d * .025, 5); geo.rotateX(Math.PI / 2);
      geo.translate((-.46 + i * .92 / (count - 1)) * c.w, y * c.h, edge * c.d); pieces.push(geo);
    }
    const merged = mergeGeometries(pieces); for (const piece of pieces) piece.dispose();
    if (merged) { merged.scale(1 / c.w, 1 / c.h, 1 / c.d); add(merged, accent, 'Fringe'); }
  };

  if (model.kind === 'curtain' || model.kind === 'blind') {
    const sheer = c.coloredMaterial?.(model.style === 'layered' ? model.accentColor : model.color, c.materials.softFabric) ?? c.materials.softFabric.clone();
    sheer.opacity = .28; sheer.transparent = true; sheer.depthWrite = false;
    buildWindowDressing(c.parent, c.w, c.h, c.d, model.style as WindowDressingStyle, c.entity.windowCoveringOpen ?? (model.kind === 'blind' ? .25 : .65), body, sheer, c.materials.whitePaint);
    return;
  }
  if (model.kind === 'rug') {
    if (model.style === 'round') {
      add(new THREE.CylinderGeometry(.5, .5, .65, 64), body, 'Pile', 0, .325, 0);
      const ring = new THREE.TorusGeometry(.476, .012, 5, 64); ring.rotateX(Math.PI / 2); add(ring, accent, 'Binding', 0, .68, 0);
    } else {
      box(0, .25, 0, 1, .5, .96, body, 'Pile');
      const geo = new THREE.PlaneGeometry(.99, .95, 48, 48), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getY(i), pile = model.style === 'shag' ? .65 + .23 * Math.sin(x * 130) * Math.cos(z * 120) : .55;
        p.setXYZ(i, x, pile, z);
      }
      geo.computeVertexNormals(); add(geo, body, 'Pile'); binding(.62, .96, .92);
      if (['border', 'runner'].includes(model.style)) {
        for (const sign of [-1, 1]) {
          box(sign * .43, .59, 0, .035, .05, .84, accent, 'Border');
          box(0, .59, sign * .405, .895, .05, .035, accent, 'Border');
        }
      } else if (model.style === 'striped' || model.style === 'jute') {
        for (let i = 0; i < (model.style === 'jute' ? 24 : 7); i++) box(0, .59, -.4 + i * .8 / (model.style === 'jute' ? 23 : 6), .94, .05, model.style === 'jute' ? .006 : .035, accent, 'Pattern');
      } else if (model.style === 'geometric') {
        for (const x of [-.22, 0, .22]) for (const z of [-.28, 0, .28]) line([
          new THREE.Vector3(x, .6, z - .1), new THREE.Vector3(x + .085, .6, z), new THREE.Vector3(x, .6, z + .1), new THREE.Vector3(x - .085, .6, z), new THREE.Vector3(x, .6, z - .1),
        ], accent, 'Pattern', .004);
      }
      if (model.style === 'striped') { fringe(-.48, .4); fringe(.48, .4); }
    }
    return;
  }
  if (model.kind === 'cushion') {
    if (model.style === 'bolster') {
      const geo = new THREE.CylinderGeometry(.5, .5, .98, 40); geo.rotateZ(Math.PI / 2); add(geo, body, 'Fabric', 0, .5, 0);
      for (const sign of [-1, 1]) { const seam = new THREE.TorusGeometry(.47, .012, 5, 40); seam.rotateY(Math.PI / 2); add(seam, accent, 'Piping', sign * .48, .5, 0); }
    } else {
      puff(0, .5, 0, .98, .98, .98, body, 'Fabric', model.style === 'round');
      if (model.style === 'round') {
        const piping = new THREE.TorusGeometry(.47, .012, 5, 64); add(piping, accent, 'Piping', 0, .5, 0);
        add(new THREE.SphereGeometry(.035, 16, 10), accent, 'Button', 0, .5, .46);
      } else {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 64; i++) { const a = i * Math.PI / 32; points.push(new THREE.Vector3(Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** .42 * .475, .5 + Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** .42 * .475, 0)); }
        line(points, accent, 'Piping', .004);
        if (model.style === 'lumbar') box(0, .5, .47, .12, .6, .015, accent, 'Stripe');
      }
    }
    return;
  }
  if (model.kind === 'throw') {
    if (model.style === 'folded') {
      for (let i = 0; i < 3; i++) puff(0, .17 + i * .31, 0, .98, .3, .98, i === 1 ? accent : body, 'Fabric');
    } else {
      const geo = new THREE.PlaneGeometry(.96, .96, 48, 48), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getY(i), down = (z + .48) / .96;
        const fold = .025 * Math.sin(x * 32 + down * 2) * Math.sin(down * Math.PI);
        const t = Math.max(0, (down - .42) / .58), y = .96 * (1 - t * t * (3 - 2 * t));
        p.setXYZ(i, x, Math.max(.02, Math.min(.98, y + fold)), z);
      }
      geo.computeVertexNormals(); add(geo, body, 'Fabric');
      if (model.style === 'knitted') {
        for (let i = 0; i < 18; i++) {
          const x = -.44 + i * .88 / 17, points: THREE.Vector3[] = [];
          for (let j = 0; j <= 24; j++) { const u = j / 24, t = Math.max(0, (u - .42) / .58); points.push(new THREE.Vector3(x + .003 * Math.sin(j * 3), Math.max(.025, .96 * (1 - t * t * (3 - 2 * t)) + .01), -.48 + u * .96)); }
          line(points, accent, 'Knitted Ribs', .004);
        }
      }
      if (model.style === 'fringed' || model.style === 'knitted') fringe(.48, .025);
    }
    return;
  }
  if (model.style === 'pillows') {
    for (const sign of [-1, 1]) puff(sign * .25, .5, 0, .47, .96, .98, body, 'Pillowcases');
    binding(.45, .94, .92, 'Piping');
  } else if (model.style === 'bed_set') {
    puff(0, .3, .12, .98, .6, .73, body, 'Duvet');
    puff(0, .53, -.13, .96, .18, .12, accent, 'Cuff');
    for (const sign of [-1, 1]) puff(sign * .24, .56, -.35, .43, .86, .26, body, 'Pillowcases');
    puff(0, .6, .3, .97, .1, .18, accent, 'Runner');
  } else {
    puff(0, .5, 0, .98, .96, .98, body, model.style === 'quilt' ? 'Quilt' : 'Duvet');
    if (model.style === 'duvet') puff(0, .7, -.32, .95, .25, .16, accent, 'Cuff');
    else {
      for (let i = 1; i < 12; i++) line([new THREE.Vector3(-.4, .94, -.4 + i * .8 / 12), new THREE.Vector3(0, .98, -.4 + i * .8 / 12), new THREE.Vector3(.4, .94, -.4 + i * .8 / 12)], accent, 'Stitching', .001);
    }
  }
};
