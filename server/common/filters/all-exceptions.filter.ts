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

    const message =
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      'message' in rawResponse
        ? Array.isArray(rawResponse.message)
          ? rawResponse.message.join(', ')
          : String(rawResponse.message)
        : exception instanceof Error && statusCode < 500
          ? exception.message
          : 'An unexpected server error occurred.';

    const body: ApiErrorResponse = {
      statusCode,
      message,
      error: statusCode >= 500 ? 'Server Error' : 'Request Error',
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(body);
  }
}
