import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { embeddedAssets } from '../../scripts/embedded_assets';

it('bounds exported photo dimensions, preserves transparency and originals, and deduplicates aliases', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hview-assets-'));
  try {
    const dir = path.join(root, 'textures', 'tiles');
    await mkdir(dir, { recursive: true });
    const original = await sharp({ create: { width: 1024, height: 768, channels: 4, background: { r: 20, g: 80, b: 120, alpha: 0.5 } } }).png().toBuffer();
    await writeFile(path.join(dir, 'a.png'), original);
    await writeFile(path.join(dir, 'b.png'), original);
    const assets = await embeddedAssets(root);
    expect(assets['/textures/tiles/b.png']).toBe('@/textures/tiles/a.png');
    const value = assets['/textures/tiles/a.png'];
    expect(value).toMatch(/^data:image\/webp;base64,/);
    const metadata = await sharp(Buffer.from(value.split(',')[1], 'base64')).metadata();
    expect(metadata.width).toBe(512); expect(metadata.height).toBe(384); expect(metadata.hasAlpha).toBe(true);
    expect(await readFile(path.join(dir, 'a.png'))).toEqual(original);
  } finally { await rm(root, { recursive: true, force: true }); }
});
