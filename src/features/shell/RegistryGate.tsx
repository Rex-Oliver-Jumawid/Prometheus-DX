import { useQuery } from '@tanstack/react-query';
import { RegistryAccessResponseSchema } from '../../../shared/contracts/member';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { PlaceholderPage } from './PlaceholderPage';

export function RegistryGate() {
  const { member, session } = useAuth();
  const access = useQuery({
    queryKey: ['registry-access'],
    enabled: member?.workspaceRole === 'ADMINISTRATOR',
    queryFn: ({ signal }) =>
      apiFetch('/registry/access', RegistryAccessResponseSchema, {
        accessToken: session?.access_token,
        signal,
      }),
    retry: false,
  });
  if (member?.workspaceRole !== 'ADMINISTRATOR') {
    return (
      <section className="placeholder-page">
        <p className="page-kicker">ACCESS DENIED</p>
        <h1>Registry is for administrators</h1>
        <div className="placeholder-card">
          <div>
            <p>
              Your account does not have permission to open Registry. No
              Registry request or data was loaded.
            </p>
          </div>
        </div>
      </section>
    );
  }
  if (access.isPending)
    return (
      <section className="placeholder-page" aria-busy="true">
        <p className="page-kicker">REGISTRY</p>
        <h1>Checking administrator access…</h1>
      </section>
    );
  if (access.isError)
    return (
      <section className="placeholder-page">
        <p className="page-kicker">REGISTRY</p>
        <h1>Registry access unavailable</h1>
        <div className="placeholder-card">
          <div>
            <p>
              The server did not authorize this request. No Registry data was
              loaded.
            </p>
            <button
              className="secondary-button compact"
              onClick={() => void access.refetch()}
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  return <PlaceholderPage title="Registry" />;
}
