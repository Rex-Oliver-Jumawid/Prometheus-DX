import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('ApiRequestMetrics');
const SLOW_REQUEST_MS = 1_000;

/** Never log queries, request bodies, bearer tokens, IPs, or raw dynamic URLs. */
export function safeRoute(request: Request): string {
  const route = request.route?.path;
  if (typeof route === 'string') return (request.baseUrl + route).slice(0, 160);
  return request.path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d{3,}/g, '/:id')
    .slice(0, 160);
}

export function requestMetrics(request: Request, response: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  const requestId = randomUUID();
  response.setHeader('X-Request-ID', requestId);
  response.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_000);
    if (durationMs < SLOW_REQUEST_MS && response.statusCode < 500) return;
    logger.warn(JSON.stringify({
      event: 'api_request', requestId,
      method: request.method, route: safeRoute(request),
      status: response.statusCode, durationMs,
    }));
  });
  next();
}
