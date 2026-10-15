import * as THREE from 'three';
import type { CanvasFactory } from '../CanvasFactory';
import { seededRandom } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';

export class CoatingTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory) { }
  dispose(): void { this.textures.dispose(); }
  getPlasterTexture(variant: string = 'stucco'): THREE.Texture {
    const random = seededRandom(JSON.stringify([variant]));
    const key = `plaster_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = this.canvas.create();
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#efede8';
    ctx.fillRect(0, 0, 256, 256);

    // Stucco grain
    for (let i = 0; i < 1500; i++) {
      const x = random() * 256;
      const y = random() * 256;
      const alpha = random() * 0.08;
      ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  getClipInCeilingTexture(): THREE.Texture {
    const key = 'ceiling_clip_in';
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Aluminum off-white / light slate ceiling panel color
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 512);

    // 60x60 cm modular grid (4 tiles per 512px)
    const tileSize = 128;
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        // Tile panel body
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

        // Beveled clip-in shadow border
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x, y, tileSize, 2);
        ctx.fillRect(x, y, 2, tileSize);

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + tileSize - 2, y, 2, tileSize);
        ctx.fillRect(x, y + tileSize - 2, tileSize, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }
}
