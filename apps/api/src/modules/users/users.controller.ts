import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { UsersService } from './users.service';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserSummary,
} from './users.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions('user:read')
  @Get()
  @ApiOperation({ summary: 'List users in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<UserSummary[]> {
    return this.users.list(user.tenantId);
  }

  @RequirePermissions('user:create')
  @Post()
  @ApiOperation({ summary: 'Create a user in the current tenant' })
  create(
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserSummary> {
    return this.users.create(user.tenantId, user.userId, body, metaOf(req));
  }

  @RequirePermissions('user:update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user in the current tenant' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserSummary> {
    return this.users.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('user:delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user in the current tenant' })
  remove(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.users.remove(user.tenantId, user.userId, id, metaOf(req));
  }
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
