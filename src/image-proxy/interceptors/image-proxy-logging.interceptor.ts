import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class ImageProxyLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ImageProxyLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const referer = headers['referer'] || '';
    const clientIp = request.ip || request.connection.remoteAddress;

    this.logger.log(
      `Incoming request: ${method} ${url} from ${clientIp} - ${userAgent}`,
    );

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;
        const contentLength = response.get('content-length') || 0;

        this.logger.log(
          `Request completed: ${method} ${url} - ${statusCode} - ${responseTime}ms - ${contentLength} bytes`,
        );

        // Aquí puedes agregar métricas personalizadas
        this.recordMetrics({
          method,
          url,
          statusCode,
          responseTime,
          contentLength: parseInt(contentLength, 10),
          userAgent,
          referer,
          clientIp,
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;

        this.logger.error(
          `Request failed: ${method} ${url} - ${error.status || 500} - ${responseTime}ms - ${error.message}`,
        );

        // Registrar métricas de error
        this.recordErrorMetrics({
          method,
          url,
          error: error.message,
          statusCode: error.status || 500,
          responseTime,
          clientIp,
        });

        return throwError(() => error);
      }),
    );
  }

  private recordMetrics(metrics: {
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    contentLength: number;
    userAgent: string;
    referer: string;
    clientIp: string;
  }): void {
    // Aquí puedes integrar con sistemas de métricas como Prometheus, StatsD, etc.
    // Por ejemplo:
    // this.metricsService.incrementCounter('image_proxy_requests_total', {
    //   method: metrics.method,
    //   status_code: metrics.statusCode.toString()
    // });
    // this.metricsService.recordHistogram('image_proxy_response_time_seconds', metrics.responseTime / 1000);

    this.logger.debug(`Metrics recorded: ${JSON.stringify(metrics)}`);
  }

  private recordErrorMetrics(errorMetrics: {
    method: string;
    url: string;
    error: string;
    statusCode: number;
    responseTime: number;
    clientIp: string;
  }): void {
    // Registrar métricas específicas de errores
    this.logger.debug(
      `Error metrics recorded: ${JSON.stringify(errorMetrics)}`,
    );
  }
}
