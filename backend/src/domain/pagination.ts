export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const PAGINATION = { defaultPageSize: 20, maxPageSize: 100 } as const;
