import * as THREE from 'three';

let urlModifierInstalled = false;

/** Shared by Three.js loaders and CSS previews in the standalone editor. */
export function resolveEmbeddedTextureUrl(url: string): string {
  const map = typeof window !== 'undefined' ? window.__EMBEDDED_TEXTURES__ : undefined;
  if (!map) return url;
  if (map[url]) return map[url];
  const normalized = url.startsWith('/') ? url : `/${url}`;
  if (map[normalized]) return map[normalized];
  const filename = url.split('/').pop()?.split('?')[0];
  if (filename) {
    for (const key in map) {
      if (key.endsWith('/' + filename) || key === filename) return map[key];
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

  constructor() {
    this.manager.setURLModifier((url) => THREE.DefaultLoadingManager.resolveURL(url));
    this.manager.onProgress = () => this.notify();
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
