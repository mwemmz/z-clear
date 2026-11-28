import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import {
  listPointLedgerSchema,
  type ListPointLedgerQuery,
  type PointLedgerEntry,
  type PointsSummary,
  type ReferralsSummary,
} from './loyalty.dto';
import { LoyaltyService } from './loyalty.service';

/**
 * Additive read-only programme surface. No write route exists while the rules
 * are unconfigured, and every response explains the boundary instead of
 * inventing a balance, reward or referral incentive.
 */
@ApiTags('loyalty')
@Controller()
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @RequirePermissions('points:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('points/me')
  @ApiOperation({
    summary: 'Read the current user’s points programme summary',
    description: 'Balance is null while the programme has no verified rules.',
  })
  pointsMe(@CurrentUser() user: AuthenticatedUser): Promise<PointsSummary> {
    return this.loyalty.pointsMe(user.tenantId, user.userId);
  }

  @RequirePermissions('points:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('points/ledger')
  @ApiOperation({
    summary: 'List the current user’s append-only point ledger entries',
    description: 'Empty while no verified programme rules exist.',
  })
  pointsLedger(
    @Query(new ZodValidationPipe(listPointLedgerSchema)) query: ListPointLedgerQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PointLedgerEntry[]> {
    return this.loyalty.pointsLedger(user.tenantId, user.userId, query);
  }

  @RequirePermissions('referral:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('referrals/me')
  @ApiOperation({
    summary: 'Read the current user’s referral programme summary',
    description: 'Structural records only; no incentive or reward claim is encoded.',
  })
  referralsMe(@CurrentUser() user: AuthenticatedUser): Promise<ReferralsSummary> {
    return this.loyalty.referralsMe(user.tenantId, user.userId);
  }
}
