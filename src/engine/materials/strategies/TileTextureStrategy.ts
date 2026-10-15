import * as THREE from 'three';
import type { ITileCatalogService,TileEntry } from '../../../services/tile-catalog/TileCatalogService';
import type { CanvasFactory } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';
import { TextureSource } from '../TextureSource';
function makeMissingAssetTexture(canvasFactory: CanvasFactory): THREE.Texture {
  const size = 128;
  const canvas = canvasFactory.create();
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  ctx.fillStyle = '#ff00ff'; // magenta
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class TileTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory, private readonly tileCatalog?: ITileCatalogService, private readonly source = new TextureSource()) { }
  dispose(): void { this.textures.dispose(); }
  getTileTexture(variant: string = 'subway'): THREE.Texture {
    const key = `tile_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const entry = this.tileCatalog?.getById(variant);

    // ── Catalog entry with declared texture file(s) ──────────────────────────
    if (entry && entry.textures.length > 0) {
      if (entry.textures.length === 1) {
        // Single texture: load directly
        const url = entry.textures[0];
        const loader = this.source.textureLoader();
        const tex = loader.load(
          url,
          (loaded) => {
            loaded.wrapS = THREE.RepeatWrapping;
            loaded.wrapT = THREE.RepeatWrapping;
            loaded.repeat.set(1, 1);
            loaded.needsUpdate = true;
          },
          undefined,
          () => {
            console.warn(`[TileCatalogService] Texture not found: ${url}`);
            const cb = makeMissingAssetTexture(this.canvas);
            tex.image = cb.image as any;
            tex.needsUpdate = true;
          }
        );
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 1);
        this.textures.set(key, tex);
        return tex;
      }

      // Multi-variant tile: build horizontal texture atlas
      const atlasTex = this.createTileAtlas(entry);
      this.textures.set(key, atlasTex);
      return atlasTex;
    }

    // ── Procedural / canvas-generated fallback ────────────────────────────────
    // Used for tiles declared in the catalog with textures:[] (subway, square,
    // marble, anthracite) or for any completely unknown variant id.
    if (typeof document === 'undefined') {
      const emptyTex = new THREE.Texture();
      this.textures.set(key, emptyTex);
      return emptyTex;
    }
    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    if (variant === 'marble') {
      // Calacatta Marble texture
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      // Veins
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.bezierCurveTo(120, 160, 280, 40, 512, 220);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(80, 0);
      ctx.bezierCurveTo(220, 240, 360, 320, 512, 480);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 380);
      ctx.bezierCurveTo(200, 300, 340, 440, 512, 360);
      ctx.stroke();
    } else if (variant === 'anthracite') {
      // Dark slate / anthracite natural stone tile
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 512, 512);

      // Natural slate cleft texture & layered mineral grain
      for (let i = 0; i < 30; i++) {
        const y = (i * 17) % 512;
        const h = 4 + (i % 8);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 23, 42, 0.45)' : 'rgba(51, 65, 85, 0.35)';
        ctx.fillRect(0, y, 512, h);
      }
    } else if (variant === 'square') {
      // Clean square ceramic tile (15x15 cm)
      // Smooth porcelain glaze; joint lines rendered via physical grout shader
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.2)');
      grad.addColorStop(1, 'rgba(226, 232, 240, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
    } else {
      // Subway / Metro Tile (staggered bricks) — also the ultimate fallback
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const tileH = 32;
      const tileW = 96;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;

      for (let y = 0; y <= 512; y += tileH) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();

        const offset = ((y / tileH) % 2) * (tileW / 2);
        for (let x = -tileW; x <= 512 + tileW; x += tileW) {
          ctx.beginPath();
          ctx.moveTo(x + offset, y);
          ctx.lineTo(x + offset, y + tileH);
          ctx.stroke();
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this.textures.set(key, tex);
    return tex;
  }

  private createTileAtlas(entry: TileEntry): THREE.Texture {
    const numVariants = entry.textures.length;
    const cellW = 1024;
    const cellH = 1024;
    const canvas = this.canvas.create();
    canvas.width = cellW * numVariants;
    canvas.height = cellH;
    const ctx = canvas.getContext('2d')!;

    // Initial background matching tile base color
    ctx.fillStyle = entry.color || '#ded8cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.wrapS = THREE.RepeatWrapping;
    atlasTexture.wrapT = THREE.RepeatWrapping;
    atlasTexture.repeat.set(1, 1);
    atlasTexture.colorSpace = THREE.SRGBColorSpace;
    atlasTexture.minFilter = THREE.LinearFilter;
    atlasTexture.generateMipmaps = false;

    const loader = this.source.imageLoader();
    entry.textures.forEach((url, idx) => {
      loader.load(
        url,
        (image) => {
          ctx.drawImage(image, idx * cellW, 0, cellW, cellH);
          atlasTexture.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[TileCatalogService] Variant texture missing: ${url}`);
          this.drawCheckerboard(ctx, idx * cellW, 0, cellW, cellH);
          atlasTexture.needsUpdate = true;
        }
      );
    });

    return atlasTexture;
  }

  private drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const cols = 16;
    const rows = 16;
    const stepX = w / cols;
    const stepY = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ff00ff' : '#000000';
        ctx.fillRect(x + c * stepX, y + r * stepY, Math.ceil(stepX), Math.ceil(stepY));
      }
    }
  }
}
