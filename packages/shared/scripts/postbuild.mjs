import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function writeMarker(relativeDir, type) {
  const dir = resolve(root, relativeDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}

// dist/esm must be treated as ESM; dist/cjs as CommonJS.
writeMarker('dist/esm', 'module');
writeMarker('dist/cjs', 'commonjs');
