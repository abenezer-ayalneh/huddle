#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function selectBuildEnvFile(root = process.cwd()) {
  for (const file of ['.env', '.env.prod']) {
    if (existsSync(`${root}/${file}`)) return file;
  }

  throw new Error('Build requires either .env or .env.prod at the repository root');
}

function main() {
  const envFile = selectBuildEnvFile();
  const child = spawn('node', ['scripts/with-env.mjs', envFile, '--', 'pnpm', '-r', 'build'], {
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
