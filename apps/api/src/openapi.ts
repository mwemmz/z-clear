import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppEnv } from './config/env';

/**
 * OpenAPI is generated from code (decorators), never hand-written, so the spec
 * cannot drift from the implementation.
 */
export function setupOpenApi(app: INestApplication, env: AppEnv): void {
  const config = new DocumentBuilder()
    .setTitle('Clearing Agent Platform API')
    .setDescription(
      'Multi-tenant API for Zambian clearing and forwarding agents. ' +
        'Customs declarations remain in ASYCUDA World; this API handles the ' +
        'workflow around it.',
    )
    .setVersion(env.APP_VERSION)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/openapi.json',
  });
}
