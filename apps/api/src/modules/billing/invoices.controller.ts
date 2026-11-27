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
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService, type BillingViewer } from './invoices.service';
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
  constructor(
    private readonly invoices: InvoicesService,
    private readonly notify: NotificationsService,
  ) {}

  @RequirePermissions('invoice:read')
  @Get('invoices')
  @ApiOperation({ summary: 'List invoices for the current tenant' })
  list(
    @Query(new ZodValidationPipe(listInvoicesSchema)) query: ListInvoicesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceDetail[]> {
    return this.invoices.list(user.tenantId, query, viewerOf(user));
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
    return this.invoices.get(user.tenantId, id, viewerOf(user));
  }

  @RequirePermissions('invoice:read')
  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Download the invoice as a PDF snapshot' })
  async pdf(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.invoices.renderPdf(
      user.tenantId,
      user.userId,
      id,
      metaOf(req),
      viewerOf(user),
    );
    res.type('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.number}.pdf"`);
    res.send(result.bytes);
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
  async issue(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    const invoice = await this.invoices.issue(user.tenantId, user.userId, id, metaOf(req));
    await this.notify.emit({
      tenantId: user.tenantId,
      shipmentId: invoice.shipmentId,
      eventType: 'invoice.issued',
      entityType: 'invoice',
      entityId: invoice.id,
      subject: `Invoice ${invoice.number} issued`,
      body: `Invoice ${invoice.number} for ${invoice.currency} ${(invoice.totalMinor / 100).toFixed(2)} has been issued.`,
      audience: 'both',
      meta: metaOf(req),
    });
    return invoice;
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
    return this.invoices.listPayments(user.tenantId, id, viewerOf(user));
  }

  @RequirePermissions('payment:record')
  @Post('invoices/:id/payments')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record a payment against an issued invoice' })
  async recordPayment(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvoiceDetail> {
    const invoice = await this.invoices.recordPayment(
      user.tenantId,
      user.userId,
      id,
      body,
      metaOf(req),
    );
    await this.notify.emit({
      tenantId: user.tenantId,
      shipmentId: invoice.shipmentId,
      eventType: 'payment.recorded',
      entityType: 'invoice',
      entityId: invoice.id,
      subject: `Payment recorded for ${invoice.number}`,
      body: `A payment of ${invoice.currency} ${(body.amountMinor / 100).toFixed(2)} was recorded against invoice ${invoice.number}.`,
      audience: 'agency',
      meta: metaOf(req),
    });
    return invoice;
  }
}

function viewerOf(user: AuthenticatedUser): BillingViewer {
  return { role: user.role, userId: user.userId };
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
