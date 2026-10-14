import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// Vite's persistence plugin writes relative to its config directory. Run the
// actual config in a disposable copy so save/reset tests cannot touch user plans.
const root = resolve('.');
const sandbox = mkdtempSync(join(tmpdir(), 'hview-e2e-'));
const checkout = join(sandbox, 'app');
const exclude = new Set(['.git', 'node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', 'scratch', 'work']);
cpSync(root, checkout, { recursive: true, filter: path => !exclude.has(basename(path)) });
symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
// Build templates from current source, never overwrite tracked public templates.
if (process.env.HVIEW_E2E_BUILD_EXPORTS === '1') {
  for (const args of [
    [join(root, 'node_modules/vite/bin/vite.js'), 'build'],
    [join(root, 'node_modules/tsx/dist/cli.mjs'), 'scripts/build_standalone_viewer.ts'],
  ]) {
    const built = spawnSync(process.execPath, args, { cwd: checkout, stdio: 'inherit' });
    if (built.status !== 0) { rmSync(sandbox, { recursive: true, force: true }); process.exit(built.status ?? 1); }
  }
}
const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '3100', '--strictPort'], { cwd: checkout, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(sandbox, { recursive: true, force: true }); process.exit(code ?? 0); });
