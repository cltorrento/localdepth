#!/usr/bin/env node

/**
 * LocalDepth Backend Services Runner
 * Starts API Gateway and all microservices concurrently for local development and testing.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');

const services = [
  { name: 'auth-service', envVar: 'AUTH_SERVICE_PORT', port: 4001, script: 'services/auth-service/src/index.ts' },
  { name: 'content-service', envVar: 'CONTENT_SERVICE_PORT', port: 4002, script: 'services/content-service/src/index.ts' },
  { name: 'media-service', envVar: 'MEDIA_SERVICE_PORT', port: 4003, script: 'services/media-service/src/index.ts' },
  { name: 'search-service', envVar: 'SEARCH_SERVICE_PORT', port: 4004, script: 'services/search-service/src/index.ts' },
  { name: 'recommendations-service', envVar: 'RECOMMENDATIONS_SERVICE_PORT', port: 4005, script: 'services/recommendations-service/src/index.ts' },
  { name: 'api-gateway', envVar: 'API_GATEWAY_PORT', port: 4000, script: 'services/api-gateway/src/index.ts' },
];

const processes = [];

console.log('\n🚀 Starting LocalDepth Backend Stack...\n');

services.forEach((s) => {
  const child = spawn(
    'node',
    ['--no-warnings', '--experimental-strip-types', s.script],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        [s.envVar]: String(s.port),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.log(`[\x1b[36m${s.name}\x1b[0m] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
      console.error(`[\x1b[31m${s.name}\x1b[0m] ${line}`);
    });
  });

  processes.push(child);
});

function cleanup() {
  console.log('\n🛑 Shutting down all LocalDepth services...');
  processes.forEach((p) => p.kill('SIGTERM'));
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
