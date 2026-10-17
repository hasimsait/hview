import * as THREE from 'three';
import type { AssetBuildContext } from './AssetBuildContext';

function slab(c: AssetBuildContext, width: number, thickness: number, depth: number, bottom: number, offset = 0): void {
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), c.materials.graniteCounter);
  top.name = `worktop_${c.entity.id}`; top.userData.section = 'Countertop';
  top.position.set(0, bottom + thickness / 2, offset); top.castShadow = top.receiveShadow = true; c.parent.add(top);
}
/** Standalone dimensions describe the actual slab; elevation is its underside. */
export function buildWorktop(c: AssetBuildContext): void { slab(c, c.w, c.h, c.d, 0); }
/** Preserve the kitchen module's existing 4 cm top, overhang and elevation. */
export function buildCabinetWorktop(c: AssetBuildContext): void { slab(c, c.w + .02, .04, c.d + .04, c.h, .01); }
