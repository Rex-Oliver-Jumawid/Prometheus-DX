import type { ApiRequestError } from '../../lib/api';

export type ProtectedResolution =
  'loading' | 'login' | 'denied' | 'authorized' | 'error';

export function resolveProtectedState(input: {
  sessionResolved: boolean;
  hasSession: boolean;
  memberPending: boolean;
  hasMember: boolean;
  error: Error | null;
}): ProtectedResolution {
  if (!input.sessionResolved || (input.hasSession && input.memberPending))
    return 'loading';
  if (!input.hasSession) return 'login';
  if (input.hasMember) return 'authorized';
  const status = (input.error as ApiRequestError | null)?.statusCode;
  if (status === 401) return 'login';
  if (status === 403) return 'denied';
  return 'error';
}

export function storedSessionIsInvalid(input: {
  hasUser: boolean;
  hasError: boolean;
  errorStatus?: number;
}): boolean {
  if (input.hasUser) return false;
  if (!input.hasError) return true;
  return (
    input.errorStatus === 400 ||
    input.errorStatus === 401 ||
    input.errorStatus === 403
  );
}

export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : '/';
}
