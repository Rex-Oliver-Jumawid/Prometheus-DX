import { useEffect, useRef } from 'react';
import type { CurrentMember } from '../../../shared/contracts/member';
import { useAuth } from '../auth/auth-context';
import { initialsFor } from './member-display';
import { useShellStore } from './shell-store';

export function ProfileDrawer({ member }: { member: CurrentMember }) {
  const open = useShellStore((state) => state.profileOpen);
  const setOpen = useShellStore((state) => state.setProfileOpen);
  const auth = useAuth();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.body.classList.add('drawer-open');
    return () => {
      document.removeEventListener('keydown', close);
      document.body.classList.remove('drawer-open');
    };
  }, [open, setOpen]);
  if (!open) return null;

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setOpen(false);
      }}
    >
      <aside
        className="profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <header>
          <div>
            <p className="auth-eyebrow">ACCOUNT</p>
            <h2 id="profile-title">Profile</h2>
            <p>Your authenticated Prometheus identity.</p>
          </div>
          <button
            ref={closeRef}
            className="drawer-close"
            type="button"
            aria-label="Close profile"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </header>
        <div className="profile-body">
          <div className="profile-hero">
            <Avatar member={member} large />
            <div>
              <strong>{member.fullName}</strong>
              <span>{member.position || 'Prometheus member'}</span>
            </div>
          </div>
          <dl className="profile-details">
            <div>
              <dt>Email address</dt>
              <dd title={member.email}>{member.email}</dd>
            </div>
            <div>
              <dt>Workspace role</dt>
              <dd>
                {member.workspaceRole === 'ADMINISTRATOR'
                  ? 'Administrator'
                  : 'Member'}
              </dd>
            </div>
            <div>
              <dt>Membership status</dt>
              <dd>
                <span className="active-chip">Active</span>
              </dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                }).format(new Date(member.createdAt))}
              </dd>
            </div>
          </dl>
          <section className="signout-panel">
            <div>
              <span>SESSION</span>
              <strong>Sign out of Prometheus</strong>
              <p>
                End this session and remove protected workspace data from this
                device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void auth.signOut();
              }}
            >
              Sign out
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function Avatar({
  member,
  large = false,
}: {
  member: CurrentMember;
  large?: boolean;
}) {
  const style = member.profileImagePath
    ? { backgroundImage: `url(${member.profileImagePath})` }
    : undefined;
  return (
    <span
      className={`member-avatar${large ? ' large' : ''}${style ? ' has-image' : ''}`}
      style={style}
      aria-hidden="true"
    >
      {initialsFor(member.fullName)}
    </span>
  );
}
