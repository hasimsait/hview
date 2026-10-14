import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const tests = (await readdir(path.join(root, 'tests'))).filter((name) => name.endsWith('.test.ts')).sort();
const outputDir = path.join(root, 'work', 'test-bundles');
await mkdir(outputDir, { recursive: true });

for (const name of tests) {
  const outfile = path.join(outputDir, name.replace(/\.ts$/, '.mjs'));
  await build({
    entryPoints: [path.join(root, 'tests', name)], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node20',
    tsconfig: path.join(root, 'tsconfig.json'),
  });
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [outfile], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
  if (status !== 0) process.exit(status);
}
