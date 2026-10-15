import { decodeBase64, encodeBase64 } from '../../services/export/BinaryEncoding';

/** One document owns the encoded image bytes and one object URL per image.
 * URLs remain valid for CSS previews, delayed loads and WebGL restoration.
 * The browser releases them when this document is discarded.
 */
export class EmbeddedAssets {
  private readonly aliases = new Map<string, string>();
  private readonly images = new Map<string, { bytes: Uint8Array<ArrayBuffer>; mime: string; url?: string }>();

  constructor(map: Record<string, string>) {
    for (const [key, value] of Object.entries(map)) {
      if (value.startsWith('@')) { this.aliases.set(key, value.slice(1)); continue; }
      const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value);
      if (!match) throw new Error(`Invalid embedded image: ${key}`);
      this.images.set(key, { mime: match[1], bytes: decodeBase64(match[2]) });
    }
  }

  resolve(url: string): string {
    if (/^(data:|blob:)/.test(url)) return url;
    const normalized = url.startsWith('/') ? url : '/' + url;
    let key = this.images.has(url) || this.aliases.has(url) ? url : normalized;
    if (!this.images.has(key) && !this.aliases.has(key)) {
      const filename = url.split('/').pop()?.split('?')[0];
      if (!filename) return url;
      key = [...this.images.keys(), ...this.aliases.keys()].find(path => path.endsWith('/' + filename) || path === filename) ?? key;
    }
    const seen = new Set<string>();
    while (this.aliases.has(key) && !seen.has(key)) { seen.add(key); key = this.aliases.get(key)!; }
    const image = this.images.get(key);
    if (!image) return url;
    return image.url ??= URL.createObjectURL(new Blob([image.bytes], { type: image.mime }));
  }

  serialize(): string {
    const map: Record<string, string> = {};
    for (const [key, image] of this.images) map[key] = `data:${image.mime};base64,${encodeBase64(image.bytes)}`;
    for (const [key, canonical] of this.aliases) map[key] = '@' + canonical;
    return JSON.stringify(map);
  }
}

let registry: EmbeddedAssets | undefined;
export function embeddedAssets(): EmbeddedAssets | undefined {
  if (registry || typeof window === 'undefined') return registry;
  const script = document.getElementById('embedded-textures');
  const map = window.__EMBEDDED_TEXTURES__ ?? (script?.textContent?.trim() ? JSON.parse(script.textContent) : undefined);
  if (!map) return undefined;
  registry = new EmbeddedAssets(map);
  delete window.__EMBEDDED_TEXTURES__;
  script?.remove();
  return registry;
}
