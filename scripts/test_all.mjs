import { spawn } from 'node:child_process';

let failed = false;
for (const args of [['node_modules/vitest/vitest.mjs', 'run'], ['scripts/run_tests.mjs']]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (status) => resolve(status ?? 1));
  });
  failed ||= code !== 0;
}
process.exitCode = failed ? 1 : 0;
