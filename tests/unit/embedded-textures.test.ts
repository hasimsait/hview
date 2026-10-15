// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EmbeddedAssets } from '../../src/platform/standalone/EmbeddedAssets';
import { resolveEmbeddedTextureUrl, TextureSource } from '../../src/engine/materials/TextureSource';

afterEach(() => { delete window.__EMBEDDED_TEXTURES__; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('shared offline texture resolution', () => {
  it('preserves hosted URLs when no embedded asset exists', () => {
    expect(resolveEmbeddedTextureUrl('/textures/wood/oak.jpg')).toBe('/textures/wood/oak.jpg');
    window.__EMBEDDED_TEXTURES__ = {};
    expect(resolveEmbeddedTextureUrl('/textures/missing.jpg')).toBe('/textures/missing.jpg');
  });

  it('shares one binary image URL across root, relative, alias, and CSS paths', () => {
    const create = vi.fn((_blob: Blob) => 'blob:offline-image');
    vi.stubGlobal('URL', { createObjectURL: create });
    const assets = new EmbeddedAssets({
      '/textures/tile.jpg': 'data:image/webp;base64,YWJj',
      '/textures/tile_v2.jpg': '@/textures/tile.jpg',
      '/textures/unused.png': 'data:image/png;base64,ZGVm',
    });
    for (const path of ['/textures/tile.jpg', 'textures/tile.jpg', '/textures/tile_v2.jpg', 'https://example.test/tile_v2.jpg?v=1']) {
      expect(assets.resolve(path)).toBe('blob:offline-image');
    }
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].type).toBe('image/webp');
    expect(create.mock.calls[0][0].size).toBe(3);
    expect(assets.resolve('data:image/jpeg;base64,YWJj')).toBe('data:image/jpeg;base64,YWJj');
    expect(assets.resolve('blob:offline-image')).toBe('blob:offline-image');
    expect(assets.resolve('/textures/missing.jpg')).toBe('/textures/missing.jpg');
    // Export all finishes, including ones never loaded, without serializing blob URLs.
    expect(JSON.parse(assets.serialize())).toEqual({
      '/textures/tile.jpg': 'data:image/webp;base64,YWJj',
      '/textures/tile_v2.jpg': '@/textures/tile.jpg',
      '/textures/unused.png': 'data:image/png;base64,ZGVm',
    });
    vi.unstubAllGlobals();
  });
  it('handles alias cycles and rejects corrupt images instead of fetching externally', () => {
    const assets = new EmbeddedAssets({ '/one.jpg': '@/two.jpg', '/two.jpg': '@/one.jpg' });
    expect(assets.resolve('/one.jpg')).toBe('/one.jpg');
    expect(() => new EmbeddedAssets({ '/bad.jpg': 'https://external.test/image.jpg' })).toThrow('Invalid embedded image');
  });
  it('shares decoded image sources while preserving independent texture samplers', async () => {
    const image = document.createElement('img');
    let finish!: (image: HTMLImageElement) => void;
    const load = vi.spyOn(THREE.ImageLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      finish = onLoad!; return image;
    });
    const source = new TextureSource();
    const first = source.textureLoader().load('/wood.jpg');
    const second = source.textureLoader().load('/wood.jpg');
    second.wrapS = THREE.RepeatWrapping; second.repeat.set(2, 3);
    finish(image); await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(second); expect(first.source).toBe(second.source);
    expect(first.image).toBe(image); expect(second.image).toBe(image);
    expect(first.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(first.repeat.toArray()).toEqual([1, 1]);
    load.mockRestore();
  });
  it('waits for all image loads, including failed images, before shader preparation', async () => {
    const source = new TextureSource(), manager = source.textureLoader().manager;
    manager.itemStart('one'); manager.itemStart('two');
    let ready = false;
    const waiting = source.ready().then(() => { ready = true; });
    manager.itemEnd('one'); await Promise.resolve(); expect(ready).toBe(false);
    manager.itemError('two'); manager.itemEnd('two'); await waiting;
    expect(ready).toBe(true); await source.ready();
  });
});
