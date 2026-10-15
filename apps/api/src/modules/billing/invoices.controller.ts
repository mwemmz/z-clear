import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { InvoicesService } from './invoices.service';
import {
  createInvoiceSchema,
  listInvoicesSchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
  type CreateInvoiceInput,
  type InvoiceDetail,
  type ListInvoicesQuery,
  type PaymentSummary,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
  type VoidInvoiceInput,
} from './billing.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('invoices')
@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @RequirePermissions('invoice:read')
  @Get('invoices')
  @ApiOperation({ summary: 'List invoices for the current tenant' })
  list(
    @Query(new ZodValidationPipe(listInvoicesSchema)) query: ListInvoicesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceDetail[]> {
    return this.invoices.list(user.tenantId, query);
  }

  @RequirePermissions('invoice:write')
  @Post('shipments/:shipmentId/invoices')
  @ApiOperation({ summary: 'Create an invoice from an accepted quote or standalone lines' })
  create(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    return this.invoices.create(user.tenantId, user.userId, shipmentId, body, metaOf(req));
  }

  @RequirePermissions('invoice:read')
  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an invoice with its lines and payments' })
  get(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceDetail> {
    return this.invoices.get(user.tenantId, id);
  }

  @RequirePermissions('invoice:write')
  @Patch('invoices/:id')
  @ApiOperation({ summary: 'Update a draft invoice' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    return this.invoices.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('invoice:write')
  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a draft invoice (freezes it)' })
  issue(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    return this.invoices.issue(user.tenantId, user.userId, id, metaOf(req));
  }

  @RequirePermissions('invoice:write')
  @Post('invoices/:id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an invoice with a reason (never edited in place)' })
  void(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(voidInvoiceSchema)) body: VoidInvoiceInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    return this.invoices.voidInvoice(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('invoice:read')
  @Get('invoices/:id/payments')
  @ApiOperation({ summary: 'List payments recorded against an invoice' })
  listPayments(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentSummary[]> {
    return this.invoices.listPayments(user.tenantId, id);
  }

  @RequirePermissions('payment:record')
  @Post('invoices/:id/payments')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record a payment against an issued invoice' })
  recordPayment(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    return this.invoices.recordPayment(user.tenantId, user.userId, id, body, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
