import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createNestApplication } from '../server/bootstrap';

type NodeRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

type VercelRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

type NestApplicationFactory = () => Promise<INestApplication>;

async function initializeRequestHandler(
  createApplication: NestApplicationFactory,
): Promise<NodeRequestHandler> {
  const app = await createApplication();
  await app.init();
  return app.getHttpAdapter().getInstance() as NodeRequestHandler;
}

export function createVercelRequestHandler(
  createApplication: NestApplicationFactory = createNestApplication,
): VercelRequestHandler {
  let requestHandlerPromise: Promise<NodeRequestHandler> | undefined;

  return async (request, response): Promise<void> => {
    requestHandlerPromise ??= initializeRequestHandler(createApplication);
    const requestHandler = await requestHandlerPromise;
    requestHandler(request, response);
  };
}

export default createVercelRequestHandler();
