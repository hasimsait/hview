import { OpeningEntity,WallEntity } from '@core/types/plan';
import * as THREE from 'three';
import { createTextileMaterial } from '../materials/TextileMaterial';
import { applyBasicOcclusionShader,createOcclusionUniforms } from '../materials/OcclusionShader';
import { SurfaceMaterialFactory } from "../materials/SurfaceMaterialFactory";
import { CurtainMeshBuilder,type CurtainMount } from './CurtainMeshBuilder';

export class OpeningMeshBuilder {
  private readonly leaves = new WeakMap<THREE.Object3D, THREE.Mesh>();
  private readonly pivots = new WeakMap<THREE.Object3D, THREE.Object3D>();
  private readonly frames = new WeakMap<THREE.Object3D, THREE.Mesh[]>();
  private readonly windowPanes = new WeakMap<THREE.Object3D, THREE.Mesh[]>();
  interactionTarget(root: THREE.Object3D): THREE.Object3D | undefined { return this.pivots.get(root); }

  // Shared occlusion uniforms — driven each frame via updateOrbitPlane()
  private occlusionUniforms = createOcclusionUniforms();

  private frameMaterial: THREE.MeshStandardMaterial;
  private windowFrameMaterial: THREE.MeshStandardMaterial;
  private doorMaterial: THREE.MeshStandardMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;
  private glassMaterial: THREE.MeshPhysicalMaterial;
  private sillMaterial: THREE.MeshStandardMaterial;
  private curtainMaterial: THREE.MeshStandardMaterial;
  private curtainBuilder: CurtainMeshBuilder;

  get palette(): readonly THREE.Material[] { return [this.frameMaterial, this.windowFrameMaterial, this.doorMaterial, this.handleMaterial, this.glassMaterial, this.sillMaterial, this.curtainMaterial]; }

  constructor(private finishService?: SurfaceMaterialFactory) {
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x333338,
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
    });
    this.windowFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f4ef, roughness: .55, metalness: 0, transparent: true });

    this.doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6cbb8,
      roughness: 0.6,
      metalness: 0.05,
      transparent: true,
    });

    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0d5dd,
      roughness: 0.2,
      metalness: 0.9,
      transparent: true,
    });

    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      metalness: 0,
      transmission: 0,
      depthWrite: false,
      ior: 1.5,
    });

    this.sillMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f4f6,
      roughness: 0.4,
      transparent: true,
    });

    this.curtainMaterial = createTextileMaterial(); this.curtainMaterial.transparent = true;
    this.curtainBuilder = new CurtainMeshBuilder(this.curtainMaterial, this.handleMaterial, (color, sheer) => {
      const material = this.curtainMaterial.clone(); material.color.set(color);
      material.opacity = sheer ? .28 : 1; material.depthWrite = !sheer;
      applyBasicOcclusionShader(material, this.occlusionUniforms, .6); return material;
    });

    for (const mat of [this.frameMaterial, this.windowFrameMaterial, this.doorMaterial, this.handleMaterial, this.sillMaterial, this.curtainMaterial, this.glassMaterial]) {
      applyBasicOcclusionShader(mat, this.occlusionUniforms, 0.6);
    }
  }

  updateOrbitPlane(orbitCenter: THREE.Vector3, cameraDir: THREE.Vector3): void {
    this.occlusionUniforms.uOrbitCenter.value.copy(orbitCenter);
    this.occlusionUniforms.uCameraDir.value.copy(cameraDir);
  }

  setForegroundMode(mode: 'off' | 'transparent' | 'clip'): void {
    this.occlusionUniforms.uForegroundMode.value =
      mode === 'transparent' ? 1 : mode === 'clip' ? 2 : 0;
  }



  buildOpening(opening: OpeningEntity, wall: WallEntity, mount: CurtainMount = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = `opening_${opening.id}`;

    const dx = wall.p2.x - wall.p1.x;
    const dz = wall.p2.y - wall.p1.y;
    const angle = Math.atan2(dz, dx);
    const wallThick = wall.thickness || 0.1;

    // Opening world center on floor
    const posX = wall.p1.x + Math.cos(angle) * opening.distanceAlongWall;
    const posZ = wall.p1.y + Math.sin(angle) * opening.distanceAlongWall;

    group.position.set(posX, 0, posZ);
    group.rotation.y = -angle;

    const isDoor = opening.type === 'door' || opening.type === 'door_coupe';

    if (isDoor) {
      this.buildDoor(group, opening, wallThick);
    } else {
      this.buildWindow(group, opening, wallThick, mount.interiorSide ?? (wall.roomSideA || !wall.roomSideB ? 1 : -1));
      if (opening.curtainState !== 'removed') group.add(this.curtainBuilder.build(opening, wall, mount));

    }

    // Tag group and all descendants for raycasting and inspection
    group.userData = {
      isOpening: true,
      isDoor,
      openingId: opening.id,
      opening,
      wall,
    };
    group.traverse((child) => {
      child.userData = {
        ...child.userData,
        isOpening: true,
        isDoor,
        openingId: opening.id,
        opening,
        wall,
      };
    });

    return group;
  }

  private buildDoor(parent: THREE.Group, opening: OpeningEntity, wallThick: number): void {
    const w = opening.width;
    const h = opening.height;
    const frameThick = 0.05;
    const frameDepth = wallThick + 0.01;

    // Frame (Left, Right, Top)
    const sideGeom = new THREE.BoxGeometry(frameThick, h, frameDepth);
    const topGeom = new THREE.BoxGeometry(w, frameThick, frameDepth);

    const frameMaterial = this.frameFor(opening);
    const leftFrame = new THREE.Mesh(sideGeom, frameMaterial);
    leftFrame.name = `doorFrame_left_${opening.id}`;
    leftFrame.position.set(-w / 2 + frameThick / 2, h / 2, 0);

    const rightFrame = new THREE.Mesh(sideGeom, frameMaterial);
    rightFrame.name = `doorFrame_right_${opening.id}`;
    rightFrame.position.set(w / 2 - frameThick / 2, h / 2, 0);

    const topFrame = new THREE.Mesh(topGeom, frameMaterial);
    topFrame.name = `doorFrame_top_${opening.id}`;
    topFrame.position.set(0, h - frameThick / 2, 0);

    parent.add(leftFrame, rightFrame, topFrame);
    this.frames.set(parent, [leftFrame, rightFrame, topFrame]);

    const reveal = .003;
    const doorLeafW = Math.max(.001, w - frameThick * 2 - reveal * 2);
    const doorLeafH = Math.max(.001, h - frameThick - reveal * 2);
    const leafThick = 0.04;

    // The immutable opening supplies canonical swing and hinge orientation.
    const swingSide: 'r' | 'l' = opening.swingSide ?? 'r';
    const hingeSide: 'r' | 'l' = opening.hingeSide ?? 'r';

    // When swingSide === hingeSide, hinge is at -w/2 (towards wall p1).
    // When swingSide !== hingeSide, hinge is at +w/2 (towards wall p2).
    const hingeOnLeft = swingSide === hingeSide;

    // Determine opening angle in degrees (default 40 degrees ajar)
    const openAngleDeg = opening.openAngle !== undefined ? opening.openAngle : 40;

    const leafMat = opening.finish && this.finishService
      ? this.finishService.getMaterial(opening.finish, { projection: 'local' })
      : this.doorMaterial;

    if (opening.type === 'door_coupe') {
      // Sliding door (door_coupe): offset leaf along frame based on openAngleDeg (0 = closed, 90 = open)
      const openRatio = Math.max(0, Math.min(1, openAngleDeg / 90));
      const slider = new THREE.Group(); slider.name = `doorSlider_${opening.id}`;
      slider.userData = { slideAxis: 'x', slideSign: hingeOnLeft ? 1 : -1, slideDistance: doorLeafW };
      slider.position.x = (hingeOnLeft ? 1 : -1) * doorLeafW * openRatio;
      this.pivots.set(parent, slider); parent.add(slider);
      const leafGeom = new THREE.BoxGeometry(doorLeafW, doorLeafH, leafThick);
      const leafMesh = new THREE.Mesh(leafGeom, leafMat);
      this.leaves.set(parent, leafMesh);
      leafMesh.name = `doorLeaf_${opening.id}`;
      // The panel travels in front of the jamb, rather than through its solid frame.
      const zOffset = (swingSide === 'r' ? 1 : -1) * (frameDepth / 2 + leafThick / 2 + .003);
      leafMesh.position.set(0, reveal + doorLeafH / 2, zOffset);
      leafMesh.castShadow = true;
      leafMesh.userData.isSwingLeaf = true; slider.add(leafMesh);

      // Handle recess
      const handleGeom = new THREE.BoxGeometry(0.02, 0.14, leafThick + 0.005);
      const handleMesh = new THREE.Mesh(handleGeom, this.handleMaterial);
      handleMesh.position.set(hingeOnLeft ? -doorLeafW * 0.35 : doorLeafW * 0.35, 1.0, zOffset);
      handleMesh.userData.isSwingCollider = true; slider.add(handleMesh);
      return;
    }

    // Hinged door
    const doorPivot = new THREE.Group();
    doorPivot.name = `doorPivot_${opening.id}`;
    const pivotX = hingeOnLeft ? -w / 2 + frameThick + reveal : w / 2 - frameThick - reveal;
    // The hinge barrel sits on the opening face, not in the middle of the
    // jamb. Otherwise the leaf cuts through its own frame as soon as it turns.
    const face = swingSide === 'r' ? 1 : -1;
    const leafOffsetZ = -face * leafThick / 2;
    doorPivot.position.set(pivotX, 0, face * (frameDepth / 2 + .001));

    const leafGeom = new THREE.BoxGeometry(doorLeafW, doorLeafH, leafThick);
    const leafMesh = new THREE.Mesh(leafGeom, leafMat);
    this.leaves.set(parent, leafMesh);

    // Position leaf relative to pivot
    if (hingeOnLeft) {
      leafMesh.position.set(doorLeafW / 2, reveal + doorLeafH / 2, leafOffsetZ);
    } else {
      leafMesh.position.set(-doorLeafW / 2, reveal + doorLeafH / 2, leafOffsetZ);
    }
    leafMesh.castShadow = true;
    leafMesh.userData.isSwingLeaf = true;
    doorPivot.add(leafMesh);

    // Door handles on both sides of the leaf (near latch edge)
    const handleDistFromPivot = hingeOnLeft ? doorLeafW - 0.08 : -(doorLeafW - 0.08);

    // Front handle (+Z)
    const handleFront = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 16), this.handleMaterial);
    handleFront.rotation.x = Math.PI / 2;
    handleFront.position.set(handleDistFromPivot, 1.0, leafOffsetZ + leafThick / 2 + 0.03);

    // Back handle (-Z)
    const handleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 16), this.handleMaterial);
    handleBack.rotation.x = Math.PI / 2;
    handleBack.position.set(handleDistFromPivot, 1.0, leafOffsetZ - leafThick / 2 - 0.03);

    handleFront.userData.isSwingCollider = handleBack.userData.isSwingCollider = true;
    doorPivot.add(handleFront, handleBack);

    // Opening angle: open towards the correct room/side
    // In Three.js, rotation around +Y by negative angle swings +X towards +Z!
    // So when hingeOnLeft (leaf extends +X):
    //   swingSide === 'r' -> -swingAngle (swings into +Z)
    //   swingSide === 'l' -> +swingAngle (swings into -Z)
    // When hingeOnRight (leaf extends -X):
    //   swingSide === 'r' -> +swingAngle (swings into +Z)
    //   swingSide === 'l' -> -swingAngle (swings into -Z)
    let swingAngle = (openAngleDeg * Math.PI) / 180;
    if (hingeOnLeft) {
      swingAngle = swingSide === 'r' ? -swingAngle : swingAngle;
    } else {
      swingAngle = swingSide === 'r' ? swingAngle : -swingAngle;
    }

    this.pivots.set(parent, doorPivot);
    doorPivot.userData.swingSign = hingeOnLeft ? (swingSide === 'r' ? -1 : 1) : (swingSide === 'r' ? 1 : -1);
    doorPivot.rotation.y = swingAngle;
    parent.add(doorPivot);
  }

  private frameFor(opening: OpeningEntity): THREE.Material {
    const window = opening.type === 'window' || opening.type === 'french_window';
    const base = window ? this.windowFrameMaterial : this.frameMaterial;
    if (!opening.frameColor) return base;
    if (this.finishService) return this.finishService.getMaterial({ type: 'paint', color: opening.frameColor, roughness: window ? .55 : .5, metalness: window ? 0 : .2 }, { projection: 'local' });
    const material = base.clone();
    material.color.set(opening.frameColor);
    applyBasicOcclusionShader(material, this.occlusionUniforms, 0.6);
    return material;
  }

  update(root: THREE.Object3D, opening: OpeningEntity): void {
    const frames = this.frames.get(root);
    if (frames) {
      const material = this.frameFor(opening);
      for (const frame of frames) frame.material = material;
    }
    if (opening.type === 'window' || opening.type === 'french_window') {
      const material = opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { side: THREE.DoubleSide, projection: 'local' }) : this.glassMaterial;
      for (const pane of this.windowPanes.get(root) ?? []) pane.material = material;
      return;
    }
    const leaf = this.leaves.get(root), pivot = this.pivots.get(root);
    if (!leaf) return;
    leaf.material = opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { projection: 'local' }) : this.doorMaterial;
    const left = (opening.swingSide ?? 'r') === (opening.hingeSide ?? 'r');
    if (pivot?.userData.slideAxis === 'x') {
      pivot.position.x = (left ? 1 : -1) * pivot.userData.slideDistance * Math.max(0, Math.min(1, (opening.openAngle ?? 40) / 90));
    } else if (pivot) {
      const sign = left ? (opening.swingSide === 'r' ? -1 : 1) : (opening.swingSide === 'r' ? 1 : -1);
      pivot.rotation.y = sign * (opening.openAngle ?? 40) * Math.PI / 180;
    }
  }

  private buildWindow(parent: THREE.Group, opening: OpeningEntity, wallThick: number, face: number): void {
    const w = opening.width, h = opening.height, outer = Math.min(.05, w / 8, h / 8), rail = outer * .54, mullion = outer * .8;
    const depth = Math.max(.065, wallThick * .7), material = this.frameFor(opening), frames: THREE.Mesh[] = [], panes: THREE.Mesh[] = [];
    const group = new THREE.Group(); group.name = `windowFrame_${opening.id}`; group.position.y = opening.floorHeight;
    group.userData.windowConstruction = 'two_side_hung_upvc';
    const bar = (name: string, x: number, y: number, z: number, width: number, height: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.001, width), Math.max(.001, height), d), material);
      mesh.name = `${name}_${opening.id}`; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); frames.push(mesh); return mesh;
    };
    for (const side of [-1, 1]) bar(`windowOuter_${side}`, side * (w - outer) / 2, h / 2, 0, outer, h, depth);
    for (const top of [false, true]) bar(`windowOuter_${top ? 'top' : 'bottom'}`, 0, top ? h - outer / 2 : outer / 2, 0, w - 2 * outer, outer, depth);
    bar('windowFixedMullion', 0, h / 2, 0, mullion, h - 2 * outer, depth);
    const sashWidth = Math.max(.02, (w - 2 * outer - mullion) / 2 - .004), sashHeight = Math.max(.02, h - 2 * outer - .004);
    for (const side of [-1, 1]) {
      const label = side < 0 ? 'left' : 'right', x = side * (mullion / 2 + .002 + sashWidth / 2), z = face * .01;
      for (const edge of [-1, 1]) bar(`windowSash_${label}_${edge}`, x + edge * (sashWidth - rail) / 2, h / 2, z, rail, sashHeight, depth * .8);
      for (const top of [false, true]) bar(`windowSash_${label}_${top ? 'top' : 'bottom'}`, x, h / 2 + (top ? 1 : -1) * (sashHeight - rail) / 2, z, sashWidth - 2 * rail, rail, depth * .8);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.001, sashWidth - 2 * rail), Math.max(.001, sashHeight - 2 * rail), .008), opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { side: THREE.DoubleSide, projection: 'local' }) : this.glassMaterial);
      glass.name = `windowGlass_${label}_${opening.id}`; glass.position.set(x, h / 2, z); glass.userData = { isGlazing: true, hingeSide: label }; glass.castShadow = false; group.add(glass); panes.push(glass);
      bar(`windowHandle_${label}`, x - side * (sashWidth / 2 - rail - .014), h * .48, face * (depth / 2 + .018), .014, Math.min(.1, h / 5), .025);
      for (const y of [.25, .75]) bar(`windowHinge_${label}_${y}`, x + side * (sashWidth - rail) / 2, h * y, face * depth * .42, .016, .045, .018);
    }
    this.frames.set(parent, frames); this.windowPanes.set(parent, panes);
    if (opening.type !== 'french_window' && opening.floorHeight > .1) {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + .1, .03, wallThick + .08), this.sillMaterial); sill.name = `windowSill_${opening.id}`; group.add(sill);
    }
    parent.add(group);
  }
}
