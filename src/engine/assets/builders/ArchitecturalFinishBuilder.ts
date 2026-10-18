import * as THREE from 'three';
import type { AssetBuilderFn } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';
import { corniceGeometry } from '../../geometry/CorniceGeometry';

/** Extrude a depth/height cross-section along local X, keeping the back at -D/2. */
function linearProfile(points: [number, number][], width: number, height: number, depth: number) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z * depth, y * height)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 12 });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, -depth / 2);
  return geometry;
}

/** Mitred face band: a U for a door, a closed rectangle for decorative wall frames. */
function frameBand(width: number, height: number, inset: number, face: number, depth: number, closed: boolean) {
  const left = -width / 2 + inset, right = width / 2 - inset;
  const top = height - inset, bottom = closed ? inset : 0;
  const shape = new THREE.Shape();
  shape.moveTo(left, bottom); shape.lineTo(left, top); shape.lineTo(right, top); shape.lineTo(right, bottom);
  if (closed) {
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(left + face, bottom + face); hole.lineTo(right - face, bottom + face);
    hole.lineTo(right - face, top - face); hole.lineTo(left + face, top - face); hole.closePath();
    shape.holes.push(hole);
  } else {
    shape.lineTo(right - face, bottom); shape.lineTo(right - face, top - face);
    shape.lineTo(left + face, top - face); shape.lineTo(left + face, bottom); shape.closePath();
  }
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

export const buildArchitecturalFinish: AssetBuilderFn = c => {
  const model = c.definition?.architecturalFinish;
  if (!model) return;
  const p = accessoryParts(c), m = c.materials;
  const body = model.material === 'wood' ? m.woodLight : model.material === 'stone' ? m.ceramicWhite
    : model.material === 'metal' ? c.coloredMaterial?.('#b9bdc2', m.whitePaint) ?? m.whitePaint : m.whitePaint;
  const addMetric = (geometry: THREE.BufferGeometry, section: string, z = 0) => {
    const mesh = new THREE.Mesh(geometry, body);
    mesh.position.z = z; mesh.userData.section = section;
    mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh); return mesh;
  };
  const profile = (points: [number, number][], section: string) => addMetric(linearProfile(points, c.w, c.h, c.d), section);

  switch (model.kind) {
    case 'skirting': {
      if (model.style === 'flat') profile([[0, 0], [1, 0], [1, 1], [0, 1]], 'Board');
      else if (model.style === 'chamfered') profile([[0, 0], [1, 0], [1, .78], [.28, 1], [0, 1]], 'Board');
      else {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(c.d, 0); shape.lineTo(c.d, c.h * .66);
        if (model.style === 'oak') shape.quadraticCurveTo(c.d, c.h, 0, c.h);
        else {
          shape.lineTo(c.d * .85, c.h * .66);
          shape.bezierCurveTo(c.d * .82, c.h * .82, c.d * .22, c.h * .78, c.d * .25, c.h * .94);
          shape.lineTo(c.d * .35, c.h * .94); shape.lineTo(c.d * .35, c.h); shape.lineTo(0, c.h);
        }
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: c.w, bevelEnabled: false, curveSegments: 12 });
        geometry.rotateY(-Math.PI / 2); geometry.translate(c.w / 2, 0, -c.d / 2);
        addMetric(geometry, 'Board');
      }
      break;
    }
    case 'architrave':
    case 'moulding': {
      if (model.kind === 'moulding' && model.style !== 'frame') {
        if (model.style === 'picture_rail') profile([[0, 0], [.75, 0], [1, .35], [1, .65], [.4, .65], [.4, 1], [0, 1]], 'Moulding');
        else profile([[0, 0], [.55, 0], [.55, .1], [.85, .23], [1, .5], [.85, .77], [.55, .9], [.55, 1], [0, 1]], 'Moulding');
        break;
      }
      const closed = model.kind === 'moulding';
      const face = Math.min(closed ? .035 : .07, c.w * .2, c.h * .2);
      addMetric(frameBand(c.w, c.h, 0, face, c.d * (model.style === 'flat' ? 1 : .5), closed), 'Trim', -c.d / 2);
      if (model.style === 'stepped' || closed) {
        addMetric(frameBand(c.w, c.h, face * .15, face * .7, c.d * .3, closed), 'Relief', 0);
        addMetric(frameBand(c.w, c.h, face * .32, face * .36, c.d * .2, closed), 'Relief', c.d * .3);
      } else if (model.style === 'fluted') {
        for (let i = 0; i < 3; i++) addMetric(frameBand(c.w, c.h, face * (.14 + i * .27), face * .13, c.d * .5, false), 'Flutes', 0);
      }
      break;
    }
    case 'sill': {
      // The stone cross-section includes a small underside drip channel near its front.
      const points: [number, number][] = model.style === 'stone'
        ? [[0, 0], [.78, 0], [.78, .18], [.82, .18], [.82, 0], [.94, 0], [1, .22], [1, .78], [.94, 1], [0, 1]]
        : [[0, 0], [.88, 0], [1, .22], [1, .78], [.88, 1], [0, 1]];
      profile(points, 'Sill');
      break;
    }
    case 'threshold': {
      profile([[0, 0], [1, 0], [1, .15], [.78, 1], [.22, 1], [0, .15]], 'Threshold');
      if (model.style === 'metal') for (const x of [-.35, .35]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(.002, c.w * .02, c.d * .05), Math.min(.002, c.w * .02, c.d * .05), c.h * .02, 12), m.metalBlack);
        screw.position.set(x * c.w, c.h * .99, 0); screw.userData.section = 'Fixings'; c.parent.add(screw);
      }
      break;
    }
    case 'cornice': {
      if (model.style === 'cove') addMetric(corniceGeometry(c.w, c.h, c.d), 'Cornice');
      else if (model.style === 'stepped') profile([[0, 0], [.34, 0], [.34, .33], [.67, .33], [.67, .67], [1, .67], [1, 1], [0, 1]], 'Cornice');
      else {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(c.d * .2, 0); shape.lineTo(c.d * .2, c.h * .12);
        shape.bezierCurveTo(c.d * .75, c.h * .12, c.d * .24, c.h * .8, c.d * .86, c.h * .8);
        shape.lineTo(c.d * .86, c.h * .9); shape.lineTo(c.d, c.h * .9); shape.lineTo(c.d, c.h); shape.lineTo(0, c.h); shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: c.w, bevelEnabled: false, curveSegments: 16 });
        geometry.rotateY(-Math.PI / 2); geometry.translate(c.w / 2, 0, -c.d / 2);
        addMetric(geometry, 'Cornice');
      }
      break;
    }
    case 'pelmet': {
      const t = Math.min(.018 / c.d, .15), top = Math.min(.018 / c.h, .15);
      p.box(0, 1 - top / 2, 0, 1, top, 1, body, 'Top');
      if (model.style === 'stepped') {
        for (let i = 0; i < 3; i++) p.box(0, (i + .5) / 3, .5 - t / 2 - (2 - i) * t * .4, 1, 1 / 3, t, body, 'Front');
      } else p.box(0, .5, .5 - t / 2, 1, 1, t, body, 'Front');
      if (model.style === 'returned') {
        const side = Math.min(.018 / c.w, .1);
        for (const sign of [-1, 1]) p.box(sign * (.5 - side / 2), .5, -t / 2, side, 1, 1 - t, body, 'End Returns');
      }
      break;
    }
    case 'panelling': {
      if (model.style === 'slatted') {
        p.box(0, .5, -.4, 1, 1, .2, m.fabricDark, 'Backing');
        const count = Math.max(2, Math.min(80, Math.round(c.w / .04)));
        for (let i = 0; i < count; i++) p.box(-.5 + (i + .5) / count, .5, .1, .68 / count, 1, .8, body, 'Slats');
      } else if (model.style === 'shaker') {
        p.box(0, .5, -.35, 1, 1, .3, body, 'Panels');
        const rail = Math.min(.07 / c.h, .18), stile = Math.min(.07 / c.w, .18), cap = Math.min(.02 / c.h, .05);
        p.box(0, rail / 2, .1, 1, rail, .6, body, 'Rails');
        p.box(0, 1 - rail / 2, .1, 1, rail, .6, body, 'Rails');
        const count = Math.max(1, Math.min(12, Math.round(c.w / .6)));
        for (let i = 0; i <= count; i++) p.box(-.5 + stile / 2 + i * (1 - stile) / count, .5, .1, stile, 1 - rail * 2, .6, body, 'Stiles');
        p.box(0, 1 - cap / 2, 0, 1, cap, 1, body, 'Top Cap');
      } else {
        p.box(0, .5, -.2, 1, 1, .6, body, 'Boards');
        const count = Math.max(2, Math.min(64, Math.round(c.w / .1)));
        for (let i = 1; i < count; i++) {
          const x = -.5 + i / count;
          for (const sign of [-1, 1]) p.box(x + sign * .004 / c.w, .5, .3, .0025 / c.w, .96, .25, body, 'Beads');
        }
        p.box(0, .99, 0, 1, .02, 1, body, 'Top Cap');
      }
      break;
    }
  }
};
