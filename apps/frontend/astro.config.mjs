import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (fs.existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
