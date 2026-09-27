import { Navigate } from 'react-router-dom';
import { AuthLoading } from '../auth/AuthGate';
import { useAuth } from '../auth/auth-context';
import { resolveProtectedState } from '../auth/auth-routing';
import { LandingPage } from './LandingPage';

/** The root is session-aware, whereas /landing can always be viewed explicitly. */
export function LandingEntry() {
  const { session, member, memberPending, memberError } = useAuth();
  const state = resolveProtectedState({
    sessionResolved: session !== undefined,
    hasSession: Boolean(session),
    memberPending,
    hasMember: Boolean(member),
    error: memberError,
  });

  if (state === 'loading') return <AuthLoading label="Opening Prometheus…" />;
  if (state === 'authorized') return <Navigate replace to="/workspace" />;
  if (state === 'denied') return <Navigate replace to="/access-denied" />;
  // Let the protected workspace show its existing verification retry screen.
  if (state === 'error') return <Navigate replace to="/workspace" />;

  return <LandingPage />;
}
