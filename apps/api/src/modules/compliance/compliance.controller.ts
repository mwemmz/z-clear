import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { ComplianceAssistant, ComplianceEstimate, EstimateRequest } from './compliance.dto';
import { estimateSchema } from './compliance.dto';
import { ComplianceService } from './compliance.service';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @RequirePermissions('compliance:read')
  @Get('assistant/:caseId')
  @ApiOperation({ summary: 'Read importer-facing compliance prompts for the caller’s own case' })
  assistant(
    @Param('caseId', uuidParam) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ComplianceAssistant> {
    return this.compliance.assistant(user.tenantId, user.userId, caseId);
  }

  @RequirePermissions('compliance:read')
  @Post('estimate')
  @ApiOperation({
    summary: 'Request an illustrative estimate; refuses unless tariff data is VERIFIED',
  })
  estimate(@Body(new ZodValidationPipe(estimateSchema)) body: EstimateRequest): ComplianceEstimate {
    return this.compliance.estimate(body);
  }
}
