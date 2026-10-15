import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Keep every offline finish, but bound decoded image memory and store duplicates once. */
export async function embeddedAssets(publicDir: string): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  const canonical = new Map<string, string>();
  async function scan(dir: string): Promise<void> {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { await scan(file); continue; }
      if (!/\.(jpe?g|png)$/i.test(entry.name)) continue;
      const key = '/' + path.relative(publicDir, file).split(path.sep).join('/');
      const source = await readFile(file);
      const hash = createHash('sha256').update(source).digest('hex');
      const existing = canonical.get(hash);
      if (existing) { assets[key] = '@' + existing; continue; }
      // Compare encoded sizes at the same resolution; never discard alpha.
      // Source images stay untouched; only portable HTML uses optimized bytes.
      const image = sharp(source).rotate()
        .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true });
      const webp = await image.clone().webp({ quality: 78, effort: 4 }).toBuffer();
      const alpha = (await sharp(source).metadata()).hasAlpha;
      const jpeg = alpha ? undefined : await image.clone().jpeg({ quality: 75, mozjpeg: true, progressive: true }).toBuffer();
      const useJpeg = jpeg && jpeg.length < webp.length;
      assets[key] = `data:image/${useJpeg ? 'jpeg' : 'webp'};base64,` + (useJpeg ? jpeg : webp).toString('base64');
      canonical.set(hash, key);
    }
  }
  await scan(path.join(publicDir, 'textures'));
  return assets;
}
