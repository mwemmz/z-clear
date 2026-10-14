import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../src/modules/policy/decorators';

/**
 * Build-time guard: the access guard denies any authenticated route that
 * declares no permissions. This test fails fast when a new endpoint forgets
 * either @Public() or @RequirePermissions(...).
 */
describe('policy declaration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule, AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('declares @Public or @RequirePermissions on every route', () => {
    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const scanner = new MetadataScanner();
    const undeclared: string[] = [];

    for (const wrapper of discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!metatype || !instance) continue;

      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;

        const targets = [handler, metatype];
        const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
        const permissions = reflector.getAllAndOverride<readonly string[]>(
          PERMISSIONS_KEY,
          targets,
        );
        if (!isPublic && (!permissions || permissions.length === 0)) {
          undeclared.push(`${metatype.name}.${name}`);
        }
      }
    }

    expect(undeclared).toEqual([]);
  });
});
