import * as THREE from 'three';
import { embeddedAssets } from '../../platform/standalone/EmbeddedAssets';

let urlModifierInstalled = false;

/** Shared by Three.js loaders and CSS previews in the standalone editor. */
export function resolveEmbeddedTextureUrl(url: string): string {
  return embeddedAssets()?.resolve(url) ?? url;
}

/** Intercept texture URLs with offline embedded base64 data URIs when running in standalone mode. */
export function installEmbeddedTextureUrlModifier(): void {
  if (urlModifierInstalled) return;
  urlModifierInstalled = true;
  THREE.DefaultLoadingManager.setURLModifier(resolveEmbeddedTextureUrl);
}

/** A runtime owns its loading notifications and forwards the offline URL resolver. */
export class TextureSource {
  private readonly listeners = new Set<() => void>();
  private readonly manager = new THREE.LoadingManager();
  private loading = false;
  private readonly waiting = new Set<() => void>();
  private readonly images = new Map<string, { image: HTMLImageElement; source: THREE.TextureSource<HTMLImageElement>; ready: Promise<THREE.TextureSource<HTMLImageElement>> }>();

  constructor() {
    this.manager.setURLModifier((url) => resolveEmbeddedTextureUrl(THREE.DefaultLoadingManager.resolveURL(url)));
    this.manager.onStart = () => { this.loading = true; };
    this.manager.onProgress = () => this.notify();
    this.manager.onLoad = () => {
      this.loading = false;
      for (const resolve of this.waiting) resolve();
      this.waiting.clear();
    };
  }

  ready(): Promise<void> {
    if (!this.loading) return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timeout); this.waiting.delete(finish); resolve(); };
      // A stalled hosted image must not prevent the editor from opening.
      const timeout = setTimeout(finish, 15_000);
      this.waiting.add(finish);
    });
  }

  textureLoader(): THREE.TextureLoader {
    const loader = new THREE.TextureLoader(this.manager);
    loader.load = (url, onLoad, onProgress, onError) => {
      const entry = this.image(url, onProgress);
      const texture = new THREE.Texture<HTMLImageElement>();
      // Distinct samplers remain editable; compatible textures can share their
      // decoded image and Three.js GPU source across palette/finish consumers.
      texture.source = entry.source;
      void entry.ready.then(() => { texture.needsUpdate = true; onLoad?.(texture); }, error => onError?.(error));
      return texture;
    };
    return loader;
  }

  imageLoader(): THREE.ImageLoader {
    const loader = new THREE.ImageLoader(this.manager);
    loader.load = (url, onLoad, onProgress, onError) => {
      const entry = this.image(url, onProgress);
      void entry.ready.then(() => onLoad?.(entry.image), error => onError?.(error));
      return entry.image;
    };
    return loader;
  }

  private image(url: string, onProgress?: (event: ProgressEvent) => void) {
    const key = this.manager.resolveURL(url);
    const cached = this.images.get(key);
    if (cached) return cached;
    const source = new THREE.TextureSource<HTMLImageElement>(null!);
    let image!: HTMLImageElement;
    const ready = new Promise<THREE.TextureSource<HTMLImageElement>>((resolve, reject) => {
      image = new THREE.ImageLoader(this.manager).load(key, loaded => {
        source.data = loaded; resolve(source);
      }, onProgress, error => { this.images.delete(key); reject(error); });
    });
    const entry = { image, source, ready };
    this.images.set(key, entry);
    return entry;
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
