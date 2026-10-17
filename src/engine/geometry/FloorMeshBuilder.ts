import { RoomEntity } from '@core/types/plan';
import { ISurfaceFinishService } from '@core/types/services';
import * as THREE from 'three';
import { BrowserCanvasFactory,type CanvasFactory } from '../materials/CanvasFactory';
import { buildBalconyRailing } from './BalconyRailingGeometry';
import { openRailingRuns } from '../../domain/model/BalconyRailing';
import type { WallEntity } from '../../core/types/plan';

export class FloorMeshBuilder {
  private readonly surfaces = new WeakSet<THREE.Mesh>();
  private parquetTexture: THREE.CanvasTexture;
  private tileTexture: THREE.CanvasTexture;
  private floorMaterials: Map<string, THREE.MeshStandardMaterial> = new Map();

  get palette(): readonly THREE.Material[] { return [this.getMaterial('parquet'), this.getMaterial('tile')]; }

  constructor(
    private finishService?: ISurfaceFinishService,
    private readonly canvas: CanvasFactory = new BrowserCanvasFactory()
  ) {
    this.parquetTexture = this.generateParquetTexture();
    this.tileTexture = this.generateTileTexture();
  }

  buildFloor(room: RoomEntity, showLabels: boolean = false, walls: readonly WallEntity[] = []): THREE.Group {
    const group = new THREE.Group();
    group.name = `room_${room.id}`;
    group.userData = { type: 'room', id: room.id, name: room.name, area: room.area };

    // Skip building floor for invalid polygons or tiny spaces/chimneys (< 0.5 m²)
    if (!room.polygon || room.polygon.length < 3 || room.area < 0.5) return group;

    const shape = new THREE.Shape();
    // Use polygon coordinates
    shape.moveTo(room.polygon[0].x, -room.polygon[0].y);
    for (let i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i].x, -room.polygon[i].y);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);

    // Anchor floor UVs to start at (0, 0) at the room's bounding corner for usage estimation
    let minX = Infinity;
    let minY = Infinity;
    for (const p of room.polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
    const uvAttr = geometry.attributes.uv;
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < uvAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      uvAttr.setXY(i, px - minX, -py - minY);
    }
    uvAttr.needsUpdate = true;

    // Floor material selection based on custom floorFinish or room type
    const isWetZone = /bath|toilet|wc|san|shower/i.test(room.name);
    const material = room.floorFinish && this.finishService
      ? this.finishService.getMaterial(room.floorFinish, { side: THREE.DoubleSide })
      : this.getMaterial(isWetZone ? 'tile' : 'parquet');

    const mesh = new THREE.Mesh(geometry, material);
    this.surfaces.add(mesh);
    mesh.name = `floor_${room.id}`;
    mesh.userData = { type: 'floor', roomId: room.id, name: room.name, area: room.area };
    mesh.rotation.x = -Math.PI / 2; // Flat on floor X-Z plane
    mesh.position.y = 0.002; // Slightly above zero to avoid z-fighting with ground grid
    mesh.receiveShadow = true;

    group.add(mesh);
    if (room.railing) group.add(buildBalconyRailing(room.id, room.railing, openRailingRuns(room.polygon, walls, room.railing.edges)));

    // Only add room label badge if explicitly enabled and room has a meaningful name (not "none")
    const isUnnamed = !room.name || room.name.toLowerCase() === 'none' || room.name.trim() === '';
    if (showLabels && !isUnnamed) {
      const centroid = this.calculateCentroid(room.polygon);
      const labelSprite = this.createRoomBadge(room.name, room.area);
      labelSprite.position.set(centroid.x, 0.05, centroid.y);
      group.add(labelSprite);
    }

    return group;
  }

  applyMaterials(root: THREE.Object3D, room: RoomEntity): void {
    const wetZone = /bath|toilet|wc|san|shower/i.test(room.name);
    const material = room.floorFinish && this.finishService ? this.finishService.getMaterial(room.floorFinish, { side: THREE.DoubleSide }) : this.getMaterial(wetZone ? 'tile' : 'parquet');
    root.traverse(object => { if (object instanceof THREE.Mesh && this.surfaces.has(object)) object.material = material; });
  }

  private calculateCentroid(points: readonly { x: number; y: number }[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }

  private getMaterial(type: 'parquet' | 'tile'): THREE.MeshStandardMaterial {
    if (this.floorMaterials.has(type)) {
      return this.floorMaterials.get(type)!;
    }

    const texture = type === 'parquet' ? this.parquetTexture : this.tileTexture;
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: type === 'parquet' ? 0.35 : 0.2,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    this.floorMaterials.set(type, mat);
    return mat;
  }

  private generateParquetTexture(): THREE.CanvasTexture {
    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Warm Scandinavian oak tones
    ctx.fillStyle = '#dfcfb8';
    ctx.fillRect(0, 0, 512, 512);

    // Plank pattern
    const plankHeight = 32;
    const plankWidth = 128;
    ctx.lineWidth = 1;

    for (let y = 0; y < 512; y += plankHeight) {
      const offsetX = ((y / plankHeight) % 2) * (plankWidth / 2);
      for (let x = -plankWidth; x < 512 + plankWidth; x += plankWidth) {
        const px = x + offsetX;

        // Subtle color variation per plank
        const toneVar = ((px * 13 + y * 7) % 20) - 10;
        const r = 223 + toneVar;
        const g = 207 + toneVar;
        const b = 184 + toneVar;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(px, y, plankWidth, plankHeight);

        // Plank border
        ctx.strokeStyle = 'rgba(160, 140, 115, 0.4)';
        ctx.strokeRect(px, y, plankWidth, plankHeight);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private generateTileTexture(): THREE.CanvasTexture {
    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Clean neutral grey-beige porcelain stone
    ctx.fillStyle = '#ecebe8';
    ctx.fillRect(0, 0, 512, 512);

    const tileSize = 64;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.5)';

    for (let y = 0; y < 512; y += tileSize) {
      for (let x = 0; x < 512; x += tileSize) {
        const toneVar = ((x * 17 + y * 11) % 10) - 5;
        const val = 236 + toneVar;
        ctx.fillStyle = `rgb(${val}, ${val}, ${val - 2})`;
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.0 / 1.2, 1.0 / 1.2);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private createRoomBadge(name: string, area: number): THREE.Sprite {
    const canvas = this.canvas.create();
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Semi-transparent pill container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    this.roundRect(ctx, 16, 20, 224, 88, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 16, 20, 224, 88, 16);
    ctx.stroke();

    // Text: Room Name
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.toUpperCase(), 128, 48);

    // Text: Area
    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = '#38bdf8'; // light sky blue
    ctx.fillText(`${area.toFixed(1)} m²`, 128, 78);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.4, 0.7, 1);
    sprite.renderOrder = 999;
    return sprite;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
