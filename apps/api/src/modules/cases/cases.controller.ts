import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { RequirePermissions, CurrentUser } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { CasesService } from './cases.service';
import {
  createCaseSchema,
  type CaseChecklist,
  type CaseStatus,
  type CaseSummary,
  type CreateCaseInput,
} from './cases.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

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

  @RequirePermissions('document:read')
  @Get(':id/checklist')
  @ApiOperation({ summary: 'Read the importer’s own personalised, provenance-labelled checklist' })
  checklist(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CaseChecklist> {
    return this.cases.checklist(user.tenantId, user.userId, id);
  }

  @RequirePermissions('case:read')
  @Get(':id/status')
  @ApiOperation({ summary: 'Read plain-language status answers for the importer’s own case' })
  status(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CaseStatus> {
    return this.cases.status(user.tenantId, user.userId, id);
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
