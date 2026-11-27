import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import {
  listNotificationsSchema,
  type ListNotificationsQuery,
  type NotificationView,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

/**
 * Read-only view of the provider seam. The default `sms_mock` provider records
 * skipped outcomes and sends nothing; the UI must say so explicitly.
 */
@ApiTags('notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @RequirePermissions('notification:read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('notifications')
  @ApiOperation({
    summary: 'List append-only delivery outcomes for the current tenant',
    description: 'Recipient addresses are never returned. SMS mock sends nothing.',
  })
  list(
    @Query(new ZodValidationPipe(listNotificationsSchema)) query: ListNotificationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationView[]> {
    return this.notifications.list(user.tenantId, { role: user.role, userId: user.userId }, query);
  }
}
