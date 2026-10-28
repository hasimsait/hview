import * as THREE from 'three';
import type { AssetBuildContext } from '../assets/builders/AssetBuildContext';
import { mergeStaticParts } from '../geometry/MergeStaticParts';

const SHIRT_COLOURS = ['#e9e3d8', '#56778e', '#8c4857', '#96a58b', '#bc9562', '#424f65', '#bfc4c8', '#b77860', '#e0d1ae', '#456a62'];
const DRESS_COLOURS = ['#4e676b', '#a35d70', '#595376', '#be9270', '#344559', '#8e3847', '#8a9364', '#c2a7ad', '#34363c', '#b17156'];

/** The rail is above the clothes, but the placement origin stays at their lowest hem. */
export function buildClothesRail(c: AssetBuildContext): void {
  const dresses = c.entity.assetKey === 'fit_clothes_rail_dresses';
  const scale = Math.min(c.w / .8, c.h / .95, c.d / .5);
  const railY = c.h - .025 * scale, garmentTop = railY - .105 * scale;
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, fixed: boolean) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = fixed ? { fixedFinish: true, skipOutline: true } : { section: 'Rail' };
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const rod = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material, fixed: boolean) => {
    const geometry = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
    return add(parent, geometry, material, fixed);
  };
  const rail = new THREE.Group(); rail.name = 'clothes_rail'; c.parent.add(rail);
  rod(rail, new THREE.Vector3(-c.w / 2 + .012 * scale, railY, 0), new THREE.Vector3(c.w / 2 - .012 * scale, railY, 0), .012 * scale, c.materials.metalChrome, false);
  for (const side of [-1, 1]) rod(rail, new THREE.Vector3(side * (c.w / 2 - .006 * scale), railY, 0), new THREE.Vector3(side * (c.w / 2 - .018 * scale), railY, 0), .020 * scale, c.materials.metalChrome, false);
  mergeStaticParts(rail.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh));

  const hangerMaterial = c.coloredMaterial?.('#b8a084', c.materials.woodLight) ?? c.materials.woodLight;
  const hookMaterial = c.coloredMaterial?.('#b8bcc0', c.materials.metalChrome) ?? c.materials.metalChrome;
  const palette = dresses ? DRESS_COLOURS : SHIRT_COLOURS;
  for (let i = 0; i < 10; i++) {
    const x = (-.45 + i * .1) * c.w;
    const hanger = new THREE.Group(); hanger.name = `clothes_hanger_${i + 1}`; c.parent.add(hanger);
    const shoulderY = garmentTop - .045 * scale, shoulderHalf = c.d * .37;
    const neck = new THREE.Vector3(x, garmentTop + .015 * scale, 0);
    for (const side of [-1, 1]) rod(hanger, neck, new THREE.Vector3(x, shoulderY, side * shoulderHalf), .004 * scale, hangerMaterial, true);
    rod(hanger, new THREE.Vector3(x, shoulderY, -shoulderHalf), new THREE.Vector3(x, shoulderY, shoulderHalf), .003 * scale, hangerMaterial, true);
    const hook = new THREE.CatmullRomCurve3([
      neck, new THREE.Vector3(x, railY - .026 * scale, 0),
      new THREE.Vector3(x, railY + .017 * scale, -.012 * scale),
      new THREE.Vector3(x, railY + .013 * scale, .015 * scale),
      new THREE.Vector3(x, railY - .008 * scale, .020 * scale),
    ]);
    const hookMesh = add(hanger, new THREE.TubeGeometry(hook, 16, .0018 * scale, 6, false), hookMaterial, true); hookMesh.name = `hanger_hook_${i + 1}`;
    // Keep the hook identifiable while combining the three wooden hanger bars.
    mergeStaticParts(hanger.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && o !== hookMesh));

    const garment = new THREE.Group(); garment.name = `${dresses ? 'dress' : 'shirt'}_${i + 1}`; c.parent.add(garment);
    const material = c.coloredMaterial?.(palette[i], c.materials.fabricLight) ?? c.materials.fabricLight;
    const detailMaterial = c.coloredMaterial?.(new THREE.Color(palette[i]).lerp(new THREE.Color('#eee7db'), .25).getStyle(), c.materials.fabricLight) ?? material;
    const hem = i % 3 * .012 * c.h, height = garmentTop - hem, width = c.d * .96;
    const points = dresses
      ? [[-.08, 1], [0, .94], [.08, 1], [.22, .96], [.28, .84], [.20, .77], [.14, .58], [.45, 0], [-.45, 0], [-.14, .58], [-.20, .77], [-.28, .84], [-.22, .96]]
      : [[-.11, 1], [.11, 1], [.25, .96], [.45, .85], [.47, .36], [.34, .34], [.28, .76], [.26, 0], [-.26, 0], [-.28, .76], [-.34, .34], [-.47, .36], [-.45, .85], [-.25, .96]];
    const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u * width, hem + v * height)));
    const thickness = .012 * scale;
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: .001 * scale, bevelSize: .001 * scale, bevelSegments: 1, steps: 1 });
    bodyGeometry.computeBoundingBox();
    bodyGeometry.translate(0, hem - bodyGeometry.boundingBox!.min.y, -thickness / 2); bodyGeometry.rotateY(Math.PI / 2); bodyGeometry.translate(x, 0, 0);
    add(garment, bodyGeometry, material, true).userData.isTextile = true;
    const front = x + thickness / 2 + .0015 * scale;
    if (dresses) {
      rod(garment, new THREE.Vector3(front, hem + height * .58, -width * .14), new THREE.Vector3(front, hem + height * .58, width * .14), .003 * scale, detailMaterial, true);
      for (const side of [-1, 0, 1]) rod(garment, new THREE.Vector3(front, hem + height * .55, side * width * .06), new THREE.Vector3(front, hem + height * .02, side * width * .27), .0015 * scale, detailMaterial, true);
    } else {
      for (const side of [-1, 1]) rod(garment, new THREE.Vector3(front, garmentTop, side * width * .10), new THREE.Vector3(front, garmentTop - height * .09, side * width * .045), .004 * scale, detailMaterial, true);
      rod(garment, new THREE.Vector3(front, hem + height * .10, 0), new THREE.Vector3(front, hem + height * .88, 0), .0015 * scale, detailMaterial, true);
      for (let b = 0; b < 5; b++) {
        const button = new THREE.SphereGeometry(.0025 * scale, 6, 4);
        button.translate(front + .001 * scale, hem + height * (.18 + b * .13), 0);
        add(garment, button, detailMaterial, true);
      }
    }
    mergeStaticParts(garment.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh));
  }
}
