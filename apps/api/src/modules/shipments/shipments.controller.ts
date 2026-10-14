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
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { ShipmentsService } from './shipments.service';
import {
  createShipmentSchema,
  listShipmentsSchema,
  updateShipmentSchema,
  updateStageSchema,
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
    return this.shipments.list(user.tenantId, query);
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
    return this.shipments.get(user.tenantId, id);
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

  @RequirePermissions('shipment:read')
  @Get(':id/events')
  @ApiOperation({ summary: 'List the append-only stage timeline for a shipment' })
  listEvents(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentEventSummary[]> {
    return this.shipments.listEvents(user.tenantId, id);
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
