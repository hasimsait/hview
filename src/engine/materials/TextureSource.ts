import * as THREE from 'three';

let urlModifierInstalled = false;

/** Intercept texture URLs with offline embedded base64 data URIs when running in standalone mode. */
export function installEmbeddedTextureUrlModifier(): void {
  if (urlModifierInstalled) return;
  urlModifierInstalled = true;
  THREE.DefaultLoadingManager.setURLModifier((url: string) => {
    const map = typeof window !== 'undefined' ? window.__EMBEDDED_TEXTURES__ : undefined;
    if (map) {
      if (map[url]) return map[url];
      const normUrl = url.startsWith('/') ? url : `/${url}`;
      if (map[normUrl]) return map[normUrl];
      const filename = url.split('/').pop()?.split('?')[0];
      if (filename) {
        for (const key in map) {
          if (key.endsWith('/' + filename) || key === filename) {
            return map[key];
          }
        }
      }
    }
    return url;
  });
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
