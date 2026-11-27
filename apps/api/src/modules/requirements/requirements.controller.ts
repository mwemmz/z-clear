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
  createRequirementSchema,
  listRequirementsSchema,
  updateRequirementSchema,
  type CreateRequirementInput,
  type ListRequirementsQuery,
  type RequirementView,
  type UpdateRequirementInput,
} from './requirements.dto';
import { RequirementsService } from './requirements.service';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('requirements')
@Controller()
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @RequirePermissions('document:read')
  @Get('requirements')
  @ApiOperation({ summary: 'List the agency’s document checklist configuration' })
  list(
    @Query(new ZodValidationPipe(listRequirementsSchema)) query: ListRequirementsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequirementView[]> {
    return this.requirements.list(user.tenantId, query);
  }

  @RequirePermissions('document:write')
  @Post('requirements')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Add a document requirement (agency-owned configuration)' })
  create(
    @Body(new ZodValidationPipe(createRequirementSchema)) body: CreateRequirementInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<RequirementView> {
    return this.requirements.create(user.tenantId, user.userId, body, metaOf(req));
  }

  @RequirePermissions('document:write')
  @Patch('requirements/:id')
  @ApiOperation({ summary: 'Update a document requirement' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateRequirementSchema)) body: UpdateRequirementInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<RequirementView> {
    return this.requirements.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('document:write')
  @Delete('requirements/:id')
  @ApiOperation({ summary: 'Remove a document requirement' })
  remove(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.requirements.remove(user.tenantId, user.userId, id, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
