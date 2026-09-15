import type { ZodType } from 'zod';
import { ApiErrorResponseSchema, type ApiErrorResponse } from '../../shared/contracts/api-error';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(path: string, schema: ZodType<T>): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
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
