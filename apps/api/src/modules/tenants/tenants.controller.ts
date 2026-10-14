import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { TenantsService } from './tenants.service';
import { updateTenantSchema, type TenantSummary, type UpdateTenantInput } from './tenants.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @RequirePermissions('tenant:read')
  @Get('current')
  @ApiOperation({ summary: 'Get the current tenant (agency)' })
  getCurrent(@CurrentUser() user: AuthenticatedUser): Promise<TenantSummary> {
    return this.tenants.getCurrent(user.tenantId);
  }

  @RequirePermissions('tenant:update')
  @Patch('current')
  @ApiOperation({ summary: 'Update the current tenant (agency)' })
  updateCurrent(
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<TenantSummary> {
    return this.tenants.update(user.tenantId, user.userId, body, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
