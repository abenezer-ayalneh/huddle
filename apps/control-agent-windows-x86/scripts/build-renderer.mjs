import { build } from 'esbuild';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
const outputDirectory = resolve(packageDirectory, 'dist-renderer');

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(packageDirectory, 'src', 'renderer', 'renderer.mjs')],
  outfile: resolve(outputDirectory, 'renderer.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome150',
  minify: true,
  define: {
    __WINDOWS_CONTROL_AGENT_VERSION__: JSON.stringify(process.env.WINDOWS_CONTROL_AGENT_VERSION ?? packageJson.version),
    __WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL__: JSON.stringify(process.env.WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL ?? ''),
    __WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY__: JSON.stringify(process.env.WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY ?? ''),
  },
});
await Promise.all([
  cp(resolve(packageDirectory, 'src', 'renderer', 'index.html'), resolve(outputDirectory, 'index.html')),
  cp(resolve(packageDirectory, 'src', 'renderer', 'styles.css'), resolve(outputDirectory, 'styles.css')),
]);
