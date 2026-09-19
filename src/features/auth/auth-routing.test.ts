import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../lib/api';
import {
  resolveProtectedState,
  safeReturnPath,
  storedSessionIsInvalid,
} from './auth-routing';

describe('protected auth resolution', () => {
  it('never treats an authorization API failure as authorized', () => {
    expect(
      resolveProtectedState({
        sessionResolved: true,
        hasSession: true,
        memberPending: false,
        hasMember: false,
        error: new ApiRequestError('offline'),
      }),
    ).toBe('error');
  });

  it('separates signed out, unauthenticated, and workspace-denied states', () => {
    expect(
      resolveProtectedState({
        sessionResolved: true,
        hasSession: false,
        memberPending: false,
        hasMember: false,
        error: null,
      }),
    ).toBe('login');
    expect(
      resolveProtectedState({
        sessionResolved: true,
        hasSession: true,
        memberPending: false,
        hasMember: false,
        error: new ApiRequestError('denied', 403),
      }),
    ).toBe('denied');
    expect(
      resolveProtectedState({
        sessionResolved: false,
        hasSession: false,
        memberPending: false,
        hasMember: false,
        error: null,
      }),
    ).toBe('loading');
  });

  it('discards only definitively invalid stored sessions', () => {
    expect(
      storedSessionIsInvalid({
        hasUser: false,
        hasError: false,
      }),
    ).toBe(true);
    expect(
      storedSessionIsInvalid({
        hasUser: false,
        hasError: true,
        errorStatus: 401,
      }),
    ).toBe(true);
    expect(
      storedSessionIsInvalid({
        hasUser: false,
        hasError: true,
        errorStatus: 403,
      }),
    ).toBe(true);
    expect(
      storedSessionIsInvalid({
        hasUser: false,
        hasError: true,
      }),
    ).toBe(false);
    expect(
      storedSessionIsInvalid({
        hasUser: true,
        hasError: true,
        errorStatus: 500,
      }),
    ).toBe(false);
  });

  it('rejects external return destinations', () => {
    expect(safeReturnPath('//malicious.example')).toBe('/');
    expect(safeReturnPath('/projects')).toBe('/projects');
  });
});
