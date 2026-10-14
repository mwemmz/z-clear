import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from '../errors/api-error';

/**
 * Validates and parses request input with zod. Unknown fields are stripped by
 * default schemas; use `.strict()` on a schema to reject them explicitly.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw ApiError.validation(
        'Validation failed',
        result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          issue: issue.message,
        })),
      );
    }
    return result.data;
  }
}
