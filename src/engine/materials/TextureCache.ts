import type { Texture } from 'three';

/** A released GPU texture must never be handed out again from the cache. */
export class TextureCache extends Map<string, Texture> {
  override set(key: string, texture: Texture): this {
    texture.addEventListener('dispose', () => { if (this.get(key) === texture) this.delete(key); });
    return super.set(key, texture);
  }
  dispose(): void { for (const texture of new Set(this.values())) texture.dispose(); this.clear(); }
}
