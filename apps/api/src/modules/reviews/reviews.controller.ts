import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewsService } from './reviews.service';
import {
  listReviewsSchema,
  queryReviewSchema,
  reviseReviewSchema,
  sendReviewSchema,
  type ImporterReviewSummary,
  type ListReviewsQuery,
  type QueryReviewInput,
  type ReviseReviewInput,
  type SendReviewInput,
} from './reviews.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly notify: NotificationsService,
  ) {}

  @RequirePermissions('review:read')
  @Get('reviews')
  @ApiOperation({ summary: 'List importer review revisions for the current tenant' })
  list(
    @Query(new ZodValidationPipe(listReviewsSchema)) query: ListReviewsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImporterReviewSummary[]> {
    return this.reviews.list(user.tenantId, { role: user.role, userId: user.userId }, query);
  }

  @RequirePermissions('review:read')
  @Get('reviews/:id')
  @ApiOperation({ summary: 'Get one importer review revision' })
  get(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImporterReviewSummary> {
    return this.reviews.get(user.tenantId, { role: user.role, userId: user.userId }, id);
  }

  @RequirePermissions('review:send')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('shipments/:shipmentId/review/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send (or re-send a draft of) the shipment review to the importer' })
  async send(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @Body(new ZodValidationPipe(sendReviewSchema)) body: SendReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    const summary = await this.reviews.send(
      user.tenantId,
      user.userId,
      shipmentId,
      body,
      metaOf(req),
    );
    // A blocked draft was never sent, so it must not generate a notification.
    if (summary.state !== 'draft') {
      await this.notify.emit({
        tenantId: user.tenantId,
        shipmentId,
        eventType: 'review.sent',
        entityType: 'importer_review',
        entityId: summary.id,
        subject: `Review ready for shipment ${summary.shipmentId}`,
        body: `A new review revision ${summary.revision} is waiting for your approval.`,
        audience: 'importer',
        meta: metaOf(req),
      });
    }
    return summary;
  }

  @RequirePermissions('review:query')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('reviews/:id/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask a question about the review (importer action)' })
  async query(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(queryReviewSchema)) body: QueryReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    const summary = await this.reviews.query(
      user.tenantId,
      { role: user.role, userId: user.userId },
      user.userId,
      id,
      body,
      metaOf(req),
    );
    await this.notify.emit({
      tenantId: user.tenantId,
      shipmentId: summary.shipmentId,
      eventType: 'review.queried',
      entityType: 'importer_review',
      entityId: summary.id,
      subject: `Question on review ${summary.id}`,
      body: `The importer asked a question on revision ${summary.revision}.`,
      audience: 'agency',
      meta: metaOf(req),
    });
    return summary;
  }

  @RequirePermissions('review:send')
  @Post('reviews/:id/revise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Correct the review: open a new draft revision' })
  revise(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(reviseReviewSchema)) body: ReviseReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    return this.reviews.revise(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('review:approve')
  @Post('reviews/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve the exact revision; rejects stale revisions' })
  async approve(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    const summary = await this.reviews.approve(user.tenantId, user.userId, id, metaOf(req));
    await this.notify.emit({
      tenantId: user.tenantId,
      shipmentId: summary.shipmentId,
      eventType: 'review.approved',
      entityType: 'importer_review',
      entityId: summary.id,
      subject: `Review approved for shipment ${summary.shipmentId}`,
      body: `Revision ${summary.revision} was approved by the importer.`,
      audience: 'agency',
      meta: metaOf(req),
    });
    return summary;
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
