import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { resolveProtectedState } from './auth-routing';

export function AuthLoading({
  label = 'Opening Prometheus…',
}: {
  label?: string;
}) {
  return (
    <main className="auth-status-page" aria-busy="true">
      <img src="/auth/prometheus-mark.png" alt="" />
      <span className="spinner dark" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

function PublicLandingRedirect() {
  useEffect(() => {
    // This is a standalone HTML document, not a React Router route.
    window.location.replace('/landing-page.html');
  }, []);

  return <AuthLoading label="Opening Prometheus…" />;
}

export function AuthGate() {
  const auth = useAuth();
  const location = useLocation();
  const state = resolveProtectedState({
    sessionResolved: auth.session !== undefined,
    hasSession: Boolean(auth.session),
    memberPending: auth.memberPending,
    hasMember: Boolean(auth.member),
    error: auth.memberError,
  });

  if (state === 'loading') return <AuthLoading />;
  if (state === 'login') {
    // Keep deep links going to sign-in, but show the landing page to visitors.
    if (location.pathname === '/' && !location.search) {
      return <PublicLandingRedirect />;
    }
    return (
      <Navigate
        replace
        to="/login"
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  }
  if (state === 'denied') return <Navigate replace to="/access-denied" />;
  if (state === 'authorized') return <Outlet />;

  return (
    <main className="auth-status-page">
      <img src="/auth/prometheus-mark.png" alt="" />
      <h1>We couldn’t verify workspace access</h1>
      <p>
        No protected information has been loaded. Check your connection and try
        again.
      </p>
      <div className="status-actions">
        <button
          className="primary-button compact"
          type="button"
          onClick={auth.retryAuthorization}
        >
          Try again
        </button>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => void auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
