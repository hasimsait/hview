import * as THREE from 'three';
import type { CanvasFactory } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';
import { TextureSource } from '../TextureSource';

export class WoodTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory, private readonly source = new TextureSource()) { }
  dispose(): void { this.textures.dispose(); }
  resolveWoodPhotoInfo(variant?: string): { url: string; name: string } {
    const v = (variant || '').toLowerCase();
    if (v.includes('wenge') || v.includes('black_oak') || v.includes('dark_oak')) {
      return { url: '/textures/wood/wood_dark_wenge.jpg', name: 'Dark Wenge' };
    }
    if (v.includes('walnut') || v.includes('dark_walnut')) {
      if (v.includes('smoked')) {
        return { url: '/textures/wood/wood_smoked_walnut.jpg', name: 'Smoked Walnut' };
      }
      return { url: '/textures/wood/wood_american_walnut.jpg', name: 'American Walnut' };
    }
    if (v.includes('teak') || v.includes('golden_teak')) {
      return { url: '/textures/wood/wood_golden_teak.jpg', name: 'Golden Teak' };
    }
    if (v.includes('birch') || v.includes('white_oak') || v.includes('bleached')) {
      return { url: '/textures/wood/wood_bleached_birch.jpg', name: 'Bleached Birch' };
    }
    if (v.includes('smoked') || v.includes('ash_smoked')) {
      return { url: '/textures/wood/wood_smoked_walnut.jpg', name: 'Smoked Walnut' };
    }
    if (v.includes('ash') || v.includes('light_ash')) {
      return { url: '/textures/wood/wood_light_ash.jpg', name: 'Light Ash' };
    }
    return { url: '/textures/wood/wood_natural_oak.jpg', name: 'Natural Oak' };
  }

  getWoodTexture(variant: string = 'natural_oak'): THREE.Texture {
    if (variant?.startsWith('parquet') || variant === 'parquet') {
      const key = `wood_parquet_${variant}`;
      if (this.textures.has(key)) return this.textures.get(key)!;

      const canvas = this.canvas.create();
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d')!;

      if (variant === 'parquet_herringbone') {
        // Classic interlocking herringbone oak parquet pattern
        ctx.fillStyle = '#dfcfb8';
        ctx.fillRect(0, 0, 1024, 1024);

        const plankW = 64;
        const plankL = 192;
        ctx.lineWidth = 1.5;

        for (let y = -plankL; y < 1024 + plankL; y += plankW) {
          for (let x = -plankL; x < 1024 + plankL; x += plankL) {
            const row = Math.floor(y / plankW);
            const col = Math.floor(x / plankL);
            const seed = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
            const varTone = Math.floor((seed - Math.floor(seed)) * 24) - 12;

            const r = Math.min(255, Math.max(0, 218 + varTone));
            const g = Math.min(255, Math.max(0, 198 + varTone));
            const b = Math.min(255, Math.max(0, 170 + varTone));
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, plankL, plankW);

            ctx.fillStyle = `rgba(${r - 25}, ${g - 25}, ${b - 25}, 0.25)`;
            for (let gIdx = 0; gIdx < 4; gIdx++) {
              const gy = y + 8 + gIdx * 14;
              ctx.fillRect(x, gy, plankL, 1.5);
            }

            ctx.strokeStyle = 'rgba(120, 95, 70, 0.4)';
            ctx.strokeRect(x, y, plankL, plankW);
          }
        }
      } else {
        // Staggered architectural plank parquet (running bond)
        let baseR = 223, baseG = 207, baseB = 184; // Scandinavian oak
        if (variant === 'parquet_walnut') {
          baseR = 74; baseG = 56; baseB = 42; // Deep dark walnut
        } else if (variant === 'parquet_light') {
          baseR = 240; baseG = 236; baseB = 225; // Bleached ash / white oak
        }

        ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
        ctx.fillRect(0, 0, 1024, 1024);

        const plankHeight = 64; // ~16 planks per meter
        const plankWidth = 256; // 4:1 aspect ratio
        ctx.lineWidth = 1.5;

        for (let y = 0; y < 1024; y += plankHeight) {
          const row = Math.floor(y / plankHeight);
          const offsetX = (row % 3) * (plankWidth / 3);

          for (let x = -plankWidth; x < 1024 + plankWidth; x += plankWidth) {
            const px = x + offsetX;
            const col = Math.floor(px / plankWidth);
            const seed = Math.sin(row * 17.3 + col * 43.7) * 43758.5453;
            const varTone = Math.floor((seed - Math.floor(seed)) * 26) - 13;

            const r = Math.min(255, Math.max(0, baseR + varTone));
            const g = Math.min(255, Math.max(0, baseG + varTone));
            const b = Math.min(255, Math.max(0, baseB + varTone));

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(px, y, plankWidth, plankHeight);

            // Subtle organic wood grain within the plank
            ctx.fillStyle = `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.18)`;
            const numGrains = 5;
            for (let gIdx = 0; gIdx < numGrains; gIdx++) {
              const gy = y + 6 + gIdx * 11;
              const gw = plankWidth * (0.6 + ((seed * (gIdx + 1)) % 0.4));
              const gx = px + (plankWidth - gw) / 2;
              ctx.fillRect(gx, gy, gw, 1.5);
            }

            // Top highlight bevel line
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(px, y, plankWidth, 1);

            // Dark shadow micro-bevel perimeter
            ctx.strokeStyle = variant === 'parquet_walnut'
              ? 'rgba(25, 18, 12, 0.6)'
              : 'rgba(140, 115, 85, 0.45)';
            ctx.strokeRect(px, y, plankWidth, plankHeight);
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

    // Photographic Wood Veneer for Furniture & Solid Panels
    const photoInfo = this.resolveWoodPhotoInfo(variant);
    const photoUrl = photoInfo.url;
    const key = `wood_photo_${photoUrl}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    if (typeof document !== 'undefined' && typeof (document as any).createElementNS === 'function') {
      const loader = this.source.textureLoader();
      const tex = loader.load(
        photoUrl,
        (loaded) => {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[SurfaceMaterialFactory] Wood texture not found: ${photoUrl}`);
        }
      );
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, tex);
      return tex;
    }

    // Procedural fallback for headless environments
    const fallbackTex = this.createProceduralWoodTexture(variant);
    this.textures.set(key, fallbackTex);
    return fallbackTex;
  }

  private createProceduralWoodTexture(variant: string = 'natural_oak'): THREE.Texture {
    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const baseColor = variant.includes('walnut')
      ? '#3d2f26'
      : variant.includes('teak')
        ? '#7d522a'
        : '#dfcfb8';
    const grainColor = variant.includes('walnut')
      ? '#2a1f18'
      : variant.includes('teak')
        ? '#5e3c1d'
        : '#c8b49b';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = grainColor;
    for (let i = 0; i < 40; i++) {
      const y = (i * 13) % 512;
      const h = 2 + (i % 6);
      ctx.fillRect(0, y, 512, h);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }
}
