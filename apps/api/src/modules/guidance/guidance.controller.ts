import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import {
  createGuidanceSchema,
  listGuidanceSchema,
  updateGuidanceSchema,
  type CreateGuidanceInput,
  type GuidanceView,
  type ListGuidanceQuery,
  type UpdateGuidanceInput,
} from './guidance.dto';
import { GuidanceService } from './guidance.service';

const uuidParam = new ZodValidationPipe(z.string().uuid());

/** Agency-owned setup guidance; never seeded with official requirements. */
@ApiTags('guidance')
@Controller()
export class GuidanceController {
  constructor(private readonly guidance: GuidanceService) {}

  @RequirePermissions('guidance:read')
  @Get('guidance')
  @ApiOperation({ summary: 'List this agency’s configured registry guidance' })
  list(
    @Query(new ZodValidationPipe(listGuidanceSchema)) query: ListGuidanceQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GuidanceView[]> {
    return this.guidance.list(user.tenantId, query);
  }

  @RequirePermissions('guidance:write')
  @Post('guidance')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add a guidance step (agency-owned configuration)' })
  create(
    @Body(new ZodValidationPipe(createGuidanceSchema)) body: CreateGuidanceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<GuidanceView> {
    return this.guidance.create(user.tenantId, user.userId, body, metaOf(req));
  }

  @RequirePermissions('guidance:write')
  @Patch('guidance/:id')
  @ApiOperation({ summary: 'Update a guidance step' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateGuidanceSchema)) body: UpdateGuidanceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<GuidanceView> {
    return this.guidance.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('guidance:write')
  @Delete('guidance/:id')
  @ApiOperation({ summary: 'Remove a guidance step' })
  remove(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.guidance.remove(user.tenantId, user.userId, id, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
