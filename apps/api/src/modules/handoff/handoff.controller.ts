import { Controller, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import { HandoffService } from './handoff.service';
import type { HandoffExport } from './handoff.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('handoff')
@Controller()
export class HandoffController {
  constructor(private readonly handoff: HandoffService) {}

  @RequirePermissions('export:create')
  @Post('shipments/:id/handoff-export')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a one-way handoff artifact for ASYCUDA keying' })
  create(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HandoffExport> {
    return this.handoff.create(user.tenantId, user.userId, id, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
