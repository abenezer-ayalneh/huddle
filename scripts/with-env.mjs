#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const separator = process.argv.indexOf('--');

if (separator === -1 || separator < 3 || separator === process.argv.length - 1) {
  console.error('Usage: node scripts/with-env.mjs <env-file> [env-file...] -- <command> [args...]');
  process.exit(1);
}

const envFiles = process.argv.slice(2, separator);
const command = process.argv.slice(separator + 1);
const env = { ...process.env };

for (const file of envFiles) {
  if (!existsSync(file)) {
    console.error(`Missing env file: ${file}`);
    process.exit(1);
  }
  Object.assign(env, parseEnv(readFileSync(file, 'utf8'), file));
}

const child = spawn(command[0], command.slice(1), {
  env,
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

function parseEnv(source, file) {
  const out = {};
  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('export ')) line = line.slice('export '.length).trimStart();

    const eq = line.indexOf('=');
    if (eq === -1) {
      console.error(`${file}:${index + 1}: expected KEY=value`);
      process.exit(1);
    }

    const key = line.slice(0, eq).trim();
    let value = stripInlineComment(line.slice(eq + 1).trim());
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.error(`${file}:${index + 1}: invalid env key "${key}"`);
      process.exit(1);
    }

    value = unquote(value);
    out[key] = value;
  });

  return out;
}

function stripInlineComment(value) {
  let quote = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if ((char === '"' || char === "'") && value[i - 1] !== '\\') {
      quote = quote === char ? '' : quote || char;
      continue;
    }
    if (char === '#' && !quote && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value;
}

function unquote(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if (first !== last || (first !== '"' && first !== "'")) return value;

  const inner = value.slice(1, -1);
  if (first === "'") return inner;
  return inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
