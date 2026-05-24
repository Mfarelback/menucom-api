import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Reflector } from '@nestjs/core';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface WrappedResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, any>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
}
