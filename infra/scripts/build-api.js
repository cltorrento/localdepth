// Empaqueta gateway + servicios + paquetes del workspace en un único JS para Vercel.
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

await build({
  entryPoints: [path.join(root, 'infra/api/entry.ts')],
  outfile: path.join(root, 'api/_handler.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['pg', 'pg-native'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
