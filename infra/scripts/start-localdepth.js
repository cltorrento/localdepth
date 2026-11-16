#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = new Set();
let shuttingDown = false;

const envFile = path.join(rootDir, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function runSetupCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
  });
}

function ensureDependencies() {
  const requiredPaths = [
    'node_modules/@astrojs/vercel/package.json',
    'node_modules/astro/package.json',
    'node_modules/vite/package.json',
    'node_modules/react/package.json',
    'node_modules/react-dom/package.json',
    'node_modules/@localdepth/database/package.json',
    'node_modules/@localdepth/logger/package.json',
    'node_modules/@localdepth/shared-types/package.json',
    'node_modules/@localdepth/shared-utils/package.json',
    'node_modules/@localdepth/validation/package.json',
  ];
  const dependenciesMissing = requiredPaths.some((relativePath) =>
    !fs.existsSync(path.join(rootDir, relativePath))
  );

  if (!dependenciesMissing) {
    console.log('📦 Dependencias npm listas.');
    return;
  }

  console.log('📦 Faltan dependencias; ejecutando npm install...');
  const result = runSetupCommand(npmCommand, ['install']);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm install terminó con código ${result.status ?? 'desconocido'}.`);
  }
}

function stopProcesses(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
}

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });
  processes.add(child);

  child.on('error', (error) => {
    console.error(`❌ No se pudo iniciar ${name}: ${error.message}`);
    stopProcesses();
    process.exitCode = 1;
  });

  child.on('exit', (code, signal) => {
    processes.delete(child);
    if (!shuttingDown) {
      console.error(`❌ ${name} terminó inesperadamente (código ${code ?? signal ?? 'desconocido'}).`);
      stopProcesses();
      process.exitCode = code && code > 0 ? code : 1;
    }
    if (shuttingDown && processes.size === 0) process.exit();
  });
}

try {
  console.log('\n🚀 Preparando LocalDepth...\n');
  ensureDependencies();

  console.log('\n▶️  Iniciando backend, frontend y panel admin...');
  startProcess('backend', process.execPath, ['infra/scripts/start-all.js']);
  startProcess('frontend', npmCommand, ['run', 'dev', '--workspace=@localdepth/frontend']);
  startProcess('admin', npmCommand, ['run', 'dev', '--workspace=@localdepth/admin']);

  console.log('\n✅ LocalDepth en proceso de arranque:');
  console.log('   Frontend: http://localhost:3000');
  console.log('   Admin:    http://localhost:3001');
  console.log('   API:      http://localhost:4000');
  console.log('   Pulsa Ctrl+C para detener todos los procesos.\n');
} catch (error) {
  console.error(`❌ No se pudo preparar LocalDepth: ${error.message}`);
  process.exitCode = 1;
  stopProcesses();
}

process.on('SIGINT', () => stopProcesses('SIGTERM'));
process.on('SIGTERM', () => stopProcesses('SIGTERM'));
