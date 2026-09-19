import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createVercelRequestHandler } from '../api/index';

describe('createVercelRequestHandler', () => {
  it('initializes Nest once and forwards requests without changing them', async () => {
    const nodeHandler = vi.fn();
    const init = vi.fn().mockResolvedValue(undefined);
    const getInstance = vi.fn(() => nodeHandler);
    const createApplication = vi.fn(async () => {
      return {
        init,
        getHttpAdapter: () => ({ getInstance }),
      } as unknown as INestApplication;
    });
    const handler = createVercelRequestHandler(createApplication);
    const firstRequest = {
      method: 'GET',
      url: '/api/me?include=department',
    } as IncomingMessage;
    const firstResponse = {} as ServerResponse;
    const secondRequest = {
      method: 'PATCH',
      url: '/api/projects/123/outcomes/456?view=details',
    } as IncomingMessage;
    const secondResponse = {} as ServerResponse;

    await Promise.all([
      handler(firstRequest, firstResponse),
      handler(secondRequest, secondResponse),
    ]);

    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(getInstance).toHaveBeenCalledTimes(1);
    expect(nodeHandler).toHaveBeenNthCalledWith(1, firstRequest, firstResponse);
    expect(nodeHandler).toHaveBeenNthCalledWith(
      2,
      secondRequest,
      secondResponse,
    );
    expect(firstRequest.url).toBe('/api/me?include=department');
    expect(secondRequest.url).toBe(
      '/api/projects/123/outcomes/456?view=details',
    );
  });
});
