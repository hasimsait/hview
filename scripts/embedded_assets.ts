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
      // WebP is supported by Safari 15+ and preserves transparency where needed.
      // Source images stay untouched; only portable HTML uses optimized bytes.
      const resolution = key.startsWith('/textures/tiles/') ? 1024 : 512;
      const optimized = await sharp(source).rotate()
        .resize({ width: resolution, height: resolution, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 }).toBuffer();
      assets[key] = 'data:image/webp;base64,' + optimized.toString('base64');
      canonical.set(hash, key);
    }
  }
  await scan(path.join(publicDir, 'textures'));
  return assets;
}
