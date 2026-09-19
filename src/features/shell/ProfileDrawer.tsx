import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  CurrentMemberSchema,
  UpdateCurrentMemberRequestSchema,
  type CurrentMember,
} from '../../../shared/contracts/member';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { initialsFor } from './member-display';
import { useShellStore } from './shell-store';

function roleLabel(member: CurrentMember) {
  return member.workspaceRole === 'ADMINISTRATOR' ? 'Administrator' : 'Member';
}

export function ProfileDrawer({ member }: { member: CurrentMember }) {
  const open = useShellStore((state) => state.profileOpen);
  const setOpen = useShellStore((state) => state.setProfileOpen);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [fullName, setFullName] = useState(member.fullName);
  const [position, setPosition] = useState(member.position ?? '');
  const [photoPath, setPhotoPath] = useState<string | null>(
    member.profileImagePath,
  );

  useEffect(() => {
    if (!open) return;
    setFullName(member.fullName);
    setPosition(member.position ?? '');
    setPhotoPath(member.profileImagePath);
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
  }, [member, open, setOpen]);

  const updateProfile = useMutation({
    mutationFn: () => {
      const request = UpdateCurrentMemberRequestSchema.parse({
        fullName,
        position: position.trim() || null,
        profileImagePath: photoPath,
      });

      return apiFetch('/me', CurrentMemberSchema, {
        accessToken: auth.session?.access_token,
        method: 'PATCH',
        body: request,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ['current-member', auth.session?.user.id],
        updated,
      );
      setOpen(false);
    },
  });

  if (!open) return null;

  const normalizedName = fullName.trim();
  const normalizedPosition = position.trim();
  const hasChanges =
    normalizedName !== member.fullName ||
    normalizedPosition !== (member.position ?? '') ||
    photoPath !== member.profileImagePath;
  const previewMember: CurrentMember = {
    ...member,
    fullName: normalizedName || member.fullName,
    position: normalizedPosition || null,
    profileImagePath: photoPath,
  };

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !updateProfile.isPending) {
          setOpen(false);
        }
      }}
    >
      <aside
        className="profile-drawer profile-settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <header className="profile-settings-header">
          <div>
            <p className="profile-settings-eyebrow">ACCOUNT</p>
            <h2 id="profile-title">Profile settings</h2>
            <p>Update how your profile appears across Prometheus.</p>
          </div>
          <button
            ref={closeRef}
            className="drawer-close"
            type="button"
            aria-label="Close profile settings"
            onClick={() => setOpen(false)}
            disabled={updateProfile.isPending}
          >
            ×
          </button>
        </header>

        <form
          className="profile-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            updateProfile.mutate();
          }}
        >
          <div className="profile-settings-scroll">
            <section className="profile-photo-row">
              <Avatar member={previewMember} large />
              <div className="profile-photo-copy">
                <strong>Profile picture</strong>
                <p>JPG, PNG, or WebP. The image is cropped to a square.</p>
                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="profile-photo-change"
                    disabled
                    title="Profile photo uploads are not connected yet."
                  >
                    Change photo
                  </button>
                  <button
                    type="button"
                    className="profile-photo-remove"
                    disabled={!photoPath || updateProfile.isPending}
                    onClick={() => setPhotoPath(null)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </section>

            <div className="profile-settings-divider" />

            <div className="profile-settings-grid">
              <label className="profile-settings-field profile-field-wide">
                <span>Full name</span>
                <input
                  autoComplete="name"
                  value={fullName}
                  maxLength={120}
                  onChange={(event) => setFullName(event.target.value)}
                  aria-invalid={!normalizedName}
                />
              </label>

              <label className="profile-settings-field profile-field-wide">
                <span>
                  Email address
                  <small>Managed by your organization</small>
                </span>
                <span className="profile-managed-input">
                  <input value={member.email} readOnly aria-readonly="true" />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              </label>

              <label className="profile-settings-field">
                <span>Job title</span>
                <input
                  value={position}
                  maxLength={120}
                  placeholder="e.g. Software Engineer"
                  onChange={(event) => setPosition(event.target.value)}
                />
              </label>

              <label className="profile-settings-field">
                <span>Phone number</span>
                <input
                  value=""
                  placeholder="Optional"
                  readOnly
                  aria-readonly="true"
                  title="Phone numbers are not stored by Prometheus yet."
                />
              </label>

              <label className="profile-settings-field">
                <span>
                  Department
                  <small>Organization-managed</small>
                </span>
                <input
                  value={member.department.name}
                  readOnly
                  aria-readonly="true"
                />
              </label>

              <label className="profile-settings-field">
                <span>
                  Access role
                  <small>Organization-managed</small>
                </span>
                <input
                  value={roleLabel(member)}
                  readOnly
                  aria-readonly="true"
                />
              </label>

              <label className="profile-settings-field">
                <span>Time zone</span>
                <select value="Asia/Manila" disabled aria-label="Time zone">
                  <option value="Asia/Manila">Asia/Manila</option>
                </select>
              </label>

              <label className="profile-settings-field profile-field-wide profile-about-field">
                <span>About</span>
                <textarea
                  value=""
                  placeholder="A short description about you"
                  readOnly
                  aria-readonly="true"
                  maxLength={240}
                  title="Profile biographies are not stored by Prometheus yet."
                />
                <small className="profile-character-count">0/240</small>
              </label>
            </div>

            {updateProfile.isError && (
              <p className="profile-form-error" role="alert">
                {updateProfile.error.message}
              </p>
            )}

            <div className="profile-settings-divider" />

            <section className="signout-panel profile-session-panel">
              <div>
                <span>SESSION</span>
                <strong>Sign out of Prometheus</strong>
                <p>
                  End your session on this device. Your saved profile remains
                  available when you sign back in.
                </p>
                <small>{member.email}</small>
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

          <footer className="profile-settings-footer">
            <button
              type="button"
              className="profile-cancel-button"
              onClick={() => setOpen(false)}
              disabled={updateProfile.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="profile-save-button"
              disabled={
                updateProfile.isPending || !hasChanges || !normalizedName
              }
            >
              {updateProfile.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </footer>
        </form>
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
