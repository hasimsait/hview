import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = path.join(root, 'work');
await mkdir(work, { recursive: true });
const built = await build({
  entryPoints: [path.join(root, 'tests/surface-layers.browser.tsx')], bundle: true,
  format: 'iife', write: false, minify: true, define: { 'process.env.NODE_ENV': '"production"' },
});
const html = path.join(work, 'surface-layers.html');
const htmlContent = `<!doctype html><html><body><pre id="results">pending</pre><script>${built.outputFiles[0].text}</script></body></html>`;
await writeFile(html, htmlContent);
const child = spawn(process.env.CHROMIUM_PATH || 'chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  `--user-data-dir=${path.join(work, 'chromium-layers-pipe-profile')}`,
  '--use-angle=swiftshader', '--no-first-run', '--disable-background-networking',
  '--remote-debugging-pipe',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let sequence = 0;
let buffer = '';
let stderr = '';
const pending = new Map();
child.stderr.on('data', (chunk) => { stderr += chunk; });
child.stdio[4].on('data', (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, index));
    buffer = buffer.slice(index + 1);
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chromium timed out: ${method}`)); }, 15000);
  pending.set(id, { resolve, reject, timer });
  child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
});
try {
  await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  const { frameTree } = await send('Page.getFrameTree', {}, sessionId);
  // Supply the local fixture directly; no HTTP server or file-URL permissions required.
  await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: htmlContent }, sessionId);
  let result;
  for (let attempts = 0; attempts < 75; attempts++) {
    const response = await send('Runtime.evaluate', { expression: 'document.getElementById("results")?.textContent', returnByValue: true }, sessionId);
    if (response.result?.value && response.result.value !== 'pending') {
      result = JSON.parse(response.result.value);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!result) {
    const detail = await send('Runtime.evaluate', { expression: 'JSON.stringify({url:location.href,ready:document.readyState,html:document.documentElement.outerHTML.slice(0,700)})', returnByValue: true }, sessionId);
    throw new Error(`Browser did not report surface layer results: ${detail.result?.value}`);
  }
  const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(path.join(work, 'surface-layers.png'), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify(result, null, 2));
  await writeFile(path.join(work, 'surface-layer-browser-results.json'), JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await writeFile(path.join(work, 'surface-layer-chromium.log'), stderr);
  child.kill();
}
