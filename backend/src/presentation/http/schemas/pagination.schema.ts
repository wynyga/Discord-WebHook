import { z } from 'zod';
import { PAGINATION } from '../../../domain/pagination.js';

/** Query-string paging, shared by every list endpoint. */
export const pageQueryShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.maxPageSize).default(PAGINATION.defaultPageSize),
};
