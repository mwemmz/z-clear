import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function findRepoRoot(start: string): string {
  for (let current = resolve(start); ;) {
    if (existsSync(join(current, 'render.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('render.yaml not found from the current directory');
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot(process.cwd());
const blueprint = readFileSync(join(repoRoot, 'render.yaml'), 'utf8');
const apiPackage = JSON.parse(readFileSync(join(repoRoot, 'apps/api/package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};

/** Regression guard for the free Render build after the EROFS failure. */
describe('Render blueprint', () => {
  it('does not enable Corepack shims on Render’s read-only filesystem', () => {
    expect(blueprint).not.toContain('corepack enable');
  });

  it('uses Corepack pnpm directly for every install, build and start command', () => {
    expect(blueprint).toContain('corepack pnpm install --frozen-lockfile');
    expect(blueprint).toContain('corepack pnpm --filter @zclear/api... build');
    expect(blueprint).toContain('corepack pnpm --filter @zclear/web... build');
    expect(blueprint).toContain('corepack pnpm --filter @zclear/api db:migrate');
    expect(blueprint).toContain('corepack pnpm --filter @zclear/api db:grant');
    expect(blueprint).toContain('corepack pnpm --filter @zclear/api start');
    expect(blueprint).not.toMatch(/^\s+pnpm /m);
  });

  it('keeps the paid-only preDeployCommand out of the free plan', () => {
    expect(blueprint).not.toContain('preDeployCommand:');
  });

  it('runs the hosted seed at startup behind an explicit flag', () => {
    expect(blueprint).toContain('HOSTED_DEMO_SEED_ONCE');
    expect(blueprint).toMatch(/- key: HOSTED_DEMO_SEED_ONCE\s+value: 'true'/);
    expect(blueprint).toContain('db:seed:hosted');
    const conditionalSeed = blueprint.match(
      /if \[ "\$HOSTED_DEMO_SEED_ONCE" = "true" \]; then[\s\S]*?db:seed:hosted[\s\S]*?fi/,
    );
    expect(conditionalSeed).not.toBeNull();
    expect(apiPackage.scripts?.['db:seed:hosted']).toBe(
      'node dist/scripts/seed-review-demo.js --hosted',
    );
  });

  it('declares the hosted demo password as a Render secret', () => {
    expect(blueprint).toMatch(/- key: HOSTED_DEMO_PASSWORD\s+sync: false/);
  });
});
