import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { QuotesService } from './quotes.service';
import {
  createQuoteSchema,
  quoteStatusSchema,
  updateQuoteSchema,
  type CreateQuoteInput,
  type QuoteDetail,
  type QuoteStatusInput,
  type QuoteSummary,
  type UpdateQuoteInput,
} from './billing.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('quotes')
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @RequirePermissions('quote:read')
  @Get('shipments/:shipmentId/quotes')
  @ApiOperation({ summary: 'List quotes for a shipment' })
  list(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuoteSummary[]> {
    return this.quotes.listForShipment(user.tenantId, shipmentId);
  }

  @RequirePermissions('quote:write')
  @Post('shipments/:shipmentId/quotes')
  @ApiOperation({ summary: 'Create a quote with line items' })
  create(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @Body(new ZodValidationPipe(createQuoteSchema)) body: CreateQuoteInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<QuoteDetail> {
    return this.quotes.create(user.tenantId, user.userId, shipmentId, body, metaOf(req));
  }

  @RequirePermissions('quote:read')
  @Get('quotes/:id')
  @ApiOperation({ summary: 'Get a quote with its lines' })
  get(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuoteDetail> {
    return this.quotes.get(user.tenantId, id);
  }

  @RequirePermissions('quote:write')
  @Patch('quotes/:id')
  @ApiOperation({ summary: 'Update a draft quote' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateQuoteSchema)) body: UpdateQuoteInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<QuoteDetail> {
    return this.quotes.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('quote:write')
  @Post('quotes/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move a quote through its lifecycle (sent/accepted/declined/expired)' })
  setStatus(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(quoteStatusSchema)) body: QuoteStatusInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<QuoteDetail> {
    return this.quotes.setStatus(user.tenantId, user.userId, id, body, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
