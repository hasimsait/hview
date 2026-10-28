import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)), work = path.join(root, 'work');
await mkdir(work, { recursive: true });
const bundle = await build({ entryPoints: [path.join(root, 'tests/night-lighting.browser.ts')], bundle: true, write: false, format: 'iife', minify: true });
const html = `<!doctype html><html><head><style>body{font:13px system-ui;background:#ddd;color:#222;margin:20px}h1{font-size:21px}h2{font-size:14px}canvas{display:block}#results{max-width:640px;max-height:100px;overflow:auto;font-size:9px}</style></head><body><pre id="results">pending</pre><script>${bundle.outputFiles[0].text}</script></body></html>`;
await writeFile(path.join(work, 'night-lighting.html'), html);
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 1000 } }); await page.context().setOffline(true);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error' && /WebGLProgram|Shader Error|VALIDATE_STATUS/.test(message.text())) errors.push(message.text()); });
  await page.setContent(html); await page.waitForFunction(() => document.getElementById('results')?.textContent !== 'pending', { timeout: 45000 });
  const result = JSON.parse(await page.locator('#results').textContent());
  await writeFile(path.join(work, 'night-lighting-results.json'), JSON.stringify({ ...result, errors }, null, 2));
  await page.screenshot({ path: path.join(work, 'night-lighting.png'), fullPage: true });
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  if (!result.ok || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
