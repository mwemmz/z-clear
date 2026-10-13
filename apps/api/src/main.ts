import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { corsOrigins, loadEnv } from './config/env';
import { createRootLogger, PinoNestLogger } from './common/logger/logger';
import { ApiExceptionsFilter } from './common/errors/api-exceptions.filter';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { setupOpenApi } from './openapi';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const rootLogger = createRootLogger(env);

  const app = await NestFactory.create(AppModule, {
    logger: new PinoNestLogger(rootLogger),
  });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(compression());
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ApiExceptionsFilter(rootLogger));
  app.enableCors({ origin: corsOrigins(env), credentials: true });
  app.enableShutdownHooks();

  setupOpenApi(app, env);

  await app.listen(env.API_PORT);
  rootLogger.info({ port: env.API_PORT }, 'api listening');
}

void bootstrap();
