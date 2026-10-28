import * as THREE from 'three';
import { type BauhausPanelFinish, matchGrainColour, panelGrainUrl, PANEL_TEXTURE_SLATS } from '../../../domain/catalog/BauhausPanelling';
import { type CanvasFactory, seededRandom } from '../CanvasFactory';
import { TextureSource } from '../TextureSource';
import { TextureCache } from '../TextureCache';

/** Photographic grain is reused honestly as a reference match, without remote dependencies. */
export class ReferencePanelTextureStrategy {
  private readonly textures = new TextureCache();
  constructor(private readonly canvas: CanvasFactory, private readonly source: TextureSource) {}
  dispose(): void { this.textures.dispose(); }
  get(panel: BauhausPanelFinish): THREE.Texture {
    const cached = this.textures.get(panel.id); if (cached) return cached;
    const canvas = this.canvas.create(); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = panel.backingColor; ctx.fillRect(0, 0, 1024, 1024);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(panel.id, texture);
    const random = seededRandom(panel.id), pitch = 1024 / PANEL_TEXTURE_SLATS;
    const face = pitch * panel.slatWidth / (panel.slatWidth + panel.gapWidth);
    const draw = (grain?: HTMLCanvasElement) => {
      ctx.fillStyle = panel.backingColor; ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 18000; i++) {
        ctx.fillStyle = `rgba(${random() > .5 ? '255,255,255' : '0,0,0'},.045)`;
        ctx.fillRect(random() * 1024, random() * 1024, 1, 1);
      }
      for (let i = 0; i < PANEL_TEXTURE_SLATS; i++) {
        const x = i * pitch;
        ctx.fillStyle = panel.color; ctx.fillRect(x, 0, face, 1024);
        if (grain) {
          // Adjacent strips come from different positions in the photographic veneer.
          const sx = (i * 113) % 880;
          ctx.drawImage(grain, sx, 0, 96, 1024, x, 0, face, 1024);
        }
        ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + face - 1, 0, 1, 1024);
        ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, 0, 1, 1024);
      }
      texture.needsUpdate = true;
    };
    draw();
    this.source.imageLoader().load(panelGrainUrl(panel), image => {
      if (this.textures.get(panel.id) !== texture) return;
      const grain = this.canvas.create(); grain.width = grain.height = 1024;
      const g = grain.getContext('2d', { willReadFrequently: true })!;
      g.save();
      if (panel.grain === 'walnut') { g.translate(1024, 0); g.rotate(Math.PI / 2); }
      g.drawImage(image, 0, 0, 1024, 1024); g.restore();
      const pixels = g.getImageData(0, 0, 1024, 1024);
      const rgb = panel.color.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16));
      matchGrainColour(pixels.data, rgb);
      // Match opposite edges so repeating the grain never adds horizontal join lines.
      for (let x = 0; x < 1024; x++) for (let y = 0; y < 32; y++) for (let c = 0; c < 3; c++) {
        const top = (y * 1024 + x) * 4 + c, bottom = ((1023 - y) * 1024 + x) * 4 + c;
        const average = (pixels.data[top] + pixels.data[bottom]) / 2, weight = 1 - y / 32;
        pixels.data[top] += (average - pixels.data[top]) * weight;
        pixels.data[bottom] += (average - pixels.data[bottom]) * weight;
      }
      g.putImageData(pixels, 0, 0);
      draw(grain); this.source.notify();
    }, undefined, () => console.warn(`Panel grain could not load: ${panelGrainUrl(panel)}`));
    return texture;
  }
}
