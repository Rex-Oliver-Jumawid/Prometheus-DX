import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  CurrentMemberSchema,
  UpdateCurrentMemberRequestSchema,
  type CurrentMember,
} from '../../../shared/contracts/member';
import { apiFetch } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from '../auth/auth-context';
import { initialsFor } from './member-display';
import { useShellStore } from './shell-store';

const PROFILE_IMAGE_BUCKET = 'profile-images';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function roleLabel(member: CurrentMember) {
  return member.workspaceRole === 'ADMINISTRATOR' ? 'Administrator' : 'Member';
}

function profileImageExtension(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function profileImageObjectPath(value: string | null) {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;

  const encodedPath = value.slice(markerIndex + marker.length).split('?')[0];
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

function validateProfilePhoto(file: File) {
  if (!PROFILE_IMAGE_TYPES.has(file.type)) {
    return 'Choose a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    return 'Profile pictures must be 5 MB or smaller.';
  }
  return null;
}

export function ProfileDrawer({ member }: { member: CurrentMember }) {
  const open = useShellStore((state) => state.profileOpen);
  const setOpen = useShellStore((state) => state.setProfileOpen);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(member.fullName);
  const [nickname, setNickname] = useState(member.nickname ?? '');
  const [position, setPosition] = useState(member.position ?? '');
  const [phoneNumber, setPhoneNumber] = useState(member.phoneNumber ?? '');
  const [about, setAbout] = useState(member.about ?? '');
  const [photoPath, setPhotoPath] = useState<string | null>(
    member.profileImagePath,
  );
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFullName(member.fullName);
    setNickname(member.nickname ?? '');
    setPosition(member.position ?? '');
    setPhoneNumber(member.phoneNumber ?? '');
    setAbout(member.about ?? '');
    setPhotoPath(member.profileImagePath);
    setPendingPhoto(null);
    setPhotoPreviewUrl(null);
    setPhotoError('');
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

  useEffect(
    () => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    },
    [photoPreviewUrl],
  );

  const updateProfile = useMutation({
    mutationFn: async () => {
      const client = getSupabaseClient();
      const userId = auth.session?.user.id;
      let uploadedObjectPath: string | null = null;
      let nextPhotoPath = photoPath;

      try {
        if (pendingPhoto) {
          if (!client || !userId) {
            throw new Error('Profile photo upload is not configured.');
          }

          const uploadId =
            globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
          uploadedObjectPath = `${userId}/${uploadId}.${profileImageExtension(
            pendingPhoto,
          )}`;

          const { error: uploadError } = await client.storage
            .from(PROFILE_IMAGE_BUCKET)
            .upload(uploadedObjectPath, pendingPhoto, {
              cacheControl: '3600',
              contentType: pendingPhoto.type,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Profile photo upload failed: ${uploadError.message}`);
          }

          const { data } = client.storage
            .from(PROFILE_IMAGE_BUCKET)
            .getPublicUrl(uploadedObjectPath);
          nextPhotoPath = data.publicUrl;
        }

        const request = UpdateCurrentMemberRequestSchema.parse({
          fullName,
          nickname: nickname.trim() || null,
          position: position.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
          about: about.trim() || null,
          profileImagePath: nextPhotoPath,
        });

        const updated = await apiFetch('/me', CurrentMemberSchema, {
          accessToken: auth.session?.access_token,
          method: 'PATCH',
          body: request,
        });

        const previousObjectPath = profileImageObjectPath(
          member.profileImagePath,
        );
        if (
          client &&
          previousObjectPath &&
          updated.profileImagePath !== member.profileImagePath
        ) {
          try {
            await client.storage
              .from(PROFILE_IMAGE_BUCKET)
              .remove([previousObjectPath]);
          } catch {
            // The profile update already succeeded. Old avatar cleanup is
            // best-effort and must not roll back the newly persisted image.
          }
        }

        return updated;
      } catch (error) {
        if (client && uploadedObjectPath) {
          try {
            await client.storage
              .from(PROFILE_IMAGE_BUCKET)
              .remove([uploadedObjectPath]);
          } catch {
            // Preserve the original profile error if orphan cleanup also fails.
          }
        }
        throw error;
      }
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
  const normalizedNickname = nickname.trim();
  const normalizedPosition = position.trim();
  const normalizedPhoneNumber = phoneNumber.trim();
  const normalizedAbout = about.trim();
  const hasChanges =
    normalizedName !== member.fullName ||
    normalizedNickname !== (member.nickname ?? '') ||
    normalizedPosition !== (member.position ?? '') ||
    normalizedPhoneNumber !== (member.phoneNumber ?? '') ||
    normalizedAbout !== (member.about ?? '') ||
    Boolean(pendingPhoto) ||
    photoPath !== member.profileImagePath;
  const previewMember: CurrentMember = {
    ...member,
    fullName: normalizedName || member.fullName,
    nickname: normalizedNickname || null,
    position: normalizedPosition || null,
    phoneNumber: normalizedPhoneNumber || null,
    about: normalizedAbout || null,
    profileImagePath: photoPreviewUrl ?? photoPath,
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
                <input
                  ref={photoInputRef}
                  className="profile-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Profile picture upload"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;

                    const validationError = validateProfilePhoto(file);
                    if (validationError) {
                      setPhotoError(validationError);
                      return;
                    }

                    setPhotoError('');
                    setPendingPhoto(file);
                    setPhotoPreviewUrl(URL.createObjectURL(file));
                  }}
                />
                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="profile-photo-change"
                    disabled={updateProfile.isPending}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Change photo
                  </button>
                  <button
                    type="button"
                    className="profile-photo-remove"
                    disabled={
                      (!photoPath && !pendingPhoto) || updateProfile.isPending
                    }
                    onClick={() => {
                      setPendingPhoto(null);
                      setPhotoPreviewUrl(null);
                      setPhotoPath(null);
                      setPhotoError('');
                    }}
                  >
                    Remove
                  </button>
                </div>
                {photoError ? (
                  <p className="profile-photo-message error" role="alert">
                    {photoError}
                  </p>
                ) : pendingPhoto ? (
                  <p className="profile-photo-message">
                    New photo selected. Save changes to apply it.
                  </p>
                ) : null}
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
                  Nickname
                  <small>Optional shortcut for future references</small>
                </span>
                <input
                  value={nickname}
                  maxLength={40}
                  placeholder="e.g. Oli"
                  onChange={(event) => setNickname(event.target.value)}
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
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  maxLength={32}
                  placeholder="Optional"
                  onChange={(event) => setPhoneNumber(event.target.value)}
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

              <label className="profile-settings-field profile-field-wide profile-about-field">
                <span>About</span>
                <textarea
                  value={about}
                  placeholder="A short description about you"
                  maxLength={240}
                  onChange={(event) => setAbout(event.target.value)}
                />
                <small className="profile-character-count">
                  {about.length}/240
                </small>
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
                updateProfile.isPending ||
                !hasChanges ||
                !normalizedName ||
                Boolean(photoError)
              }
            >
              {updateProfile.isPending
                ? pendingPhoto
                  ? 'Uploading...'
                  : 'Saving...'
                : 'Save changes'}
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
