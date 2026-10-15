import * as THREE from 'three';

let urlModifierInstalled = false;

/** Shared by Three.js loaders and CSS previews in the standalone editor. */
export function resolveEmbeddedTextureUrl(url: string): string {
  const map = typeof window !== 'undefined' ? window.__EMBEDDED_TEXTURES__ : undefined;
  if (!map) return url;
  const resolve = (key: string): string | undefined => {
    const seen = new Set<string>();
    while (map[key] && !seen.has(key)) {
      seen.add(key);
      const value = map[key];
      if (!value.startsWith('@')) return value;
      key = value.slice(1);
    }
    return undefined;
  };
  if (map[url]) return resolve(url) ?? url;
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (map[normalized]) return resolve(normalized) ?? url;
  const filename = url.split('/').pop()?.split('?')[0];
  if (filename) {
    for (const key in map) {
      if (key.endsWith('/' + filename) || key === filename) return resolve(key) ?? url;
    }
  }
  return url;
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

  constructor() {
    this.manager.setURLModifier((url) => THREE.DefaultLoadingManager.resolveURL(url));
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
    return new THREE.TextureLoader(this.manager);
  }

  imageLoader(): THREE.ImageLoader {
    return new THREE.ImageLoader(this.manager);
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
