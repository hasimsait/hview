import * as THREE from 'three';
import { AssetBuildContext, AssetBuilderFn } from './AssetBuildContext';

/**
 * Polymorphic strategy interface for procedural assets.
 * Each asset type encapsulates its geometry generation, metric dimensions,
 * section definitions, and dimension resolution.
 */
export interface IAssetStrategy {
  readonly key: string;
  readonly aliases?: string[];
  build(context: AssetBuildContext): void;
}

/**
 * Base abstract class providing common helpers for metric dimension resolution.
 */
export abstract class BaseAssetStrategy implements IAssetStrategy {
  abstract readonly key: string;
  readonly aliases?: string[];

  abstract build(context: AssetBuildContext): void;

  /**
   * Strictly preserves user-customized dimensions if valid (> 0),
   * falling back to the default metric dimension only when undefined or invalid.
   */
  protected resolveDim(val: number | undefined, defaultVal: number, min = 0.01): number {
    if (val !== undefined && !isNaN(val) && val >= min) {
      return val;
    }
    return defaultVal;
  }
}

/**
 * Adapter strategy allowing functional asset builders to be used as polymorphic strategies.
 */
export class FunctionalAssetStrategy extends BaseAssetStrategy {
  constructor(
    public readonly key: string,
    public readonly aliases: string[] = [],
    private buildFn: AssetBuilderFn
  ) {
    super();
  }

  build(context: AssetBuildContext): void {
    this.buildFn(context);
  }
}

/**
 * Polymorphic Shelving Strategy:
 * Generates an architectural multi-tier open shelving unit whose height, width,
 * and depth scale dynamically to whatever dimensions the user specifies,
 * with horizontal shelf tiers computed proportionally along the exact vertical height.
 */
export class ShelvingStrategy extends BaseAssetStrategy {
  readonly key = 'open_shelving';
  readonly aliases = ['open_shelving', 'shelving', 'shelf', 'pencil_cabinet'];

  build(context: AssetBuildContext): void {
    const { parent, w, h, d, materials } = context;
    const shelfW = this.resolveDim(w, 1.0);
    const shelfH = this.resolveDim(h, 1.8);
    const shelfD = this.resolveDim(d, 0.35);

    const group = new THREE.Group();
    const frameMat = materials.woodDark;
    const shelfMat = materials.woodDark;

    const uprightThick = 0.025;
    const shelfThick = 0.022;

    // Left upright panel
    const leftUpright = new THREE.Mesh(
      new THREE.BoxGeometry(uprightThick, shelfH, shelfD),
      frameMat
    );
    leftUpright.userData.section = 'Frame';
    leftUpright.position.set(-shelfW / 2 + uprightThick / 2, shelfH / 2, 0);
    leftUpright.castShadow = true;
    leftUpright.receiveShadow = true;
    group.add(leftUpright);

    // Right upright panel
    const rightUpright = new THREE.Mesh(
      new THREE.BoxGeometry(uprightThick, shelfH, shelfD),
      frameMat
    );
    rightUpright.userData.section = 'Frame';
    rightUpright.position.set(shelfW / 2 - uprightThick / 2, shelfH / 2, 0);
    rightUpright.castShadow = true;
    rightUpright.receiveShadow = true;
    group.add(rightUpright);

    // Back panel (structural back)
    const backW = Math.max(0.05, shelfW - uprightThick * 2);
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(backW, shelfH, 0.008),
      frameMat
    );
    backPanel.userData.section = 'Frame';
    backPanel.position.set(0, shelfH / 2, -shelfD / 2 + 0.004);
    backPanel.castShadow = true;
    group.add(backPanel);

    // Dynamic shelf tiers calculated proportionally from actual height
    const innerW = Math.max(0.05, shelfW - uprightThick * 2);
    const innerD = Math.max(0.05, shelfD - 0.012);
    const numTiers = Math.max(2, Math.min(10, Math.round(shelfH / 0.38) + 1));
    const tierSpacing = (shelfH - shelfThick) / (numTiers - 1);

    for (let i = 0; i < numTiers; i++) {
      const tierY = shelfThick / 2 + i * tierSpacing;
      const shelfMesh = new THREE.Mesh(
        new THREE.BoxGeometry(innerW, shelfThick, innerD),
        shelfMat
      );
      shelfMesh.userData.section = 'Shelves';
      shelfMesh.position.set(0, tierY, 0.004);
      shelfMesh.castShadow = true;
      shelfMesh.receiveShadow = true;
      group.add(shelfMesh);
    }

    // Optional front lids / cabinet doors
    const hasLids = !!(context.entity?.hasLids ?? context.entity?.rawItem?.hasLids);
    if (hasLids) {
      const doorThick = 0.018;
      const doorH = Math.max(0.2, shelfH - 0.02);
      const doorZ = shelfD / 2 + doorThick / 2;
      const isDoubleDoor = shelfW >= 0.70;

      if (isDoubleDoor) {
        const doorW = (shelfW - 0.008) / 2;
        const leftDoor = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, doorH, doorThick),
          frameMat
        );
        leftDoor.userData.section = 'Lids';
        leftDoor.position.set(-doorW / 2 - 0.002, shelfH / 2, doorZ);
        leftDoor.castShadow = true;
        leftDoor.receiveShadow = true;

        const rightDoor = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, doorH, doorThick),
          frameMat
        );
        rightDoor.userData.section = 'Lids';
        rightDoor.position.set(doorW / 2 + 0.002, shelfH / 2, doorZ);
        rightDoor.castShadow = true;
        rightDoor.receiveShadow = true;

        // Vertical handles
        const handleGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 12);
        const leftHandle = new THREE.Mesh(handleGeom, materials.metalChrome);
        leftHandle.userData.section = 'Handles';
        leftHandle.position.set(-0.025, shelfH / 2, doorZ + doorThick / 2 + 0.006);
        leftHandle.castShadow = true;

        const rightHandle = new THREE.Mesh(handleGeom, materials.metalChrome);
        rightHandle.userData.section = 'Handles';
        rightHandle.position.set(0.025, shelfH / 2, doorZ + doorThick / 2 + 0.006);
        rightHandle.castShadow = true;

        group.add(leftDoor, rightDoor, leftHandle, rightHandle);
      } else {
        const doorW = shelfW - 0.004;
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, doorH, doorThick),
          frameMat
        );
        door.userData.section = 'Lids';
        door.position.set(0, shelfH / 2, doorZ);
        door.castShadow = true;
        door.receiveShadow = true;

        const handleGeom = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 12);
        const handle = new THREE.Mesh(handleGeom, materials.metalChrome);
        handle.userData.section = 'Handles';
        handle.position.set(doorW / 2 - 0.04, shelfH / 2, doorZ + doorThick / 2 + 0.006);
        handle.castShadow = true;

        group.add(door, handle);
      }
    }

    parent.add(group);
  }
}
