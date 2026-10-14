import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, RequirePermissions } from '../policy/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { RequestMeta } from '../auth/auth.service';
import { DocumentsService } from './documents.service';
import {
  createDocumentSchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type DocumentFileSummary,
  type DocumentSummary,
  type ShipmentDocumentsView,
  type UpdateDocumentInput,
  type UploadedFile as UploadedFileInput,
} from './documents.dto';

const uuidParam = new ZodValidationPipe(z.string().uuid());

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermissions('document:read')
  @Get('shipments/:shipmentId/documents')
  @ApiOperation({ summary: "List a shipment's documents, checklist and missing items" })
  list(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShipmentDocumentsView> {
    return this.documents.listForShipment(user.tenantId, shipmentId);
  }

  @RequirePermissions('document:write')
  @Post('shipments/:shipmentId/documents')
  @ApiOperation({ summary: 'Add a document to a shipment' })
  create(
    @Param('shipmentId', uuidParam) shipmentId: string,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<DocumentSummary> {
    return this.documents.create(user.tenantId, user.userId, shipmentId, body, metaOf(req));
  }

  @RequirePermissions('document:write')
  @Patch('documents/:id')
  @ApiOperation({ summary: 'Update a document (status, label, notes)' })
  update(
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: UpdateDocumentInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<DocumentSummary> {
    return this.documents.update(user.tenantId, user.userId, id, body, metaOf(req));
  }

  @RequirePermissions('document:write')
  @Delete('documents/:id')
  @ApiOperation({ summary: 'Delete a document and its files' })
  remove(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    return this.documents.remove(user.tenantId, user.userId, id, metaOf(req));
  }

  @RequirePermissions('file:create')
  @Post('documents/:id/files')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to a document (private object storage)' })
  upload(
    @Param('id', uuidParam) id: string,
    @UploadedFile() file: UploadedFileInput | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<DocumentFileSummary> {
    return this.documents.addFile(user.tenantId, user.userId, id, file, metaOf(req));
  }

  @RequirePermissions('file:read')
  @Get('files/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Download a file after authorization (never public)' })
  async download(
    @Param('id', uuidParam) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const opened = await this.documents.openFile(user.tenantId, id);

    if (opened.url) {
      res.redirect(HttpStatus.FOUND, opened.url);
      return;
    }

    res.setHeader('Content-Type', opened.object?.contentType ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDisposition(opened.fileName));
    if (opened.object?.contentLength !== undefined) {
      res.setHeader('Content-Length', String(opened.object.contentLength));
    }
    opened.object?.body.pipe(res);
  }
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function metaOf(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
