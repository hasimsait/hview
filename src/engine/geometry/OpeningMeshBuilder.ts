import { OpeningEntity,WallEntity } from '@core/types/plan';
import * as THREE from 'three';
import { applyBasicOcclusionShader,createOcclusionUniforms } from '../materials/OcclusionShader';
import { SurfaceMaterialFactory } from "../materials/SurfaceMaterialFactory";

export class OpeningMeshBuilder {
  private readonly leaves = new WeakMap<THREE.Object3D, THREE.Mesh>();
  private readonly slideHandles = new WeakMap<THREE.Object3D, THREE.Mesh>();
  private readonly pivots = new WeakMap<THREE.Object3D, THREE.Object3D>();
  interactionTarget(root: THREE.Object3D): THREE.Object3D | undefined { return this.pivots.get(root); }

  // Shared occlusion uniforms — driven each frame via updateOrbitPlane()
  private occlusionUniforms = createOcclusionUniforms();

  private frameMaterial: THREE.MeshStandardMaterial;
  private doorMaterial: THREE.MeshStandardMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;
  private glassMaterial: THREE.MeshPhysicalMaterial;
  private sillMaterial: THREE.MeshStandardMaterial;

  get palette(): readonly THREE.Material[] { return [this.frameMaterial, this.doorMaterial, this.handleMaterial, this.glassMaterial, this.sillMaterial]; }

  constructor(private finishService?: SurfaceMaterialFactory) {
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x333338,
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
    });

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
      color: 0xd8eeff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.5,
    });

    this.sillMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f4f6,
      roughness: 0.4,
      transparent: true,
    });

    // Apply orbit-fade shader to all opaque standard materials (glass excluded)
    for (const mat of [this.frameMaterial, this.doorMaterial, this.handleMaterial, this.sillMaterial]) {
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



  buildOpening(opening: OpeningEntity, wall: WallEntity): THREE.Group {
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
      this.buildWindow(group, opening, wallThick);
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

    const leftFrame = new THREE.Mesh(sideGeom, this.frameMaterial);
    leftFrame.position.set(-w / 2 + frameThick / 2, h / 2, 0);

    const rightFrame = new THREE.Mesh(sideGeom, this.frameMaterial);
    rightFrame.position.set(w / 2 - frameThick / 2, h / 2, 0);

    const topFrame = new THREE.Mesh(topGeom, this.frameMaterial);
    topFrame.position.set(0, h - frameThick / 2, 0);

    parent.add(leftFrame, rightFrame, topFrame);

    const doorLeafW = w - frameThick * 2;
    const doorLeafH = h - frameThick;
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
      const leafGeom = new THREE.BoxGeometry(doorLeafW, doorLeafH, leafThick);
      const leafMesh = new THREE.Mesh(leafGeom, leafMat);
      this.leaves.set(parent, leafMesh);
      leafMesh.name = `doorLeaf_${opening.id}`;
      const slideOffset = hingeOnLeft ? doorLeafW * openRatio : -doorLeafW * openRatio;
      const zOffset = swingSide === 'r' ? leafThick * 0.6 : -leafThick * 0.6;
      leafMesh.position.set(slideOffset, doorLeafH / 2, zOffset);
      leafMesh.castShadow = true;
      parent.add(leafMesh);

      // Handle recess
      const handleGeom = new THREE.BoxGeometry(0.02, 0.14, leafThick + 0.005);
      const handleMesh = new THREE.Mesh(handleGeom, this.handleMaterial);
      handleMesh.position.set(slideOffset + (hingeOnLeft ? -doorLeafW * 0.35 : doorLeafW * 0.35), 1.0, zOffset);
      parent.add(handleMesh);
      this.slideHandles.set(parent, handleMesh);
      return;
    }

    // Hinged door
    const doorPivot = new THREE.Group();
    doorPivot.name = `doorPivot_${opening.id}`;
    const pivotX = hingeOnLeft ? -w / 2 + frameThick : w / 2 - frameThick;
    doorPivot.position.set(pivotX, 0, 0);

    const leafGeom = new THREE.BoxGeometry(doorLeafW, doorLeafH, leafThick);
    const leafMesh = new THREE.Mesh(leafGeom, leafMat);
    this.leaves.set(parent, leafMesh);

    // Position leaf relative to pivot
    if (hingeOnLeft) {
      leafMesh.position.set(doorLeafW / 2, doorLeafH / 2, 0);
    } else {
      leafMesh.position.set(-doorLeafW / 2, doorLeafH / 2, 0);
    }
    leafMesh.castShadow = true;
    doorPivot.add(leafMesh);

    // Door handles on both sides of the leaf (near latch edge)
    const handleDistFromPivot = hingeOnLeft ? doorLeafW - 0.08 : -(doorLeafW - 0.08);

    // Front handle (+Z)
    const handleFront = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 16), this.handleMaterial);
    handleFront.rotation.x = Math.PI / 2;
    handleFront.position.set(handleDistFromPivot, 1.0, leafThick / 2 + 0.03);

    // Back handle (-Z)
    const handleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 16), this.handleMaterial);
    handleBack.rotation.x = Math.PI / 2;
    handleBack.position.set(handleDistFromPivot, 1.0, -leafThick / 2 - 0.03);

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
    doorPivot.rotation.y = swingAngle;
    parent.add(doorPivot);
  }

  update(root: THREE.Object3D, opening: OpeningEntity): void {
    const leaf = this.leaves.get(root), pivot = this.pivots.get(root);
    if (!leaf) return;
    if (opening.type === 'window' || opening.type === 'french_window') {
      leaf.material = opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { side: THREE.DoubleSide, projection: 'local' }) : this.glassMaterial;
      return;
    }
    leaf.material = opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { projection: 'local' }) : this.doorMaterial;
    const left = (opening.swingSide ?? 'r') === (opening.hingeSide ?? 'r');
    if (pivot) {
      const sign = left ? (opening.swingSide === 'r' ? -1 : 1) : (opening.swingSide === 'r' ? 1 : -1);
      pivot.rotation.y = sign * (opening.openAngle ?? 40) * Math.PI / 180;
    } else {
      const offset = (left ? 1 : -1) * (opening.width - 0.08) * Math.max(0, Math.min(1, (opening.openAngle ?? 40) / 90));
      const delta = offset - leaf.position.x;
      leaf.position.x = offset;
      const handle = this.slideHandles.get(root); if (handle) handle.position.x += delta;
    }
  }

  private buildWindow(parent: THREE.Group, opening: OpeningEntity, wallThick: number): void {
    const w = opening.width;
    const h = opening.height;
    const baseY = opening.floorHeight;
    const frameThick = 0.04;
    const frameDepth = wallThick * 0.6;

    const frameGroup = new THREE.Group();
    frameGroup.position.y = baseY;

    // Outer frame (4 sides)
    const sideGeom = new THREE.BoxGeometry(frameThick, h, frameDepth);
    const horizGeom = new THREE.BoxGeometry(w, frameThick, frameDepth);

    const leftFrame = new THREE.Mesh(sideGeom, this.frameMaterial);
    leftFrame.position.set(-w / 2 + frameThick / 2, h / 2, 0);

    const rightFrame = new THREE.Mesh(sideGeom, this.frameMaterial);
    rightFrame.position.set(w / 2 - frameThick / 2, h / 2, 0);

    const bottomFrame = new THREE.Mesh(horizGeom, this.frameMaterial);
    bottomFrame.position.set(0, frameThick / 2, 0);

    const topFrame = new THREE.Mesh(horizGeom, this.frameMaterial);
    topFrame.position.set(0, h - frameThick / 2, 0);

    frameGroup.add(leftFrame, rightFrame, bottomFrame, topFrame);

    // Central mullion if window is wider than 1.2m
    if (w > 1.2) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(frameThick, h - frameThick * 2, frameDepth), this.frameMaterial);
      mullion.position.set(0, h / 2, 0);
      frameGroup.add(mullion);
    }

    // Glass pane
    const glassGeom = new THREE.BoxGeometry(w - frameThick * 2, h - frameThick * 2, 0.015);
    const glassMesh = new THREE.Mesh(glassGeom, opening.finish && this.finishService ? this.finishService.getMaterial(opening.finish, { side: THREE.DoubleSide, projection: 'local' }) : this.glassMaterial);
    this.leaves.set(parent, glassMesh);
    glassMesh.position.set(0, h / 2, 0);
    frameGroup.add(glassMesh);

    // Window sill (exterior and interior ledge) if not a french window
    if (opening.type !== 'french_window' && baseY > 0.1) {
      const sillGeom = new THREE.BoxGeometry(w + 0.1, 0.03, wallThick + 0.08);
      const sillMesh = new THREE.Mesh(sillGeom, this.sillMaterial);
      sillMesh.position.set(0, 0, 0);
      frameGroup.add(sillMesh);
    }

    parent.add(frameGroup);
  }
}
