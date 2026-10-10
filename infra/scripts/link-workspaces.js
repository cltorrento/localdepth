import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const targetDir = path.join(rootDir, 'node_modules', '@localdepth');

fs.mkdirSync(targetDir, { recursive: true });

const packagesDir = path.join(rootDir, 'packages');
const packages = fs.readdirSync(packagesDir);

for (const pkg of packages) {
  const pkgSrc = path.join(packagesDir, pkg);
  if (!fs.statSync(pkgSrc).isDirectory()) continue;

  const dest = path.join(targetDir, pkg);
  try {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.symlinkSync(pkgSrc, dest, 'junction');
    console.log(`Linked @localdepth/${pkg} -> packages/${pkg}`);
  } catch (err) {
    console.error(`Failed to link ${pkg}:`, err.message);
  }
}
