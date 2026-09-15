import type { ZodType } from 'zod';
import {
  ApiErrorResponseSchema,
  type ApiErrorResponse,
} from '../../shared/contracts/api-error';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/$/,
  '',
);

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiFetchOptions = {
  accessToken?: string;
  signal?: AbortSignal;
  method?: ApiMethod;
  body?: unknown;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(
  path: string,
  schema: ZodType<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  let response: Response;
  const hasBody = options.body !== undefined;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiRequestError('The API could not be reached.');
  }

  if (!response.ok) {
    let apiError: ApiErrorResponse | undefined;

    try {
      const payload: unknown = await response.json();
      const parsed = ApiErrorResponseSchema.safeParse(payload);
      apiError = parsed.success ? parsed.data : undefined;
    } catch {
      apiError = undefined;
    }

    throw new ApiRequestError(
      apiError?.message ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  const payload: unknown = await response.json();
  return schema.parse(payload);
}
