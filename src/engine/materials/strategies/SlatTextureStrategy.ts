import * as THREE from 'three';
import type { CanvasFactory } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';

export class SlatTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory) { }
  dispose(): void { this.textures.dispose(); }
  getLambriTexture(
    variant: string = 'oak_slats',
    slatColor?: string,
    backingColor?: string
  ): THREE.Texture {
    const key = `lambri_${variant}_${slatColor || 'def'}_${backingColor || 'def'}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Acoustic felt backing / background
    const effectiveBackingColor =
      backingColor ||
      (variant === 'fluted_panel' || variant === 'fluted_cabinet' ? '#1c2421' : '#141416');
    ctx.fillStyle = effectiveBackingColor;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle acoustic felt micro-texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 280; i++) {
      const rx = (i * 37) % 512;
      const ry = (i * 73) % 512;
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }

    if (variant === 'fluted_panel' || variant === 'fluted_cabinet') {
      // Modern Fluted Vanity Cabinet Panel (Vertical slats with top horizontal accent groove)
      const numFlutes = 14;
      const step = 512 / numFlutes;
      const grooveW = 4;
      const fluteColor = slatColor || '#3a4843';

      ctx.fillStyle = fluteColor;
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i <= numFlutes; i++) {
        const x = i * step;
        ctx.fillStyle = effectiveBackingColor;
        ctx.fillRect(x - grooveW / 2, 0, grooveW, 512);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fillRect(x + grooveW / 2, 0, 1.5, 512);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + step - grooveW / 2 - 1.5, 0, 1.5, 512);
      }

      const topGrooveY = 75;
      ctx.fillStyle = effectiveBackingColor;
      ctx.fillRect(0, topGrooveY - 2, 512, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(0, topGrooveY + 2, 512, 1.5);
    } else if (variant === 'beadboard') {
      // Classic Beadboard Slats
      const step = 32;
      const boardColor = slatColor || '#f8fafc';
      ctx.fillStyle = boardColor;
      ctx.fillRect(0, 0, 512, 512);

      for (let x = 0; x < 512; x += step) {
        ctx.fillStyle = effectiveBackingColor;
        ctx.fillRect(x - 1, 0, 2, 512);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x + 1, 0, 1, 512);
      }
    } else {
      // Modern Architectural Acoustic Timber Slats (Walnut, Oak, Teak, Ash, Wenge, etc.)
      const slatW = 22;
      const gapW = 10;
      const step = slatW + gapW;

      // Determine slat color
      let slatHex = slatColor;
      if (!slatHex) {
        if (variant === 'walnut' || variant === 'walnut_slats') {
          slatHex = '#543f31'; // Rich American Walnut
        } else if (variant === 'teak' || variant === 'teak_slats') {
          slatHex = '#946132'; // Golden Teak
        } else if (variant === 'wenge' || variant === 'wenge_slats' || variant === 'black_oak') {
          slatHex = '#27201b'; // Dark Wenge
        } else if (variant === 'ash' || variant === 'ash_slats' || variant === 'smoked_walnut') {
          slatHex = '#5a4e44'; // Smoked Ash / Walnut
        } else if (variant === 'birch' || variant === 'white_oak' || variant === 'light') {
          slatHex = '#dfcfb6'; // Bleached Birch / White Oak
        } else if (variant === 'white' || variant === 'white_slat') {
          slatHex = '#f8fafc'; // Crisp White Painted Slat
        } else {
          slatHex = '#d4b996'; // Scandinavian Natural Oak
        }
      }

      for (let x = 0; x < 512; x += step) {
        // Drop shadow onto backing felt inside gap
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(x + slatW, 0, 5, 512);

        // Slat solid body
        ctx.fillStyle = slatHex;
        ctx.fillRect(x, 0, slatW, 512);

        // Subtle organic wood grain streaks along slat height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(x + 5, 0, 2, 512);
        ctx.fillRect(x + 14, 0, 1.5, 512);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x + 9, 0, 1.5, 512);

        // 3D Bevel Edge Highlights & Shadows
        // Left bevel light reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(x, 0, 2, 512);

        // Right bevel dark corner shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x + slatW - 2, 0, 2, 512);
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
