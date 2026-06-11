import { Request } from "express";

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export function getPagination(req: Request): PaginationParams {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 20)));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationParams
) {
  return {
    data,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize) || 1,
    },
  };
}
