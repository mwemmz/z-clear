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
  constructor(private readonly reviews: ReviewsService) {}

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
  send(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @Body(new ZodValidationPipe(sendReviewSchema)) body: SendReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    return this.reviews.send(user.tenantId, user.userId, shipmentId, body, metaOf(req));
  }

  @RequirePermissions('review:query')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('reviews/:id/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask a question about the review (importer action)' })
  query(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(queryReviewSchema)) body: QueryReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    return this.reviews.query(
      user.tenantId,
      { role: user.role, userId: user.userId },
      user.userId,
      id,
      body,
      metaOf(req),
    );
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
  approve(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ImporterReviewSummary> {
    return this.reviews.approve(user.tenantId, user.userId, id, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
