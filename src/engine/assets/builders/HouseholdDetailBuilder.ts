import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetBuildContext } from './AssetBuildContext';
import { accessoryParts, buildIkeaAccessory } from './IkeaAccessoryBuilder';

type Point = [number, number, number];
/** Metric tube radii stay circular when a route's footprint is stretched. */
export function buildHouseholdDetail(c: AssetBuildContext): void {
  const m = c.definition?.householdDetail;
  if (!m) throw new Error(`Missing household detail model for ${c.entity.assetKey}`);
  const p = accessoryParts(c), { materials: mat } = c;
  const body = c.coloredMaterial?.(m.color, mat.whitePaint) ?? mat.whitePaint;
  const dark = mat.metalBlack, metal = mat.metalChrome, white = mat.ceramicWhite;
  const metric = (g: THREE.BufferGeometry, material: THREE.Material, section: string) => {
    const mesh = new THREE.Mesh(g, material); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.section = section;
    mesh.userData.skipOutline = true; c.parent.add(mesh); return mesh;
  };
  const point = ([x, y, z]: Point) => new THREE.Vector3(x * c.w, y * c.h, z * c.d);
  const curve = (points: Point[]) => new THREE.CatmullRomCurve3(points.map(point), false, 'centripetal');
  const tube = (points: Point[], radius: number, material: THREE.Material, section: string) => {
    const path = curve(points); metric(new THREE.TubeGeometry(path, 64, radius, 10, false), material, section); return path;
  };
  const ringAt = (center: THREE.Vector3, direction: THREE.Vector3, radius: number, thickness: number, material: THREE.Material, section: string) => {
    const geo = new THREE.TorusGeometry(radius, thickness, 6, 24);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize())); geo.translate(...center.toArray());
    metric(geo, material, section);
  };
  const hollowRoute = (points: Point[], radius: number, material: THREE.Material, ribbed = false) => {
    const path = tube(points, radius, material, ribbed ? 'Hose' : 'Pipe');
    // Actual inside wall and annular end faces; no solid cap obscures the bore.
    const inside = new THREE.TubeGeometry(path, 64, radius * .76, 10, false), index = inside.index!, normals = inside.attributes.normal;
    for (let i = 0; i < index.count; i += 3) { const first = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, first); }
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    metric(inside, material, 'Inner Bore');
    for (const t of [0, 1]) {
      const center = path.getPoint(t), tangent = path.getTangent(t).normalize();
      const geo = new THREE.RingGeometry(radius * .76, radius * 1.18, 24);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.clone().multiplyScalar(t ? 1 : -1)));
      geo.translate(...center.toArray()); metric(geo, material, 'Connection Rim');
      ringAt(center.clone().addScaledVector(tangent, t ? -radius * .5 : radius * .5), tangent, radius * 1.05, radius * .12, material, 'Coupling');
    }
    if (ribbed) {
      const rings: THREE.BufferGeometry[] = [], length = path.getLength(), n = Math.min(100, Math.max(8, Math.round(length / .012)));
      for (let i = 1; i < n; i++) {
        const t = i / n, center = path.getPointAt(t), tangent = path.getTangentAt(t), geo = new THREE.TorusGeometry(radius * 1.02, radius * .14, 4, 10);
        geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent)); geo.translate(...center.toArray()); rings.push(geo);
      }
      const merged = mergeGeometries(rings); if (merged) metric(merged, material, 'Hose Ribs'); rings.forEach(g => g.dispose());
    }
    return path;
  };
  const plug = (x: number, y: number, z: number) => {
    const scale = Math.min(1, c.w / .4, c.h / .045, c.d / .08);
    p.box(x, y, z, .055 * scale / c.w, .026 * scale / c.h, .035 * scale / c.d, body, 'Plug');
    for (const offset of [-.0095, .0095]) p.box(x + offset * scale / c.w, y, z + .025 * scale / c.d, .004 * scale / c.w, .004 * scale / c.h, .016 * scale / c.d, metal, 'Plug Pins');
  };
  const keys = (x: number, y: number, z: number, width: number, depth: number, rows = 5, cols = 14) => {
    const bits: THREE.BufferGeometry[] = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const g = new THREE.BoxGeometry(width / cols * .78 * c.w, .004 * c.h, depth / rows * .72 * c.d);
      g.translate((x - width / 2 + (col + .5) * width / cols) * c.w, y * c.h, (z - depth / 2 + (row + .5) * depth / rows) * c.d); bits.push(g);
    }
    const merged = mergeGeometries(bits); if (merged) metric(merged, dark, 'Keys'); bits.forEach(g => g.dispose());
  };
  const vessel = (height = 1, radius = .5, section = 'Ceramic', material: THREE.Material = body, y = 0) => {
    p.lathe([[0, 0], [radius * .65, 0], [radius, height * .96], [radius * .98, height], [radius * .88, height], [radius * .58, height * .10], [0, height * .10]], material, section, 0, y, 0);
  };
  switch (m.kind) {
    case 'mirror': {
      if (m.style === 'vanity') {
        p.cylinder(0, .025, 0, .49, .05, body, 'Base'); p.cylinder(0, .28, 0, .025, .48, body, 'Stem');
        const frame = new THREE.CylinderGeometry(.49, .49, .08, 48).rotateX(Math.PI / 2).scale(1, .59, 1);
        p.add(frame, body, 'Frame', 0, .70, 0);
        p.add(new THREE.CircleGeometry(.46, 48).scale(1, .59, 1), mat.mirrorNonReflective, 'Mirror', 0, .70, .045);
      } else if (m.style === 'leaning') {
        const group = new THREE.Group(), ctx = { ...c, parent: group, d: .025, definition: { ...c.definition!, accessory: { kind: 'rectangular_mirror' as const, color: m.color, material: 'paint' as const } } };
        buildIkeaAccessory(ctx); group.rotation.x = -.075; group.position.set(0, 0, c.d * .36); c.parent.add(group);
        for (const x of [-.38, .38]) p.box(x, .03, -.32, .04, .06, .30, dark, 'Floor Supports');
      } else {
        const shape = new THREE.Shape(); shape.moveTo(-.5, 0); shape.lineTo(.5, 0); shape.lineTo(.5, .68); shape.absellipse(0, .68, .5, .32, 0, Math.PI, false, 0); shape.closePath();
        p.add(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -.5), body, 'Frame');
        const inner = shape.clone(); const g = new THREE.ShapeGeometry(inner, 24).scale(.94, .96, 1).translate(0, .02, .501);
        p.add(g, mat.mirrorNonReflective, 'Mirror');
      }
      break;
    }
    case 'plate': {
      const n = m.count ?? 1, height = 1 / n;
      for (let i = 0; i < n; i++) p.lathe([[0, 0], [.30, 0], [.49, height * .70], [.50, height * .9], [.48, height], [.29, height * .28], [0, height * .28]], body, 'Ceramic', 0, i * height, 0);
      break;
    }
    case 'bowl': vessel(); break;
    case 'glass': vessel(1, .5, 'Glass', mat.glass); break;
    case 'mug':
      p.lathe([[0, 0], [.29, 0], [.33, .98], [.32, 1], [.28, 1], [.25, .08], [0, .08]], body, 'Ceramic', -.14, 0, 0);
      p.add(new THREE.TorusGeometry(.20, .035, 8, 32).scale(1, 1.4, 1), body, 'Handle', .26, .53, 0); break;
    case 'kettle':
      p.cylinder(-.03, .035, 0, .36, .07, dark, 'Power Base'); vessel(.72, .33, 'Body', body, .07);
      p.cylinder(0, .82, 0, .25, .10, body, 'Lid'); p.cylinder(0, .91, 0, .07, .08, dark, 'Lid Knob');
      p.add(new THREE.TorusGeometry(.23, .045, 8, 32).scale(.65, 1.4, 1), dark, 'Handle', .30, .50, 0);
      p.rod(new THREE.Vector3(-.22, .55, 0), new THREE.Vector3(-.46, .77, 0), .055, body, 'Spout'); break;
    case 'toaster':
      p.box(0, .34, 0, .94, .62, .94, body, 'Housing');
      for (const x of [-.43, .39]) p.box(x, .74, 0, .08, .18, .94, body, 'Top Rim');
      for (const z of [-.41, 0, .41]) p.box(-.04, .74, z, .74, .18, z === 0 ? .28 : .12, body, 'Top Rim');
      for (const z of [-.22, .22]) { p.box(-.04, .66, z, .70, .012, .12, dark, 'Toast Slots'); p.box(-.04, .83, z - .075, .74, .025, .02, metal, 'Slot Rims'); }
      p.box(.48, .58, 0, .035, .25, .05, dark, 'Lever Track'); p.box(.485, .67, 0, .03, .07, .20, dark, 'Lever');
      p.box(0, .08, .47, .83, .025, .018, dark, 'Crumb Tray'); p.cylinder(.35, .87, .24, .065, .10, dark, 'Control Knob'); break;
    case 'coffee':
      p.box(0, .06, 0, .96, .12, .96, body, 'Base'); p.box(0, .49, -.29, .94, .76, .38, body, 'Housing');
      p.box(0, .78, .06, .94, .22, .68, body, 'Control Fascia'); p.box(-.20, .79, .405, .30, .10, .014, mat.screen, 'Display');
      p.cylinder(0, .61, .22, .14, .11, metal, 'Group Head'); p.box(.14, .56, .24, .44, .055, .08, dark, 'Portafilter Handle');
      p.box(0, .14, .17, .83, .04, .54, metal, 'Drip Tray');
      for (let i = 0; i < 8; i++) p.box(-.34 + i * .097, .165, .17, .025, .01, .48, dark, 'Tray Slots');
      p.lathe([[0, 0], [.13, 0], [.16, .22], [.14, .22], [.10, .03], [0, .03]], white, 'Cup', 0, .18, .20); break;
    case 'microwave':
      p.box(0, .50, -.04, 1, 1, .92, body, 'Housing'); p.box(-.10, .52, .43, .72, .77, .008, mat.glassBlack, 'Door');
      p.box(.23, .52, .47, .025, .61, .025, metal, 'Door Handle'); p.box(.37, .77, .47, .16, .13, .012, mat.screen, 'Display');
      for (const y of [.3, .49]) p.add(new THREE.CylinderGeometry(.06, .06, .02, 20).rotateX(Math.PI / 2), dark, 'Controls', .37, y, .475);
      for (let i = 0; i < 6; i++) p.box(-.25 + i * .09, .99, -.15, .035, .025, .45, dark, 'Vents'); break;
    case 'blender':
      p.cylinder(0, .19, 0, .42, .38, body, 'Motor Base', .30); vessel(.49, .35, 'Jug', mat.glass, .39);
      p.cylinder(0, .90, 0, .38, .04, dark, 'Lid'); p.cylinder(0, .96, 0, .12, .08, dark, 'Lid Cap');
      p.add(new THREE.TorusGeometry(.17, .035, 8, 28).scale(.65, 1.3, 1), body, 'Handle', .35, .64, 0);
      p.box(0, .19, .40, .20, .12, .03, metal, 'Control'); break;
    case 'air_fryer':
      p.box(0, .49, 0, .96, .96, .96, body, 'Housing'); p.box(0, .38, .487, .85, .57, .015, dark, 'Drawer');
      p.box(0, .49, .475, .16, .23, .05, metal, 'Drawer Handle'); p.box(0, .82, .486, .54, .12, .012, mat.screen, 'Display');
      for (let i = 0; i < 6; i++) p.box(0, .25 + i * .07, -.485, .60, .025, .015, dark, 'Rear Vent'); break;
    case 'laundry': {
      if (m.style === 'sorter') {
        for (const x of [-.47, .47]) for (const z of [-.44, .44]) p.box(x, .5, z, .035, 1, .035, metal, 'Frame');
        for (const x of [-.24, .24]) {
          p.box(x, .05, 0, .43, .05, .83, mat.softFabric, 'Fabric Base');
          for (const side of [-1, 1]) { p.box(x + side * .208, .45, 0, .025, .83, .83, body, 'Fabric Bins'); p.box(x, .45, side * .405, .41, .83, .025, body, 'Fabric Bins'); }
        }
      } else {
        p.box(0, .025, 0, .96, .05, .96, body, 'Base');
        // Open lattice, rather than painted dots, keeps the interior visible.
        for (let i = 0; i < 13; i++) for (const z of [-.47, .47]) p.box(-.46 + i * .92 / 12, .47, z, .025, .89, .03, body, 'Lattice');
        for (let i = 0; i < 9; i++) for (const x of [-.47, .47]) p.box(x, .47, -.46 + i * .92 / 8, .03, .89, .025, body, 'Lattice');
        for (const y of [.08, .26, .44, .62, .80, .91]) {
          for (const z of [-.47, .47]) p.box(0, y, z, .96, .025, .03, body, 'Lattice');
          for (const x of [-.47, .47]) p.box(x, y, 0, .03, .025, .96, body, 'Lattice');
        }
        if (m.style === 'lidded') p.box(0, .96, 0, 1, .08, 1, body, 'Lid');
        else for (const x of [-.47, .47]) p.box(x, .975, 0, .045, .05, .32, dark, 'Handles');
      } break;
    }
    case 'bin':
      if (m.style === 'open') vessel(1, .5, 'Body');
      else {
        const count = m.count ?? 1;
        for (let i = 0; i < count; i++) {
          const x = -.5 + (i + .5) / count;
          p.box(x, .47, 0, .96 / count, .94, .96, body, 'Body');
          const lid = count === 1 ? body : c.coloredMaterial?.(['#718d7d', '#b9a15d', '#6a8ca5'][i], mat.whitePaint) ?? body;
          p.box(x, .97, 0, .98 / count, .06, 1, lid, `Lid ${i + 1}`); p.box(x, .04, .475, .22 / count, .06, .04, dark, 'Pedal');
        }
      } break;
    case 'hanger': {
      const hanger = (x: number, y: number, z: number, width: number, height: number, wire = false) => {
        const radius = Math.min(wire ? .0015 : .008, c.d * .30, width * c.w * .018);
        for (const sign of [-1, 1]) tube([[x, y + height * .72, z], [x + sign * width * .48, y + height * .12, z]], radius, wire ? metal : body, 'Shoulders');
        tube([[x - width * .48, y + height * .12, z], [x + width * .48, y + height * .12, z]], radius * .55, wire ? metal : body, 'Trouser Bar');
        const hook: Point[] = [[x, y + height * .70, z], [x, y + height * .89, z], [x + width * .045, y + height * .97, z], [x + width * .09, y + height * .91, z], [x + width * .055, y + height * .84, z]];
        tube(hook, Math.min(c.w, c.h) * .006, metal, 'Hook');
      };
      if (m.style === 'rack') {
        for (const x of [-.46, .46]) { p.box(x, .48, 0, .025, .96, .035, metal, 'Frame'); p.box(x, .018, 0, .08, .036, 1, metal, 'Feet'); }
        p.box(0, .96, 0, .94, .025, .035, metal, 'Rail');
        for (let i = 0; i < 4; i++) hanger(-.29 + i * .19, .80, 0, .43, .15);
      } else hanger(0, 0, 0, 1, 1, m.style === 'wire'); break;
    }
    case 'monitor':
      p.box(0, .025, 0, .48, .05, 1, body, 'Base'); p.box(0, .28, -.10, .065, .48, .10, body, 'Stand');
      p.box(0, .65, -.10, 1, .70, .08, body, 'Bezel'); p.box(0, .65, -.053, .95, .64, .01, mat.screen, 'Screen'); break;
    case 'laptop':
      p.box(0, .025, .02, 1, .05, .96, body, 'Base'); p.box(0, .52, -.46, 1, .96, .06, body, 'Bezel');
      p.box(0, .52, -.425, .93, .85, .01, mat.screen, 'Screen'); keys(0, .053, -.12, .88, .40);
      p.box(0, .053, .25, .32, .008, .22, dark, 'Trackpad'); break;
    case 'keyboard': p.box(0, .40, 0, 1, .80, 1, body, 'Base'); keys(0, .81, 0, .95, .86); break;
    case 'mouse':
      p.add(new THREE.SphereGeometry(1, 20, 12).scale(.5, .48, .5), body, 'Shell', 0, .50, 0); p.box(0, .97, -.10, .07, .04, .16, dark, 'Scroll Wheel'); break;
    case 'printer':
      p.box(0, .40, -.05, 1, .76, .85, body, 'Housing'); p.box(0, .81, -.22, .82, .10, .42, body, 'Scanner Lid');
      p.box(0, .22, .39, .78, .18, .035, dark, 'Output Slot'); p.box(0, .15, .38, .75, .035, .24, body, 'Output Tray');
      p.box(0, .965, -.27, .62, .02, .25, white, 'Paper'); break;
    case 'tray':
      for (const y of [.05, .55]) { p.box(0, y, 0, 1, .05, 1, body, 'Tray Base'); for (const x of [-.48, .48]) p.box(x, y + .19, 0, .04, .38, 1, body, 'Tray Sides'); p.box(0, y + .19, -.48, .94, .38, .04, body, 'Tray Back'); p.box(0, y + .05, 0, .84, .04, .85, white, 'Paper'); } break;
    case 'books':
      for (let i = 0; i < 3; i++) { const y = i / 3, width = .94 - i * .06, depth = .98 - i * .07;
        p.box(0, y + .16, 0, width - .03, .26, depth - .04, white, 'Pages');
        for (const offset of [.015, .31]) p.box(0, y + offset, 0, width, .025, depth, body, `Cover ${i + 1}`);
        p.box(-width / 2 + .015, y + .16, 0, .03, .30, depth, body, 'Spines');
      } break;
    case 'cable': {
      const paths: Record<string, Point[]> = {
        straight: [[-.40, .28, 0], [.1, .28, 0], [.42, .28, 0]],
        bent: [[-.40, .28, -.42], [-.40, .28, .27], [-.32, .28, .40], [.42, .28, .40]],
        loop: [[-.40, .28, -.25], [-.20, .28, -.40], [.22, .28, -.36], [.38, .28, 0], [.18, .28, .35], [-.25, .28, .35], [-.35, .28, .05], [.42, .28, 0]],
      };
      const pts = paths[m.style!] ?? paths.straight; tube(pts, Math.min(.004, c.h * .10, c.d * .1), body, 'Cable'); const last = pts[pts.length - 1]; plug(last[0], .40, last[2]); break;
    }
    case 'extension': {
      const n = m.count ?? 4;
      p.box(-.12, .48, -.25, .70, .88, .42, body, 'Socket Housing');
      for (let i = 0; i < n; i++) {
        const x = -.43 + (i + .5) * .57 / n, radius = Math.min(.022, c.w * .24 / n, c.d * .14);
        const center = point([x, .93, -.25]);
        ringAt(center, new THREE.Vector3(0, 1, 0), radius, .002, body, 'Socket Rim');
        metric(new THREE.CylinderGeometry(radius * .94, radius * .94, .003, 24).translate(center.x, center.y - .002, center.z), dark, 'Socket Recess');
        for (const sign of [-1, 1]) metric(new THREE.CylinderGeometry(.0023, .0023, .002, 10).translate(center.x + sign * radius * .43, center.y, center.z), metal, 'Socket Contacts');
      }
      p.box(.20, .96, -.25, .045, .05, .16, mat.warmLightGlow, 'Power Switch');
      tube([[.23, .30, -.25], [.34, .30, -.15], [.32, .30, .24], [.42, .30, .30]], Math.min(.004, c.h * .09), dark, 'Cable'); plug(.42, .40, .30); break;
    }
    case 'pipe': {
      const r = Math.min(.020, c.h * .37, c.d * .37, c.w * .25);
      if (m.style === 'straight') hollowRoute([[-.45, .50, 0], [.45, .50, 0]], r, body);
      else if (m.style === 'elbow') hollowRoute([[-.40, .17, 0], [.05, .17, 0], [.30, .30, 0], [.33, .85, 0]], r, body);
      else { hollowRoute([[-.37, .20, 0], [0, .20, 0], [.37, .20, 0]], r, body); hollowRoute([[0, .20, 0], [0, .85, 0]], r, body); }
      break;
    }
    case 'trap': {
      const r = Math.min(.020, c.d * .30, c.w * .10, c.h * .10);
      if (m.style === 'p') hollowRoute([[-.30, .90, 0], [-.30, .35, 0], [-.20, .16, 0], [0, .18, 0], [.12, .42, 0], [.40, .48, 0]], r, body);
      else {
        p.cylinder(-.22, .30, 0, .16, .48, body, 'Sump'); p.cylinder(-.22, .065, 0, .17, .06, body, 'Cleanout Cap');
        hollowRoute([[-.22, .48, 0], [-.22, .92, 0]], r, body); hollowRoute([[-.22, .44, 0], [.39, .44, 0]], r, body);
      } break;
    }
    case 'hose': {
      const pts: Point[] = m.style === 'drain'
        ? [[-.40, .08, -.25], [-.18, .08, .32], [.14, .12, .27], [.26, .70, .08], [.26, .92, -.10], [.38, .91, -.20], [.40, .70, -.20]]
        : [[-.40, .20, -.20], [-.28, .20, .32], [.12, .20, .34], [.35, .20, -.25], [.13, .20, -.35], [-.10, .20, -.10], [.40, .20, .05]];
      const radius = Math.min(m.style === 'drain' ? .012 : .008, c.h * .055, c.d * .1);
      const path = hollowRoute(pts, radius, body, m.style === 'drain');
      if (m.style === 'inlet') for (const t of [0, 1]) { const tangent = path.getTangent(t), center = path.getPoint(t); ringAt(center, tangent, radius * 1.4, radius * .35, body, 'Threaded Nut'); }
      break;
    }
    case 'panel':
      for (const x of [-.47, .47]) p.box(x, .5, 0, .06, 1, 1, body, 'Frame');
      for (const y of [.03, .97]) p.box(0, y, 0, .88, .06, 1, body, 'Frame');
      p.box(0, .5, 0, .85, .85, .70, body, 'Hatch'); p.box(.34, .50, .36, .045, .08, .02, dark, 'Latch'); break;
    case 'stop':
      if (m.style === 'wall') {
        p.add(new THREE.CylinderGeometry(.49, .49, .12, 24).rotateX(Math.PI / 2), body, 'Fixing Plate', 0, .5, -.44);
        p.add(new THREE.CylinderGeometry(.16, .16, .72, 24).rotateX(Math.PI / 2), body, 'Stem', 0, .5, -.04);
        p.add(new THREE.CylinderGeometry(.22, .22, .20, 24).rotateX(Math.PI / 2), dark, 'Rubber Buffer', 0, .5, .40);
      } else if (m.style === 'wedge') {
        const shape = new THREE.Shape(); shape.moveTo(-.5, 0); shape.lineTo(.5, 0); shape.lineTo(-.5, 1); shape.closePath();
        p.add(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-.5, 0, 0), body, 'Wedge');
      } else { p.cylinder(0, .04, 0, .49, .08, body, 'Fixing Plate'); p.cylinder(0, .53, 0, .27, .94, body, 'Stem'); p.cylinder(0, .72, 0, .33, .18, dark, 'Rubber Buffer'); }
      break;
  }
  // Basket openings remain real while the repeated lattice shares one draw call.
  const lattice = c.parent.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && o.userData.section === 'Lattice');
  if (lattice.length > 1) {
    const geometries = lattice.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
    const merged = mergeGeometries(geometries);
    if (merged) { lattice.forEach(mesh => { c.parent.remove(mesh); mesh.geometry.dispose(); }); metric(merged, body, 'Lattice'); }
    geometries.forEach(g => g.dispose());
  }
}
