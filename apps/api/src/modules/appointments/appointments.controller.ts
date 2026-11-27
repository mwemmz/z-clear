import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import {
  appointAgentSchema,
  createAgentProfileSchema,
  type AgentDirectoryEntry,
  type AgentProfileView,
  type AppointAgentInput,
  type AppointmentResult,
  type CreateAgentProfileInput,
} from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@Controller()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @RequirePermissions('agent_directory:read')
  @Get('agent-profiles')
  @ApiOperation({
    summary: 'List the curated published agent directory (licence status simulated)',
  })
  listDirectory(): Promise<AgentDirectoryEntry[]> {
    return this.appointments.listDirectory();
  }

  @RequirePermissions('agent_profile:manage')
  @Post('agent-profiles/me')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Publish or update the signed-in agent’s directory card' })
  upsertProfile(
    @Body(new ZodValidationPipe(createAgentProfileSchema)) body: CreateAgentProfileInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<AgentProfileView> {
    return this.appointments.upsertProfile(user.tenantId, user.userId, body, metaOf(req));
  }

  @RequirePermissions('case:appoint')
  @Post('appointments')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Appoint an agent and consent to transferring the case' })
  appoint(
    @Body(new ZodValidationPipe(appointAgentSchema)) body: AppointAgentInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppointmentResult> {
    return this.appointments.appoint(user.tenantId, user.userId, body);
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
