import * as THREE from 'three';
import type { Room } from '../../domain/elements/Room';
import type { Point2D } from '../../domain/model/PlanData';

function contains(polygon: readonly Point2D[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > z) !== (b.y > z) && x < (b.x - a.x) * (z - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Rasterized once per room-layout change. One room lookup per fragment,
 * independent of the number of walls, fixtures or door positions. */
export class FixtureRooms {
  readonly texture: THREE.DataTexture;
  readonly bounds: THREE.Vector4;
  constructor(readonly rooms: readonly Room[], readonly resolution = 1024) {
    const points = rooms.flatMap(room => room.polygon);
    const minX = points.length ? Math.min(...points.map(p => p.x)) - .25 : 0;
    const minZ = points.length ? Math.min(...points.map(p => p.y)) - .25 : 0;
    const width = points.length ? Math.max(...points.map(p => p.x)) + .25 - minX : 1;
    const depth = points.length ? Math.max(...points.map(p => p.y)) + .25 - minZ : 1;
    this.bounds = new THREE.Vector4(minX, minZ, width, depth);
    const data = new Float32Array(resolution * resolution);
    rooms.forEach((room, index) => {
      for (let row = 0; row < resolution; row++) {
        const z = minZ + (row + .5) * depth / resolution, crossings: number[] = [];
        for (let i = 0, j = room.polygon.length - 1; i < room.polygon.length; j = i++) {
          const a = room.polygon[i], b = room.polygon[j];
          if ((a.y > z) !== (b.y > z)) crossings.push(a.x + (z - a.y) * (b.x - a.x) / (b.y - a.y));
        }
        crossings.sort((a, b) => a - b);
        for (let i = 1; i < crossings.length; i += 2) {
          const left = Math.max(0, Math.ceil((crossings[i - 1] - minX) * resolution / width - .5));
          const right = Math.min(resolution, Math.ceil((crossings[i] - minX) * resolution / width - .5));
          if (right > left) data.fill(index + 1, row * resolution + left, row * resolution + right);
        }
      }
    });
    this.texture = new THREE.DataTexture(data, resolution, resolution, THREE.RedFormat, THREE.FloatType);
    this.texture.needsUpdate = true;
  }
  at(x: number, z: number, fallbackId?: string): number {
    const index = this.rooms.findIndex(room => contains(room.polygon, x, z));
    return index >= 0 ? index + 1 : fallbackId ? Math.max(0, this.rooms.findIndex(room => room.id === fallbackId) + 1) : 0;
  }
  dispose(): void { this.texture.dispose(); }
}
