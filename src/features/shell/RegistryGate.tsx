import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { RegistryPage } from '../registry/RegistryPage';
import { VenturesPage } from '../ventures/VenturesPage';
import { venturesQuery } from '../ventures/venture-queries';
import '../registry/registry.css';

export function RegistryGate() {
  const { member, session } = useAuth();
  const [params] = useSearchParams();
  const admin = member?.workspaceRole === 'ADMINISTRATOR';
  const ventures = useQuery({
    ...venturesQuery(member?.id, session?.access_token),
    enabled: Boolean(member && session?.access_token && !admin),
  });
  const manager =
    ventures.data?.some((v) => v.canManage || v.canManageMembers) ?? false;
  if (!admin && ventures.isPending)
    return (
      <section className="placeholder-page" role="status">
        Checking Registry access...
      </section>
    );
  if (!admin && ventures.isError)
    return (
      <section className="placeholder-page" role="alert">
        <h1>Registry access could not be checked</h1>
        <button onClick={() => void ventures.refetch()}>Retry</button>
      </section>
    );
  if (!admin && !manager)
    return (
      <section className="placeholder-page">
        <p className="page-kicker">ACCESS DENIED</p>
        <h1>Registry access required</h1>
        <p>
          Only workspace administrators and members with venture management
          permission can open Registry.
        </p>
      </section>
    );
  const membersTab = admin && params.get('tab') === 'members';
  return (
    <section
      className="registry-page registry-settings"
      aria-labelledby="registry-title"
    >
      <header className="registry-page-header">
        <div>
          <p className="registry-kicker">WORKSPACE REGISTRY</p>
          <h1 id="registry-title">Registry</h1>
          <p>
            Configure ventures, memberships, operational roles, and management
            permissions.
          </p>
        </div>
        <div className="registry-access-pill">
          <span aria-hidden="true" />
          {admin ? 'Administrator access' : 'Venture management access'}
        </div>
      </header>
      <nav className="registry-settings-tabs" aria-label="Registry sections">
        <Link to="/registry" aria-current={!membersTab ? 'page' : undefined}>
          Ventures
        </Link>
        {admin && (
          <Link
            to="/registry?tab=members"
            aria-current={membersTab ? 'page' : undefined}
          >
            Workspace members
          </Link>
        )}
      </nav>
      <div className="registry-settings-content">
        {membersTab ? (
          <RegistryPage accessToken={session?.access_token} membersOnly />
        ) : (
          <VenturesPage embedded managementOnly={!admin} />
        )}
      </div>
    </section>
  );
}
