import { cp, mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const architecture =
  process.argv.find((argument) => argument.startsWith('--arch='))?.slice('--arch='.length) ?? process.env.WINDOWS_CONTROL_AGENT_ARCH ?? 'ia32';
if (architecture !== 'ia32') throw new Error('The x86 Control Agent native bridge must be built as ia32.');
if (process.platform !== 'win32') {
  console.log('Skipping Windows native bridge rebuild outside Windows.');
  process.exit(0);
}

const packageJson = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
const nodeGyp = resolve(packageDirectory, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
const result = spawnSync(
  process.execPath,
  [nodeGyp, 'rebuild', `--arch=${architecture}`, `--target=${packageJson.devDependencies.electron}`, '--dist-url=https://electronjs.org/headers'],
  { cwd: resolve(packageDirectory, 'native'), stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);

const outputDirectory = resolve(packageDirectory, 'native', 'prebuild', architecture);
await mkdir(outputDirectory, { recursive: true });
await cp(resolve(packageDirectory, 'native', 'build', 'Release', 'huddle_control_bridge.node'), resolve(outputDirectory, 'huddle_control_bridge.node'));
