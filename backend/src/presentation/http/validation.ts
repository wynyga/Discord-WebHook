import type { z } from 'zod';
import { ValidationError } from '../../domain/errors.js';

export interface FieldIssue {
  path: string;
  message: string;
}

/** Parses request input; on failure throws `ValidationError` with one entry per invalid field. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues: FieldIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  throw new ValidationError('Request validation failed', issues);
}
