import { ArgumentsHost, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverEnvironment } from '../../config/env';
import { AllExceptionsFilter } from './all-exceptions.filter';

const savedMode = serverEnvironment.nodeEnv;
afterEach(() => {
  serverEnvironment.nodeEnv = savedMode;
  vi.restoreAllMocks();
});

describe('AllExceptionsFilter production privacy', () => {
  it('correlates 500s with a request ID but does not log sensitive exception details', () => {
    serverEnvironment.nodeEnv = 'production';
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const response = {
      getHeader: vi.fn().mockReturnValue('server-assigned-request-id'),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const request = {
      method: 'GET',
      originalUrl: '/api/projects/123?secret=do-not-log',
      path: '/api/projects/123',
      baseUrl: '/api',
      route: { path: '/projects/:projectId' },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(new Error('private-database-token'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/projects/:projectId',
      message: 'An unexpected server error occurred.',
    }));
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('server-assigned-request-id');
    expect(logged).not.toContain('private-database-token');
    expect(logged).not.toContain('do-not-log');
  });
});
