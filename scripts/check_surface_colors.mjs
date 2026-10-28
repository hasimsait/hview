import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), work = path.join(root, 'work');
await mkdir(work, { recursive: true });
const bundle = await build({ entryPoints: [path.join(root, 'tests/surface-color.browser.ts')], bundle: true, write: false, format: 'iife', minify: true });
const images = {};
for (const file of ['wood_natural_oak.jpg', 'wood_american_walnut.jpg']) images[`/textures/wood/${file}`] = 'data:image/jpeg;base64,' + (await readFile(path.join(root, 'public/textures/wood', file))).toString('base64');
const html = `<!doctype html><html><head><style>body{font:13px system-ui;background:#e9e6df;color:#272622;margin:20px}h1{font-size:21px}h2{font-size:14px}canvas{display:block}#results{max-width:640px;max-height:80px;overflow:auto;font-size:9px}</style></head><body><pre id="results">pending</pre><script id="embedded-textures" type="application/json">${JSON.stringify(images)}</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
await writeFile(path.join(work, 'surface-colors.html'), html);
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 1400 } }); await page.context().setOffline(true);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent(html); await page.waitForFunction(() => document.getElementById('results')?.textContent !== 'pending', { timeout: 45000 });
  const result = JSON.parse(await page.locator('#results').textContent());
  await writeFile(path.join(work, 'surface-color-results.json'), JSON.stringify({ ...result, pageErrors: errors }, null, 2));
  await page.screenshot({ path: path.join(work, 'surface-colors.png'), fullPage: true });
  console.log(JSON.stringify({ ...result, pageErrors: errors }, null, 2));
  if (!result.ok || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
