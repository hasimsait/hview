// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { resolveEmbeddedTextureUrl } from '../../src/engine/materials/TextureSource';

afterEach(() => { delete window.__EMBEDDED_TEXTURES__; });

describe('shared offline texture resolution', () => {
  it('preserves hosted URLs when no embedded asset exists', () => {
    expect(resolveEmbeddedTextureUrl('/textures/wood/oak.jpg')).toBe('/textures/wood/oak.jpg');
    window.__EMBEDDED_TEXTURES__ = {};
    expect(resolveEmbeddedTextureUrl('/textures/missing.jpg')).toBe('/textures/missing.jpg');
  });

  it('resolves both root and relative CSS image paths to embedded bytes', () => {
    window.__EMBEDDED_TEXTURES__ = { '/textures/wood/oak.jpg': 'data:image/jpeg;base64,oak' };
    expect(resolveEmbeddedTextureUrl('/textures/wood/oak.jpg')).toBe('data:image/jpeg;base64,oak');
    expect(resolveEmbeddedTextureUrl('textures/wood/oak.jpg')).toBe('data:image/jpeg;base64,oak');
  });

  it('resolves relocated URLs and cache-busting queries by their embedded filename', () => {
    window.__EMBEDDED_TEXTURES__ = { '/textures/fabrics/linen.jpg': 'data:image/jpeg;base64,linen' };
    expect(resolveEmbeddedTextureUrl('https://example.test/assets/linen.jpg?v=2')).toBe('data:image/jpeg;base64,linen');
  });

  it('leaves data URLs unchanged when rendering already embedded assets', () => {
    window.__EMBEDDED_TEXTURES__ = { '/textures/wood/oak.jpg': 'data:image/jpeg;base64,oak' };
    expect(resolveEmbeddedTextureUrl('data:image/jpeg;base64,oak')).toBe('data:image/jpeg;base64,oak');
  });
});
