import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['dist', 'dist-renderer', 'node_modules', 'native'].includes(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) sources.push(fullPath);
  }
}

await collect(packageDirectory);
for (const source of sources) {
  const result = spawnSync(process.execPath, ['--check', source], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
