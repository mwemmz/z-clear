import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_ENV } from '../config/config.module';
import type { AppEnv } from '../config/env';

export interface HealthResponse {
  status: 'ok';
  version: string;
  environment: string;
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and build information' })
  @ApiOkResponse({ description: 'Service is running' })
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      version: this.env.APP_VERSION,
      environment: this.env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
