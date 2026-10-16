import * as THREE from 'three';
import type { AssetBuilderFn } from './AssetBuildContext';
import { accessoryParts } from './IkeaAccessoryBuilder';
import { addFixtureLight, addStripAreaLight } from '../../lighting/FixtureLight';

export const buildLightingComponent: AssetBuilderFn = c => {
  const model = c.definition?.lightingComponent;
  if (!model) return;
  const p = accessoryParts(c), m = c.materials;
  const housing = c.coloredMaterial?.(model.color, m.whitePaint) ?? m.whitePaint;
  const glow = m.warmLightGlow;
  const emitter = (mesh: THREE.Mesh) => { mesh.userData.isLightEmissive = true; return mesh; };
  const beam = (x: number, y: number, z: number, intensity: number, direction: [number, number, number] = [0, -1, 0], angle = Math.PI / 3) =>
    addFixtureLight(c.parent, [x * c.w, y * c.h, z * c.d], intensity, 8, model.kind === 'pendant' ? 'chandelier' : 'spot', direction, angle);
  const lineSources = () => {
    for (const x of [-.34, 0, .34]) beam(x, -.02, 0, model.kind === 'pendant' ? 5 : 2.5, [0, -1, 0], Math.PI * .42);
  };
  const suspension = (two = false) => {
    p.cylinder(0, .985, 0, .12, .03, housing, 'Canopy');
    for (const x of two ? [-.34, .34] : [0]) p.cylinder(x, two ? .545 : .7, 0, Math.min(.003 / c.w, .015), two ? .87 : .55, m.metalBlack, 'Suspension');
  };
  // Metric circular heads stay circular even on a long track or a twin plate.
  const head = (x: number, z: number, radius: number, height: number, y: number, tilt = 0) => {
    const centerX = x * c.w, centerZ = z * c.d;
    const profile = [[radius, 0], [radius, height], [radius * .73, height], [radius * .73, .006], [radius * .6, 0]];
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 28), housing);
    mesh.position.set(centerX, y, centerZ); mesh.userData.section = 'Heads'; mesh.castShadow = mesh.receiveShadow = true; c.parent.add(mesh);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(radius * .65, radius * .65, Math.min(.004, height * .08), 24), glow);
    lens.position.set(centerX, y + height * .05, centerZ); lens.userData.section = 'Diffusers'; emitter(lens); c.parent.add(lens);
    addFixtureLight(c.parent, [centerX, y - .008, centerZ], 9, 8, 'spot', [tilt, -1, .08], Math.PI / 4);
  };

  switch (model.kind) {
    case 'downlight': {
      if (model.style === 'round') {
        p.lathe([[.5, 0], [.5, 1], [.35, 1], [.35, .15], [.43, 0]], housing, 'Trim');
        emitter(p.cylinder(0, .15, 0, .35, .12, glow, 'Diffuser'));
      } else {
        for (const x of [-.44, .44]) p.box(x, .5, 0, .12, 1, 1, housing, 'Trim');
        for (const z of [-.44, .44]) p.box(0, .5, z, .76, 1, .12, housing, 'Trim');
        emitter(p.box(0, .15, 0, .76, .12, .76, glow, 'Diffuser'));
      }
      beam(0, -.05, 0, 10, [0, -1, 0], Math.PI / 3);
      break;
    }
    case 'surface_spot': {
      p.box(0, .97, 0, model.style === 'double' ? 1 : .8, .06, .8, housing, 'Canopy');
      const radius = Math.min(c.d * .46, c.w * (model.style === 'double' ? .18 : .5));
      for (const x of model.style === 'double' ? [-.28, .28] : [0]) head(x, 0, radius, c.h * .94, 0);
      break;
    }
    case 'track': {
      const corner = model.style === 'l_shape', trackDepth = corner ? .06 : .25;
      p.box(0, .95, corner ? -.5 + trackDepth / 2 : 0, 1, .1, trackDepth, housing, 'Track');
      if (corner) p.box(.475, .95, 0, .05, .1, 1, housing, 'Track');
      const locations: [number, number][] = corner ? [[-.34, -.4], [0, -.4], [.34, -.4], [.44, 0], [.44, .35]] : [[-.34, 0], [0, 0], [.34, 0]];
      const radius = Math.min(.035, c.w * .045, c.d * .24);
      for (const [i, [x, z]] of locations.entries()) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius * .2, radius * .2, c.h * .32, 10), housing);
        stem.position.set(x * c.w, c.h * .74, z * c.d); stem.userData.section = 'Stems'; c.parent.add(stem);
        head(x, z, radius, c.h * .58, 0, i % 2 ? .2 : -.2);
      }
      break;
    }
    case 'pendant': {
      suspension(model.style === 'linear');
      if (model.style === 'dome') {
        p.lathe([[.5, 0], [.48, .18], [.34, .36], [.08, .45], [.06, .45], [.31, .34], [.45, .17], [.47, 0]], housing, 'Shade');
        emitter(p.cylinder(0, .025, 0, .40, .02, glow, 'Diffuser'));
        beam(0, -.02, 0, 18, [0, -1, 0], Math.PI * .43);
      } else if (model.style === 'globe') {
        const geometry = new THREE.SphereGeometry(.5, 32, 20); geometry.scale(1, .48, 1);
        emitter(p.add(geometry, glow, 'Globe', 0, .24, 0));
        p.cylinder(0, .47, 0, .07, .04, housing, 'Socket');
        addFixtureLight(c.parent, [0, .24 * c.h, 0], 14, 9, 'chandelier');
      } else {
        p.box(0, .06, 0, 1, .12, 1, housing, 'Housing');
        emitter(p.box(0, .009, 0, .97, .018, .76, glow, 'Diffuser'));
        lineSources();
      }
      break;
    }
    case 'wall_light': {
      p.box(0, .5, -.47, .6, .65, .06, housing, 'Mount');
      if (model.style === 'up_down') {
        const body = new THREE.CylinderGeometry(.5, .5, 1, 28, 1, true); body.scale(.9, 1, .8);
        p.add(body, housing, 'Housing', 0, .5, .1);
        for (const y of [.025, .975]) emitter(p.cylinder(0, y, .1, .36, .03, glow, 'Diffusers'));
        beam(0, -.02, .1, 6, [0, -1, .1], Math.PI / 4);
        beam(0, 1.02, .1, 6, [0, 1, .1], Math.PI / 4);
      } else {
        const geometry = new THREE.SphereGeometry(.5, 28, 20); geometry.scale(.96, .95, .9);
        emitter(p.add(geometry, glow, 'Shade', 0, .5, .05));
        addFixtureLight(c.parent, [0, c.h * .5, c.d * .52], 8, 6);
      }
      break;
    }
    case 'cabinet_light': {
      p.box(0, .6, 0, 1, .8, 1, housing, 'Housing');
      if (model.style === 'strip') {
        const count = Math.max(3, Math.min(60, Math.round(c.w / .04)));
        for (let i = 0; i < count; i++) emitter(p.box(-.5 + (i + .5) / count, .1, 0, .55 / count, .2, .7, glow, 'LEDs'));
      } else emitter(p.box(0, .1, 0, .97, .2, .8, glow, 'Diffuser'));
      lineSources();
      break;
    }
    case 'cove_light': {
      p.box(0, .1, 0, 1, .2, 1, housing, 'Channel');
      p.box(0, .34, .46, 1, .68, .08, housing, 'Front Lip');
      p.box(0, .5, -.46, 1, 1, .08, housing, 'Back');
      emitter(p.box(0, .25, 0, .98, .10, .18, glow, 'LED Strip'));
      addStripAreaLight(c.parent, [0, c.h * .35, 0], c.w * .98, c.d * .18);
      break;
    }
  }
};
