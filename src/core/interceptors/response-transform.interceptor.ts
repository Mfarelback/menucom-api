import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OffsetPaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

export type PaginationInfo =
  | {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  | {
      total: number;
      offset: number;
      limit: number;
      hasMore: boolean;
    };

export interface WrappedResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  pagination?: PaginationInfo;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, any>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Saltar transform si el endpoint tiene @SkipResponseTransform()
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTransform) {
      return next.handle();
    }

    const statusCode =
      this.reflector.get<HttpStatus>(
        '__customHttpCode__',
        context.getHandler(),
      ) ?? HttpStatus.OK;

    return next.handle().pipe(
      map((responseData) => {
        if (this.isPaginatedResult(responseData)) {
          const { data, total, page, limit } = responseData;
          const totalPages = Math.ceil(total / limit);
          return {
            statusCode,
            message: 'OK',
            data,
            pagination: {
              page,
              limit,
              total,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
            },
          };
        }

        if (this.isOffsetPaginatedResult(responseData)) {
          const { items, pagination } = responseData;
          return {
            statusCode,
            message: 'OK',
            data: items,
            pagination,
          };
        }

        return {
          statusCode,
          message: 'OK',
          data: responseData,
        };
      }),
    );
  }

  private isPaginatedResult(value: any): value is PaginatedResult<unknown> {
    return (
      value &&
      typeof value === 'object' &&
      Array.isArray(value.data) &&
      typeof value.total === 'number' &&
      typeof value.page === 'number' &&
      typeof value.limit === 'number'
    );
  }

  private isOffsetPaginatedResult(
    value: any,
  ): value is OffsetPaginatedResult<unknown> {
    if (!value || typeof value !== 'object') return false;
    if (!Array.isArray(value.items)) return false;
    const p = value.pagination;
    return (
      p &&
      typeof p === 'object' &&
      typeof p.total === 'number' &&
      typeof p.offset === 'number' &&
      typeof p.limit === 'number' &&
      typeof p.hasMore === 'boolean'
    );
  }
}
