import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const ALLOWED_SIZES = new Set([16, 20, 24]);
const TABLER_ALLOWED_FILES = new Set(['AgentWorkspace.tsx']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.spec.tsx')) return [];
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

const files = sourceFiles(SRC);

describe('icon contract', () => {
  it('uses named imports from the icon packages', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} uses a default icon import`).not.toMatch(
        /import\s+[A-Z][A-Za-z0-9]*\s+from\s+['"]@(phosphor-icons\/react|tabler\/icons-react)['"]/,
      );
      expect(source, `${file} uses a namespace icon import`).not.toMatch(
        /import\s+\*\s+as\s+\w+\s+from\s+['"]@(phosphor-icons\/react|tabler\/icons-react)['"]/,
      );
    }
  });

  it('limits Tabler icons to logistics gaps', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('@tabler/icons-react')) continue;
      expect(TABLER_ALLOWED_FILES.has(file.split(/[\\/]/).pop() ?? '')).toBe(true);
    }
  });

  it('uses only the 16/20/24 icon scale', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bsize=\{?(\d+)\}?/g)) {
        const size = Number(match[1]);
        expect(ALLOWED_SIZES.has(size), `${file} uses icon size ${size}`).toBe(true);
      }
    }
  });
});
