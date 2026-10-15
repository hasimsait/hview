import * as THREE from 'three';

/** A runtime owns its loading notifications and forwards the offline URL resolver. */
export class TextureSource {
  private readonly listeners = new Set<() => void>();
  private readonly manager = new THREE.LoadingManager();
  constructor() {
    this.manager.setURLModifier(url => THREE.DefaultLoadingManager.resolveURL(url));
    this.manager.onProgress = () => { for (const listener of this.listeners) listener(); };
  }
  textureLoader(): THREE.TextureLoader { return new THREE.TextureLoader(this.manager); }
  imageLoader(): THREE.ImageLoader { return new THREE.ImageLoader(this.manager); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
}
