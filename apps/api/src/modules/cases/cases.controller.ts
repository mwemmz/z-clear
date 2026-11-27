import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { RequirePermissions, CurrentUser } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { CasesService } from './cases.service';
import { createCaseSchema, type CaseSummary, type CreateCaseInput } from './cases.dto';

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @RequirePermissions('case:create')
  @Post()
  @ApiOperation({ summary: 'Open an importation case as the signed-in importer' })
  create(
    @Body(new ZodValidationPipe(createCaseSchema)) body: CreateCaseInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CaseSummary> {
    return this.cases.create(user.tenantId, user.userId, body, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
