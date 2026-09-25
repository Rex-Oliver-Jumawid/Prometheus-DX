import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '../../../shared/contracts/api-error';
import { safeRoute } from '../middleware/request-metrics';
import { serverEnvironment } from '../../config/env';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    // A deliberately raised HttpException can also contain SQL, provider or
    // authentication details. Do not return any 5xx exception text to clients.
    const message = statusCode >= 500
      ? 'An unexpected server error occurred.'
      : typeof rawResponse === 'object' &&
          rawResponse !== null &&
          'message' in rawResponse
        ? Array.isArray(rawResponse.message)
          ? rawResponse.message.join(', ')
          : String(rawResponse.message)
        : exception instanceof Error
          ? exception.message
          : 'Request failed.';

    const body: ApiErrorResponse = {
      statusCode,
      message,
      error: statusCode >= 500 ? 'Server Error' : 'Request Error',
      timestamp: new Date().toISOString(),
      path: safeRoute(request),
    };

    if (statusCode >= 500) {
      const requestId = String(response.getHeader('X-Request-ID') ?? 'unassigned');
      const errorType = exception instanceof Error ? exception.name : 'UnknownError';
      const label = `${request.method} ${safeRoute(request)} failed (${errorType}, requestId=${requestId})`;
      if (serverEnvironment.nodeEnv === 'production') {
        // Unexpected exception messages/stacks can embed SQL values or credentials.
        this.logger.error(label);
      } else {
        this.logger.error(label, exception instanceof Error ? exception.stack : undefined);
      }
    }

    response.status(statusCode).json(body);
  }
}
