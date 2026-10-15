import * as THREE from 'three';
import type { CanvasFactory } from '../CanvasFactory';
import { seededRandom } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';
import { TextureSource } from '../TextureSource';

export class FabricTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory, private readonly source = new TextureSource()) { }
  dispose(): void { this.textures.dispose(); }
  resolveFabricPhotoInfo(variant?: string, color?: string): { url: string; isPreColored: boolean } {
    const v = (variant || '').toLowerCase();
    const c = (color || '').toLowerCase();

    // 1. Explicit photographic variant keys
    if (v.includes('ruby')) {
      return { url: '/textures/fabrics/velvet_ruby_red.jpg', isPreColored: true };
    }
    if (v.includes('burgundy') || v.includes('wine')) {
      return { url: '/textures/fabrics/velvet_wine_burgundy.jpg', isPreColored: true };
    }
    if (v.includes('emerald')) {
      return { url: '/textures/fabrics/velvet_emerald_green.jpg', isPreColored: true };
    }
    if (v.includes('forest')) {
      return { url: '/textures/fabrics/velvet_forest_green.jpg', isPreColored: true };
    }
    if (v.includes('navy') || v.includes('sapphire')) {
      return { url: '/textures/fabrics/velvet_royal_navy.jpg', isPreColored: true };
    }
    if (v.includes('champagne') || v.includes('ivory')) {
      return { url: '/textures/fabrics/velvet_champagne.jpg', isPreColored: true };
    }
    if (v.includes('charcoal')) {
      return { url: '/textures/fabrics/velvet_charcoal.jpg', isPreColored: true };
    }
    if (v.includes('linen')) {
      return { url: '/textures/fabrics/fabric_linen_weave.jpg', isPreColored: true };
    }
    if (v.includes('silver')) {
      return { url: '/textures/fabrics/velvet_neutral_silver.jpg', isPreColored: false };
    }

    // 2. Color-based matching for red/green/navy/champagne velvet tones
    if (c === '#8e1624' || c === '#a8202e' || c === '#731728') {
      return { url: '/textures/fabrics/velvet_ruby_red.jpg', isPreColored: true };
    }
    if (c === '#54121d') {
      return { url: '/textures/fabrics/velvet_wine_burgundy.jpg', isPreColored: true };
    }
    if (c === '#0b6654' || c === '#163832') {
      return { url: '/textures/fabrics/velvet_emerald_green.jpg', isPreColored: true };
    }
    if (c === '#1a3d2b' || c === '#234e3e') {
      return { url: '/textures/fabrics/velvet_forest_green.jpg', isPreColored: true };
    }
    if (c === '#1a2639' || c === '#1e3a5f') {
      return { url: '/textures/fabrics/velvet_royal_navy.jpg', isPreColored: true };
    }
    if (c === '#ede6d6') {
      return { url: '/textures/fabrics/velvet_champagne.jpg', isPreColored: true };
    }
    if (c === '#26282d') {
      return { url: '/textures/fabrics/velvet_charcoal.jpg', isPreColored: true };
    }

    // 3. For any other custom tint (e.g. Sage Olive, Terracotta, Greige, or hex picker),
    // use the photographic neutral silver velvet texture which blends the exact tint with photorealistic folds and reflective luster
    return { url: '/textures/fabrics/velvet_neutral_silver.jpg', isPreColored: false };
  }

  getFabricTexture(variant: string = 'velvet_plush', color?: string): THREE.Texture {
    const photoInfo = this.resolveFabricPhotoInfo(variant, color);
    const key = `fabric_photo_${photoInfo.url}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    if (typeof document !== 'undefined' && typeof (document as any).createElementNS === 'function') {
      const loader = this.source.textureLoader();
      const tex = loader.load(
        photoInfo.url,
        (loaded) => {
          loaded.wrapS = THREE.RepeatWrapping;
          loaded.wrapT = THREE.RepeatWrapping;
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {
          console.warn(`[SurfaceMaterialFactory] Texture not found: ${photoInfo.url}`);
        }
      );
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, tex);
      return tex;
    }

    // Fallback for headless environments or canvas test runners
    const fallbackTex = this.createProceduralFabricTexture(variant);
    this.textures.set(key, fallbackTex);
    return fallbackTex;
  }

  private createProceduralFabricTexture(variant: string = 'velvet_plush'): THREE.Texture {
    const random = seededRandom(JSON.stringify([variant]));
    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Neutral white fabric base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    if (variant === 'corduroy') {
      // Fine vertical ribbed wales
      const waleWidth = 8;
      for (let x = 0; x < 512; x += waleWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + waleWidth, 0);
        grad.addColorStop(0, '#e5e7eb');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, '#d1d5db');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, waleWidth, 512);
      }
      for (let i = 0; i < 2000; i++) {
        const rx = random() * 512;
        const ry = random() * 512;
        ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(rx, ry, 2, 1);
      }
    } else if (variant === 'linen_weave') {
      // Crisp cross-hatch warp & weft threads
      const step = 6;
      for (let x = 0; x < 512; x += step) {
        ctx.fillStyle = x % (step * 2) === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, 0, step / 2, 512);
      }
      for (let y = 0; y < 512; y += step) {
        ctx.fillStyle = y % (step * 2) === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, y, 512, step / 2);
      }
      for (let i = 0; i < 600; i++) {
        const sx = random() * 512;
        const sy = random() * 512;
        const slen = 4 + random() * 12;
        ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
        ctx.fillRect(sx, sy, slen, 2);
      }
    } else if (variant === 'boucle') {
      // Curled nubby yarn clusters / loops
      for (let i = 0; i < 2500; i++) {
        const cx = random() * 512;
        const cy = random() * 512;
        const r = 2 + random() * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = random() > 0.4 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        ctx.fill();
      }
    } else if (variant === 'velvet_crushed') {
      // Crushed velvet directional sheen patches
      for (let i = 0; i < 120; i++) {
        const px = random() * 512;
        const py = random() * 512;
        const pw = 30 + random() * 60;
        const ph = 20 + random() * 40;
        const grad = ctx.createRadialGradient(px, py, 2, px, py, pw);
        const isBright = random() > 0.5;
        grad.addColorStop(0, isBright ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(px, py, pw, ph, Math.PI * random(), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 4000; i++) {
        const rx = random() * 512;
        const ry = random() * 512;
        ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(rx, ry, 1, 1);
      }
    } else {
      // velvet_plush: soft micro velvet grain
      for (let i = 0; i < 6000; i++) {
        const rx = random() * 512;
        const ry = random() * 512;
        ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(rx, ry, 1, 1);
      }
      for (let i = 0; i < 40; i++) {
        const cx = random() * 512;
        const cy = random() * 512;
        const cr = 20 + random() * 50;
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cr);
        grad.addColorStop(0, 'rgba(255,255,255,0.06)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }
}
