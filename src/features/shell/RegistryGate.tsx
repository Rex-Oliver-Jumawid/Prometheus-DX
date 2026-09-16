import { useAuth } from '../auth/auth-context';
import { RegistryPage } from '../registry/RegistryPage';

export function RegistryGate() {
  const { member, session } = useAuth();

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

  return <RegistryPage accessToken={session?.access_token} />;
}
