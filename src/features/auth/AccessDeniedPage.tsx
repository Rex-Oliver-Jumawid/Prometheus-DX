import { Navigate } from 'react-router-dom';
import { ApiRequestError } from '../../lib/api';
import { AuthLoading } from './AuthGate';
import { useAuth } from './auth-context';

export function AccessDeniedPage() {
  const auth = useAuth();
  if (auth.session === undefined || (auth.session && auth.memberPending)) return <AuthLoading label="Verifying account…" />;
  if (!auth.session || (auth.memberError instanceof ApiRequestError && auth.memberError.statusCode === 401)) return <Navigate replace to="/login" />;
  if (auth.member) return <Navigate replace to="/" />;

  if (!(auth.memberError instanceof ApiRequestError) || auth.memberError.statusCode !== 403) {
    return (
      <main className="denied-page"><section className="denied-card"><img src="/auth/prometheus-mark.png" alt="" /><p className="auth-eyebrow">WORKSPACE CHECK</p><h1>Access could not be verified</h1><p>Prometheus did not load protected content. Check your connection and try again.</p><div className="status-actions"><button className="primary-button compact" onClick={auth.retryAuthorization}>Try again</button><button className="secondary-button compact" onClick={() => void auth.signOut()}>Sign out</button></div></section></main>
    );
  }

  return (
    <main className="denied-page"><section className="denied-card"><img src="/auth/prometheus-mark.png" alt="" /><p className="auth-eyebrow">ACCESS DENIED</p><h1>This account can’t enter Prometheus</h1><p>Your sign-in succeeded, but this account is not currently authorized for the workspace. Contact your administrator if you believe this is a mistake.</p><button className="primary-button" type="button" onClick={() => void auth.signOut().then(() => location.assign('/login'))}>Sign out and choose another account</button></section></main>
  );
}
