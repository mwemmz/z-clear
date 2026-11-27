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
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { ShipmentsService } from './shipments.service';
import {
  assignDriverSchema,
  checkInSchema,
  createShipmentSchema,
  listShipmentsSchema,
  updateShipmentSchema,
  updateStageSchema,
  type AssignDriverInput,
  type CheckInInput,
  type CreateShipmentInput,
  type ListShipmentsQuery,
  type ShipmentDetail,
  type ShipmentEventSummary,
  type ShipmentSummary,
  type UpdateShipmentInput,
  type UpdateStageInput,
} from './shipments.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @RequirePermissions('shipment:read')
  @Get()
  @ApiOperation({ summary: 'List shipments for the current tenant' })
  list(
    @Query(new ZodValidationPipe(listShipmentsSchema)) query: ListShipmentsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentSummary[]> {
    return this.shipments.list(user.tenantId, query, { role: user.role, userId: user.userId });
  }

  @RequirePermissions('shipment:create')
  @Post()
  @ApiOperation({ summary: 'Create a shipment' })
  create(
    @Body(new ZodValidationPipe(createShipmentSchema)) body: CreateShipmentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentSummary> {
    return this.shipments.create(user.tenantId, user.userId, body, metaOf(req));
  }

  @RequirePermissions('shipment:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get a shipment and its stage timeline' })
  get(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentDetail> {
    return this.shipments.get(user.tenantId, id, { role: user.role, userId: user.userId });
  }

  @RequirePermissions('shipment:update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update shipment details' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateShipmentSchema)) body: UpdateShipmentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentSummary> {
    return this.shipments.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('shipment:stage')
  @Post(':id/stage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a manual, one-tap stage change' })
  updateStage(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateStageSchema)) body: UpdateStageInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentSummary> {
    return this.shipments.updateStage(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('shipment:update')
  @Post(':id/assign-driver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a tenant driver to a shipment' })
  assignDriver(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(assignDriverSchema)) body: AssignDriverInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentSummary> {
    return this.shipments.assignDriver(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('shipment:checkin')
  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Record a manual border check-in on the shipment assigned to the driver',
  })
  checkIn(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(checkInSchema)) body: CheckInInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ShipmentEventSummary> {
    return this.shipments.checkIn(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('shipment:read')
  @Get(':id/events')
  @ApiOperation({ summary: 'List the append-only stage timeline for a shipment' })
  listEvents(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentEventSummary[]> {
    return this.shipments.listEvents(user.tenantId, id, {
      role: user.role,
      userId: user.userId,
    });
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
