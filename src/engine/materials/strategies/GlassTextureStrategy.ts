import * as THREE from 'three';
import type { CanvasFactory } from '../CanvasFactory';
import { seededRandom } from '../CanvasFactory';
import { TextureCache } from '../TextureCache';

export class GlassTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory) { }
  dispose(): void { this.textures.dispose(); }
  getGlassTexture(variant: string = 'clear'): THREE.Texture | null {
    const random = seededRandom(JSON.stringify([variant]));
    if (variant === 'clear' || variant === 'smoked') return null;
    const key = `glass_${variant}`;
    if (this.textures.has(key)) return this.textures.get(key)!;

    const canvas = this.canvas.create();
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    if (variant === 'frosted_mica') {
      // Classic frosted bathroom mica / stippled shower partition pattern
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      // Fine textured stippling background
      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (random() - 0.5) * 36;
        data[i] = Math.min(255, Math.max(220, 245 + noise));
        data[i + 1] = Math.min(255, Math.max(225, 248 + noise));
        data[i + 2] = Math.min(255, Math.max(230, 252 + noise));
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Dense stippled droplets / pebbled mica facets
      const numDroplets = 900;
      for (let i = 0; i < numDroplets; i++) {
        const x = random() * 512;
        const y = random() * 512;
        const r = 1.5 + random() * 3.5;

        // Droplet soft shadow
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fill();

        // Droplet base
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fill();

        // Specular highlight on droplet top-left
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
      }
    } else if (variant === 'frosted') {
      // Acid-etched privacy satin glass
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 512, 512);

      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (random() - 0.5) * 28;
        data[i] = Math.min(255, Math.max(200, 240 + noise));
        data[i + 1] = Math.min(255, Math.max(205, 243 + noise));
        data[i + 2] = Math.min(255, Math.max(210, 248 + noise));
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (variant === 'fluted') {
      // Reeded / fluted architectural glass with vertical cylindrical ribs
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      const fluteWidth = 32;
      for (let x = 0; x < 512; x += fluteWidth) {
        const grad = ctx.createLinearGradient(x, 0, x + fluteWidth, 0);
        grad.addColorStop(0, 'rgba(148, 163, 184, 0.35)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.95)');
        grad.addColorStop(0.85, 'rgba(203, 213, 225, 0.5)');
        grad.addColorStop(1, 'rgba(100, 116, 139, 0.4)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, fluteWidth, 512);

        ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
        ctx.fillRect(x, 0, 1, 512);
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
