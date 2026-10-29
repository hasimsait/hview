import * as THREE from 'three';

type DoorMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, section: string, x: number, y: number, z: number) => THREE.Mesh;

/** OXBERG-style wood frame with panel/glass or full-height glazing.
 * Every part shares the existing door pivot; glazing uses alpha transparency. */
export function panelGlassDoor(mesh: DoorMesh, wood: THREE.Material, glass: THREE.Material, width: number, height: number, thickness: number, left: boolean, z: number, index: number, fullGlass = false): THREE.Mesh {
  const centreX = (left ? 1 : -1) * width / 2, rail = Math.min(.036, width / 5), middle = height / 2, cross = .045;
  const section = `Door ${index + 1}`, innerWidth = Math.max(.001, width - 2 * rail);
  const box = (x: number, y: number, w: number, h: number, d: number, material = wood, label = section, depth = z) =>
    mesh(new THREE.BoxGeometry(w, Math.max(.001, h), d), material, label, centreX + x, y, depth);
  for (const sign of [-1, 1]) box(sign * (width - rail) / 2, height / 2, rail, height, thickness);
  box(0, rail / 2, innerWidth, rail, thickness); box(0, height - rail / 2, innerWidth, rail, thickness);
  const glazing = (y: number, h: number) => {
    const pane = box(0, y, innerWidth, h, .003, glass, 'Glass', z - .002);
    pane.userData.isGlazing = true; pane.castShadow = false; return pane;
  };
  let leaf: THREE.Mesh;
  const short = fullGlass && height <= .6;
  if (short) leaf = glazing(middle, height - 2 * rail);
  else {
    box(0, middle, innerWidth, cross, thickness);
    const fieldHeight = Math.max(.001, middle - cross / 2 - rail);
    leaf = fullGlass ? glazing(rail + fieldHeight / 2, fieldHeight) : box(0, rail + fieldHeight / 2, innerWidth, fieldHeight, .006, wood, section, z - .004);
    glazing(middle + cross / 2 + fieldHeight / 2, fieldHeight);
  }
  leaf.userData.isSwingLeaf = true;
  const knob = mesh(new THREE.CylinderGeometry(.011, .011, .024, 16), wood, 'Handles', (left ? 1 : -1) * (width - .03), short ? rail : middle, z + thickness / 2 + .012);
  knob.rotation.x = Math.PI / 2;
  return leaf;
}
