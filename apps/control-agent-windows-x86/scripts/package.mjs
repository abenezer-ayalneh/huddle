import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
const version = process.env.WINDOWS_CONTROL_AGENT_VERSION ?? packageJson.version;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('WINDOWS_CONTROL_AGENT_VERSION must be a semantic version.');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: packageDirectory, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', ['run', 'build:renderer']);
run(process.execPath, [resolve(packageDirectory, 'scripts', 'rebuild-native.mjs'), '--arch=ia32']);
run(resolve(packageDirectory, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'), [
  '--win',
  'nsis',
  '--ia32',
  '--publish',
  'never',
  `--config.extraMetadata.version=${version}`,
]);

const artifact = resolve(packageDirectory, 'dist', 'Huddle-Control-Agent-windows-x86.exe');
const checksum = createHash('sha256')
  .update(await readFile(artifact))
  .digest('hex');
await writeFile(`${artifact}.sha256`, `${checksum}  Huddle-Control-Agent-windows-x86.exe\n`);
