import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateVentureRequestSchema,
  CreateMemberRequestSchema,
  DeleteVentureResponseSchema,
  RemoveMemberResponseSchema,
  RegistryVentureSchema,
  RegistryMemberSchema,
  UpdateMemberRequestSchema,
  type CreateVentureRequest,
  type VentureFormValues,
  type MemberFormValues,
  type RegistryVenture,
  type RegistryMember,
  type RegistryOverviewResponse,
  type UpdateMemberRequest,
} from '../../../shared/contracts/registry';
import { apiFetch } from '../../lib/api';
import { projectCreateOptionsQuery } from '../projects/project-queries';
import { MemberAvatar } from '../shell/MemberAvatar';
import {
  registryOverviewQuery,
  registryOverviewQueryKey,
} from './registry-queries';
import './registry.css';
import './member-name-combobox.css';

type VentureDialogState =
  { mode: 'create' } | { mode: 'edit'; venture: RegistryVenture };

type SaveVentureInput = {
  ventureId?: string;
  request: CreateVentureRequest;
};

type MemberDialogState =
  { mode: 'create' } | { mode: 'edit'; member: RegistryMember };

type SaveMemberInput = {
  memberId?: string;
  request: UpdateMemberRequest;
};

function messageFromError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function sortVentures(
  ventures: RegistryVenture[],
): RegistryVenture[] {
  return [...ventures].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

function withMemberCounts(
  ventures: RegistryVenture[],
  members: RegistryMember[],
): RegistryVenture[] {
  return ventures.map((venture) => ({
    ...venture,
    memberCount: members.filter(
      (member) => (member.ventures?.some(v => v.id === venture.id) || member.ventureId === venture.id),
    ).length,
  }));
}

function VentureDialog({
  state,
  members,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  state: VentureDialogState;
  members: RegistryMember[];
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: CreateVentureRequest) => Promise<void>;
}) {
  const venture = state.mode === 'edit' ? state.venture : undefined;
  const ventureMembers = venture
    ? members.filter((member) => (member.ventures?.some(v => v.id === venture.id) || member.ventureId === venture.id))
    : [];
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
  } = useForm<VentureFormValues>({
    defaultValues: {
      name: venture?.name ?? '',
      shortLabel: venture?.shortLabel ?? '',
      description: venture?.description ?? '',
    },
  });

  useEffect(() => {
    const restoreFocusTo = restoreFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusTo?.focus();
    };
  }, []);

  useEffect(() => {
    reset({
      name: venture?.name ?? '',
      shortLabel: venture?.shortLabel ?? '',
      description: venture?.description ?? '',
    });
    const focusFrame = window.requestAnimationFrame(() => setFocus('name'));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [venture, reset, setFocus]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const submit = handleSubmit(async (values) => {
    clearErrors();
    const parsed = CreateVentureRequestSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'name' ||
          field === 'shortLabel' ||
          field === 'description'
        ) {
          setError(field, { type: 'validate', message: issue.message });
        }
      }
      return;
    }

    try {
      await onSave(parsed.data);
    } catch {
      // The mutation exposes its error state inside the dialog.
    }
  });

  return createPortal(
    <div
      className="registry-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="registry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="venture-dialog-title"
      >
        <header className="registry-dialog-header">
          <div>
            <p className="registry-kicker">
              {state.mode === 'create'
                ? 'NEW ORGANIZATION UNIT'
                : 'ORGANIZATION UNIT'}
            </p>
            <h2 id="venture-dialog-title">
              {state.mode === 'create' ? 'Add venture' : 'Edit venture'}
            </h2>
            <p>Define the organization unit used to group members and work.</p>
          </div>
          <button
            type="button"
            className="registry-icon-button"
            aria-label="Close venture dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </header>

        <form className="registry-form" onSubmit={submit} noValidate>
          <div className="registry-form-row">
            <label className="registry-field">
              <span>Venture name</span>
              <input
                {...register('name')}
                aria-invalid={Boolean(errors.name)}
                autoFocus
                autoComplete="off"
                placeholder="e.g. Finance"
              />
              {errors.name?.message && <small>{errors.name.message}</small>}
            </label>

            <label className="registry-field registry-short-label-field">
              <span>Short label</span>
              <input
                {...register('shortLabel')}
                aria-invalid={Boolean(errors.shortLabel)}
                autoComplete="off"
                maxLength={12}
                placeholder="e.g. FIN"
              />
              {errors.shortLabel?.message && (
                <small>{errors.shortLabel.message}</small>
              )}
            </label>
          </div>

          <label className="registry-field">
            <span>Description</span>
            <input
              {...register('description')}
              aria-invalid={Boolean(errors.description)}
              placeholder="What this venture is responsible for"
            />
            {errors.description?.message && (
              <small>{errors.description.message}</small>
            )}
          </label>

          {state.mode === 'edit' && (
            <section className="registry-edit-members" aria-labelledby="registry-edit-members-title">
              <div className="registry-edit-members-heading">
                <div>
                  <p className="registry-kicker">VENTURE MEMBERS</p>
                  <h3 id="registry-edit-members-title">
                    {ventureMembers.length} {ventureMembers.length === 1 ? 'member' : 'members'}
                  </h3>
                </div>
              </div>
              <div className="registry-edit-members-list">
                {ventureMembers.length ? (
                  ventureMembers.map((member) => (
                    <div className="registry-venture-member" key={member.id}>
                      <MemberAvatar name={member.fullName} profileImagePath={member.profileImagePath} />
                      <div>
                        <strong>{member.fullName}</strong>
                        <small>{member.position ?? 'Member'} · {member.email}</small>
                      </div>
                      <b className={'registry-badge status ' + member.status.toLowerCase()}>
                        {member.status}
                      </b>
                    </div>
                  ))
                ) : (
                  <p className="registry-form-note">No members are assigned to this venture.</p>
                )}
              </div>
            </section>
          )}

          {Boolean(saveError) && (
            <p className="registry-form-error" role="alert">
              {messageFromError(saveError)}
            </p>
          )}

          <footer className="registry-dialog-actions">
            <button
              type="button"
              className="registry-secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="registry-primary-button"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : state.mode === 'create'
                  ? 'Create venture'
                  : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function RemoveVentureDialog({
  venture,
  isRemoving,
  removeError,
  onClose,
  onConfirm,
}: {
  venture: RegistryVenture;
  isRemoving: boolean;
  removeError: unknown;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const restoreFocusTo = restoreFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() =>
      confirmRef.current?.focus(),
    );

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isRemoving) {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled)',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRemoving, onClose]);

  const hasBlockingReferences =
    venture.memberCount > 0 ||
    venture.projectCount > 0 ||
    venture.outcomeCount > 0;

  return createPortal(
    <div
      className="registry-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isRemoving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="registry-dialog registry-remove-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-venture-dialog-title"
      >
        <header className="registry-dialog-header">
          <div>
            <p className="registry-kicker">REMOVE ORGANIZATION UNIT</p>
            <h2 id="remove-venture-dialog-title">Archive venture</h2>
            <p>
              Remove <strong>{venture.name}</strong> from the Registry?
            </p>
          </div>
          <button
            type="button"
            className="registry-icon-button"
            aria-label="Close remove venture dialog"
            onClick={onClose}
            disabled={isRemoving}
          >
            ×
          </button>
        </header>

        <p className="registry-remove-copy">
          Archiving preserves history. These are the references currently attached to this
          venture.
        </p>

        <div
          className="registry-reference-summary"
          aria-label={`References for ${venture.name}`}
        >
          <span className={venture.memberCount > 0 ? 'is-blocking' : ''}>
            <strong>{venture.memberCount}</strong>
            {venture.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className={venture.projectCount > 0 ? 'is-blocking' : ''}>
            <strong>{venture.projectCount}</strong>
            {venture.projectCount === 1 ? 'project' : 'projects'}
          </span>
          <span className={venture.outcomeCount > 0 ? 'is-blocking' : ''}>
            <strong>{venture.outcomeCount}</strong>
            {venture.outcomeCount === 1 ? 'outcome' : 'outcomes'}
          </span>
        </div>

        {hasBlockingReferences && (
          <p className="registry-remove-guidance">
            Non-zero references block deletion. Reassign members and remove the
            venture from the listed projects or outcomes first.
          </p>
        )}

        {Boolean(removeError) && (
          <p className="registry-form-error" role="alert">
            {messageFromError(removeError)}
          </p>
        )}

        <footer className="registry-dialog-actions">
          <button
            type="button"
            className="registry-secondary-button"
            onClick={onClose}
            disabled={isRemoving}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="registry-danger-button"
            onClick={() => void onConfirm()}
            disabled={isRemoving}
          >
            {isRemoving ? 'Removing...' : 'Archive venture'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function MemberDialog({
  state,
  ventures,
  members,
  isSaving,
  saveError,
  onClose,
  onSave,
  onSelectExistingMember,
}: {
  state: MemberDialogState;
  ventures: RegistryVenture[];
  members: RegistryMember[];
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: UpdateMemberRequest) => Promise<void>;
  onSelectExistingMember: (member: RegistryMember) => void;
}) {
  const member = state.mode === 'edit' ? state.member : undefined;
  const defaultVentureId = member?.ventureId ?? '';
  const defaultVentureName =
    ventures.find((venture) => venture.id === defaultVentureId)
      ?.name ?? '';
  const [ventureSearch, setVentureSearch] = useState(
    defaultVentureName,
  );
  const [fullNameSuggestionsOpen, setFullNameSuggestionsOpen] = useState(false);
  const [activeMemberSuggestion, setActiveMemberSuggestion] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<MemberFormValues>({
    defaultValues: {
      fullName: member?.fullName ?? '',
      email: member?.email ?? '',
      ventureId: defaultVentureId,
      position: member?.position ?? '',
      workspaceRole: member?.workspaceRole ?? 'MEMBER',
      status: member?.status ?? 'INVITED',
    },
  });
  const fullName = watch('fullName') ?? '';
  const existingMemberSuggestions = useMemo(() => {
    if (state.mode !== 'create') return [];
    const query = fullName.trim().toLocaleLowerCase();
    return members
      .filter((candidate) => {
        if (!query) return true;
        return (
          candidate.fullName.toLocaleLowerCase().includes(query) ||
          candidate.email.toLocaleLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [fullName, members, state.mode]);
  const fullNameRegistration = register('fullName');

  useEffect(() => {
    const restoreFocusTo = restoreFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusTo?.focus();
    };
  }, []);

  useEffect(() => {
    const nextVentureId = member?.ventureId ?? '';
    const nextVentureName =
      ventures.find((venture) => venture.id === nextVentureId)
        ?.name ?? '';
    reset({
      fullName: member?.fullName ?? '',
      email: member?.email ?? '',
      ventureId: nextVentureId,
      position: member?.position ?? '',
      workspaceRole: member?.workspaceRole ?? 'MEMBER',
      status: member?.status ?? 'INVITED',
    });
    setVentureSearch(nextVentureName);
    setFullNameSuggestionsOpen(false);
    setActiveMemberSuggestion(0);
    const focusFrame = window.requestAnimationFrame(() =>
      dialogRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(focusFrame);
  }, [ventures, member, reset]);

  useEffect(() => {
    setActiveMemberSuggestion(0);
  }, [fullName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        if (fullNameSuggestionsOpen) {
          event.preventDefault();
          setFullNameSuggestionsOpen(false);
          return;
        }

        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullNameSuggestionsOpen, isSaving, onClose]);

  const submit = handleSubmit(async (values) => {
    clearErrors();
    if (ventureSearch.trim() && !values.ventureId) {
      setError('ventureId', { type: 'validate', message: 'Choose a venture.' });
      return;
    }
    const parsed = (
      state.mode === 'create'
        ? CreateMemberRequestSchema
        : UpdateMemberRequestSchema
    ).safeParse({ ...values, ventureId: values.ventureId || null });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'fullName' ||
          field === 'email' ||
          field === 'ventureId' ||
          field === 'position' ||
          field === 'workspaceRole' ||
          field === 'status'
        ) {
          setError(field, { type: 'validate', message: issue.message });
        }
      }
      return;
    }

    try {
      await onSave(parsed.data);
    } catch {
      // The mutation exposes its error state inside the dialog.
    }
  });

  const selectExistingMember = (selectedMember: RegistryMember) => {
    setFullNameSuggestionsOpen(false);
    onSelectExistingMember(selectedMember);
  };

  return createPortal(
    <div
      className="registry-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="registry-dialog registry-member-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-dialog-title"
        tabIndex={-1}
      >
        <header className="registry-dialog-header">
          <div>
            <p className="registry-kicker">AUTHORIZED MEMBER</p>
            <h2 id="member-dialog-title">
              {state.mode === 'create' ? 'Add member' : 'Edit member'}
            </h2>
            <p>Manage organization details and workspace authorization.</p>
          </div>
          <button
            type="button"
            className="registry-icon-button"
            aria-label="Close member dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </header>

        <form className="registry-form" onSubmit={submit} noValidate>
          <div className="registry-member-form-grid">
            <div className="registry-field registry-member-name-field">
              <label htmlFor="registry-member-full-name">Full name</label>
              <input
                {...fullNameRegistration}
                id="registry-member-full-name"
                aria-invalid={Boolean(errors.fullName)}
                aria-autocomplete={state.mode === 'create' ? 'list' : undefined}
                aria-controls={
                  state.mode === 'create'
                    ? 'registry-member-name-suggestions'
                    : undefined
                }
                aria-expanded={
                  state.mode === 'create' ? fullNameSuggestionsOpen : undefined
                }
                role={state.mode === 'create' ? 'combobox' : undefined}
                autoComplete="off"
                onFocus={() => {
                  if (state.mode === 'create') setFullNameSuggestionsOpen(true);
                }}
                onChange={(event) => {
                  void fullNameRegistration.onChange(event);
                  if (state.mode === 'create') setFullNameSuggestionsOpen(true);
                }}
                onBlur={(event) => {
                  void fullNameRegistration.onBlur(event);
                  const input = event.currentTarget;
                  window.setTimeout(() => {
                    if (document.activeElement !== input) {
                      setFullNameSuggestionsOpen(false);
                    }
                  }, 100);
                }}
                onKeyDown={(event) => {
                  if (state.mode !== 'create' || !fullNameSuggestionsOpen)
                    return;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveMemberSuggestion((current) =>
                      Math.min(
                        current + 1,
                        Math.max(existingMemberSuggestions.length - 1, 0),
                      ),
                    );
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveMemberSuggestion((current) =>
                      Math.max(current - 1, 0),
                    );
                  } else if (event.key === 'Enter') {
                    const selectedMember =
                      existingMemberSuggestions[
                        Math.min(
                          activeMemberSuggestion,
                          existingMemberSuggestions.length - 1,
                        )
                      ];
                    if (selectedMember) {
                      event.preventDefault();
                      selectExistingMember(selectedMember);
                    }
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setFullNameSuggestionsOpen(false);
                  }
                }}
              />
              {state.mode === 'create' && fullNameSuggestionsOpen && (
                <div
                  id="registry-member-name-suggestions"
                  className="registry-member-name-suggestions"
                  role="listbox"
                  aria-label="Existing members"
                >
                  {existingMemberSuggestions.length > 0 ? (
                    existingMemberSuggestions.map((candidate, index) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="registry-member-name-option"
                        role="option"
                        aria-selected={index === activeMemberSuggestion}
                        data-active={index === activeMemberSuggestion}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveMemberSuggestion(index)}
                        onClick={() => selectExistingMember(candidate)}
                      >
                        <span className="registry-member-name-option-copy">
                          <strong>{candidate.fullName}</strong>
                          <small>{candidate.email}</small>
                        </span>
                        <em>Already in Registry</em>
                      </button>
                    ))
                  ) : (
                    <p className="registry-member-name-empty">
                      No existing member found. Continue entering the new
                      member.
                    </p>
                  )}
                </div>
              )}
              {errors.fullName?.message && (
                <small>{errors.fullName.message}</small>
              )}
            </div>
            <label className="registry-field">
              <span>Email address</span>
              <input
                {...register('email')}
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email?.message && <small>{errors.email.message}</small>}
            </label>
            <label className="registry-field">
              <span>Primary venture (optional)</span>
              <input
                type="search"
                list="registry-venture-options"
                value={ventureSearch}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setVentureSearch(nextSearch);
                  const selectedVenture = ventures.find(
                    (venture) =>
                      venture.name.localeCompare(
                        nextSearch.trim(),
                        undefined,
                        {
                          sensitivity: 'base',
                        },
                      ) === 0,
                  );
                  setValue('ventureId', selectedVenture?.id ?? '', {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                placeholder="Search ventures"
                autoComplete="off"
                aria-invalid={Boolean(errors.ventureId)}
              />
              <datalist id="registry-venture-options">
                {ventures.map((venture) => (
                  <option key={venture.id} value={venture.name}>
                    {venture.shortLabel}
                  </option>
                ))}
              </datalist>
              <input type="hidden" {...register('ventureId')} />
              {errors.ventureId?.message && (
                <small>{errors.ventureId.message}</small>
              )}
            </label>
            <label className="registry-field">
              <span>Position</span>
              <input
                {...register('position')}
                aria-invalid={Boolean(errors.position)}
              />
              {errors.position?.message && (
                <small>{errors.position.message}</small>
              )}
            </label>
            <label className="registry-field">
              <span>Workspace role</span>
              <select {...register('workspaceRole')}>
                <option value="MEMBER">Member</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
            </label>
            <label className="registry-field">
              <span>Member status</span>
              <select
                {...register('status')}
                disabled={state.mode === 'create'}
              >
                <option value="INVITED">Invited</option>
                <option value="ACTIVE">Active</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
            </label>
          </div>

          <p className="registry-form-note">
            {state.mode === 'create'
              ? 'New members begin invited. Authentication is linked by the backend after successful account setup.'
              : 'Authentication is linked by the backend. An invited member cannot become active until that identity is connected.'}
          </p>

          {Boolean(saveError) && (
            <p className="registry-form-error" role="alert">
              {messageFromError(saveError)}
            </p>
          )}

          <footer className="registry-dialog-actions">
            <button
              type="button"
              className="registry-secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="registry-primary-button"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : state.mode === 'create'
                  ? 'Add member'
                  : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function RemoveMemberDialog({
  member,
  isRemoving,
  removeError,
  onClose,
  onConfirm,
}: {
  member: RegistryMember;
  isRemoving: boolean;
  removeError: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="registry-dialog-backdrop" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget && !isRemoving) onClose();
    }}>
      <section className="registry-dialog registry-remove-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-member-title">
        <header className="registry-dialog-header">
          <div>
            <p className="registry-kicker">REMOVE MEMBER ACCESS</p>
            <h2 id="remove-member-title">Remove member</h2>
            <p>Remove <strong>{member.fullName}</strong> from Prometheus?</p>
          </div>
          <button type="button" className="registry-icon-button" aria-label="Close remove member dialog" onClick={onClose} disabled={isRemoving}>×</button>
        </header>
        <p className="registry-remove-copy">
          Their account access will be revoked while historical project, chat, notification, and work records remain preserved.
        </p>
        <p className="registry-form-note">
          You can add {member.email} again later to send a new account setup invitation.
        </p>
        {Boolean(removeError) && <p className="registry-form-error" role="alert">{messageFromError(removeError)}</p>}
        <footer className="registry-dialog-actions">
          <button type="button" className="registry-secondary-button" onClick={onClose} disabled={isRemoving}>Cancel</button>
          <button type="button" className="registry-danger-button" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? 'Removing...' : 'Remove member'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function RegistryPage({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<VentureDialogState | null>(
    null,
  );
  const [memberDialogState, setMemberDialogState] =
    useState<MemberDialogState | null>(null);
  const [ventureToRemove, setVentureToRemove] =
    useState<RegistryVenture | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<RegistryMember | null>(null);
  const [ventureSearch, setVentureSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<
    'ALL' | 'ADMINISTRATOR' | 'MEMBER'
  >('ALL');

  const overview = useQuery({
    ...registryOverviewQuery(accessToken),
  });
  const ventures = { ...overview, data: overview.data?.ventures ?? [] };
  const members = { ...overview, data: overview.data?.members ?? [] };

  const refreshProjectCreateOptions = () => {
    if (!accessToken) return;
    void queryClient.fetchQuery({
      ...projectCreateOptionsQuery(accessToken),
      staleTime: 0,
    });
  };

  const saveVenture = useMutation({
    mutationFn: ({ ventureId, request }: SaveVentureInput) =>
      apiFetch(
        ventureId
          ? `/registry/ventures/${ventureId}`
          : '/registry/ventures',
        RegistryVentureSchema,
        {
          accessToken,
          method: ventureId ? 'PATCH' : 'POST',
          body: request,
        },
      ),
    onSuccess: (savedVenture) => {
      queryClient.setQueryData<RegistryOverviewResponse>(
        registryOverviewQueryKey,
        (current) =>
          current
            ? {
                ...current,
                ventures: sortVentures([
                  ...current.ventures.filter(
                    (venture) => venture.id !== savedVenture.id,
                  ),
                  savedVenture,
                ]),
              }
            : current,
      );
      refreshProjectCreateOptions();
      setDialogState(null);
    },
  });

  const deleteVenture = useMutation({
    mutationFn: (ventureId: string) =>
      apiFetch(
        `/registry/ventures/${ventureId}`,
        DeleteVentureResponseSchema,
        {
          accessToken,
          method: 'DELETE',
        },
      ),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<RegistryOverviewResponse>(
        registryOverviewQueryKey,
        (current) =>
          current
            ? {
                ...current,
                ventures: current.ventures.filter(
                  (venture) => venture.id !== id,
                ),
              }
            : current,
      );
      refreshProjectCreateOptions();
      setVentureToRemove(null);
    },
  });

  const saveMember = useMutation({
    mutationFn: ({ memberId, request }: SaveMemberInput) =>
      apiFetch(
        memberId ? `/registry/members/${memberId}` : '/registry/members',
        RegistryMemberSchema,
        {
          accessToken,
          method: memberId ? 'PATCH' : 'POST',
          body: request,
        },
      ),
    onSuccess: (savedMember) => {
      queryClient.setQueryData<RegistryOverviewResponse>(
        registryOverviewQueryKey,
        (current) => {
          if (!current) return current;
          const nextMembers = [
            ...current.members.filter((member) => member.id !== savedMember.id),
            savedMember,
          ].sort((left, right) =>
            left.fullName.localeCompare(right.fullName, undefined, {
              sensitivity: 'base',
            }),
          );
          return {
            ventures: withMemberCounts(current.ventures, nextMembers),
            members: nextMembers,
          };
        },
      );
      refreshProjectCreateOptions();
      setMemberDialogState(null);
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(
        `/registry/members/${memberId}`,
        RemoveMemberResponseSchema,
        { accessToken, method: 'DELETE' },
      ),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<RegistryOverviewResponse>(
        registryOverviewQueryKey,
        (current) => {
          if (!current) return current;
          const nextMembers = current.members.filter(
            (member) => member.id !== id,
          );
          return {
            ventures: withMemberCounts(current.ventures, nextMembers),
            members: nextMembers,
          };
        },
      );
      refreshProjectCreateOptions();
      setMemberToRemove(null);
    },
  });

  const resendInvitation = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(
        `/registry/members/${memberId}/invitation`,
        RegistryMemberSchema,
        { accessToken, method: 'POST' },
      ),
    onSuccess: (savedMember) => {
      queryClient.setQueryData<RegistryOverviewResponse>(
        registryOverviewQueryKey,
        (current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.id === savedMember.id ? savedMember : member,
                ),
              }
            : current,
      );
    },
  });

  const ventureCount = ventures.data?.length ?? 0;
  const totalAssignedMembers = useMemo(
    () =>
      ventures.data?.reduce(
        (total, venture) => total + venture.memberCount,
        0,
      ) ?? 0,
    [ventures.data],
  );
  const administratorCount =
    members.data?.filter((member) => member.workspaceRole === 'ADMINISTRATOR')
      .length ?? 0;
  const filteredVentures = useMemo(() => {
    const query = ventureSearch.trim().toLocaleLowerCase();
    if (!query) return ventures.data ?? [];

    return (ventures.data ?? []).filter((venture) =>
      [
        venture.name,
        venture.shortLabel,
        venture.description ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [ventureSearch, ventures.data]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase();

    return (members.data ?? []).filter((member) => {
      if (
        memberRoleFilter !== 'ALL' &&
        member.workspaceRole !== memberRoleFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        member.fullName,
        member.email,
        (member.venture?.name ?? 'No venture'),
        (member.venture?.shortLabel ?? 'Unassigned'),
        member.position ?? '',
        member.status,
        member.authenticationStatus,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [memberRoleFilter, memberSearch, members.data]);

  const openCreate = () => {
    saveVenture.reset();
    setDialogState({ mode: 'create' });
  };

  const openEdit = (venture: RegistryVenture) => {
    saveVenture.reset();
    setDialogState({ mode: 'edit', venture });
  };

  const closeDialog = () => {
    if (saveVenture.isPending) return;
    saveVenture.reset();
    setDialogState(null);
  };

  const openRemoveVenture = (venture: RegistryVenture) => {
    deleteVenture.reset();
    setVentureToRemove(venture);
  };

  const closeRemoveVenture = () => {
    if (deleteVenture.isPending) return;
    deleteVenture.reset();
    setVentureToRemove(null);
  };

  const confirmRemoveVenture = async () => {
    if (!ventureToRemove) return;
    try {
      await deleteVenture.mutateAsync(ventureToRemove.id);
    } catch {
      // The mutation error remains visible inside the confirmation dialog.
    }
  };

  const save = async (request: CreateVentureRequest) => {
    const ventureId =
      dialogState?.mode === 'edit' ? dialogState.venture.id : undefined;
    await saveVenture.mutateAsync({ ventureId, request });
  };

  const openCreateMember = () => {
    saveMember.reset();
    setMemberDialogState({ mode: 'create' });
  };

  const openEditMember = (member: RegistryMember) => {
    saveMember.reset();
    setMemberDialogState({ mode: 'edit', member });
  };

  const closeMemberDialog = () => {
    if (saveMember.isPending) return;
    saveMember.reset();
    setMemberDialogState(null);
  };

  const saveRegistryMember = async (request: UpdateMemberRequest) => {
    const memberId =
      memberDialogState?.mode === 'edit'
        ? memberDialogState.member.id
        : undefined;
    await saveMember.mutateAsync({ memberId, request });
  };

  return (
    <section className="registry-page" aria-labelledby="registry-title">
      <header className="registry-page-header">
        <div>
          <p className="registry-kicker">WORKSPACE REGISTRY</p>
          <h1 id="registry-title">Registry</h1>
          <Link to="/ventures">Manage venture memberships and roles</Link>
          <p>
            Maintain ventures, member records, roles, and workspace
            authorization.
          </p>
        </div>
        <div className="registry-access-pill">
          <span aria-hidden="true" />
          Administrator access
        </div>
      </header>

      <div className="registry-summary-grid" aria-label="Registry summary">
        <article className="registry-summary-card">
          <span>Ventures</span>
          <strong>{ventures.isPending ? '...' : ventureCount}</strong>
          <small>Businesses and startups</small>
        </article>
        <article className="registry-summary-card">
          <span>Authorized members</span>
          <strong>
            {members.isPending ? '...' : (members.data?.length ?? 0)}
          </strong>
          <small>{totalAssignedMembers} assigned to a venture</small>
        </article>
        <article className="registry-summary-card registry-summary-context">
          <span>Registry authority</span>
          <strong>{members.isPending ? '...' : administratorCount}</strong>
          <small>Can manage access</small>
        </article>
      </div>

      <div className="registry-content-grid">
        <section className="registry-panel" aria-labelledby="ventures-title">
          <header className="registry-panel-header">
            <div>
              <p className="registry-kicker">STRUCTURE</p>
              <h2 id="ventures-title">Ventures</h2>
              <p>Manage the ventures your team builds and operates.</p>
            </div>
            <button
              type="button"
              className="registry-primary-button registry-add-button"
              onClick={openCreate}
            >
              + Add venture
            </button>
          </header>

          <label className="registry-venture-search">
            <span className="sr-only">Search ventures</span>
            <input
              type="search"
              aria-label="Search ventures"
              placeholder="Search ventures"
              value={ventureSearch}
              onChange={(event) => setVentureSearch(event.target.value)}
              disabled={!ventures.isSuccess || ventures.data.length === 0}
            />
          </label>

          {ventures.isPending && (
            <div
              className="registry-venture-list"
              aria-label="Loading ventures"
            >
              {[0, 1, 2].map((item) => (
                <div className="registry-venture-skeleton" key={item} />
              ))}
            </div>
          )}

          {ventures.isError && (
            <div className="registry-state-card" role="alert">
              <strong>Ventures could not be loaded.</strong>
              <p>{messageFromError(ventures.error)}</p>
              <button
                type="button"
                className="registry-secondary-button"
                onClick={() => void ventures.refetch()}
              >
                Try again
              </button>
            </div>
          )}

          {ventures.isSuccess && ventures.data.length === 0 && (
            <div className="registry-state-card registry-empty-state">
              <span aria-hidden="true">⌁</span>
              <strong>No ventures yet</strong>
              <p>Create the first organization unit for your workspace.</p>
              <button
                type="button"
                className="registry-secondary-button"
                onClick={openCreate}
              >
                Add venture
              </button>
            </div>
          )}

          {ventures.isSuccess &&
            ventures.data.length > 0 &&
            filteredVentures.length === 0 && (
              <div className="registry-state-card registry-filtered-empty">
                <strong>No matching ventures</strong>
                <p>Try a different venture search.</p>
              </div>
            )}

          {ventures.isSuccess && filteredVentures.length > 0 && (
            <div className="registry-venture-list">
              {filteredVentures.map((venture) => (
                <article
                  className="registry-venture-card"
                  key={venture.id}
                >
                  <button
                    type="button"
                    className="registry-venture-main"
                    onClick={() => openEdit(venture)}
                    aria-label={`View ${venture.name} members`}
                  >
                    <span
                      className="registry-venture-icon"
                      aria-hidden="true"
                    >
                      ⌁
                    </span>
                    <span className="registry-venture-copy">
                      <strong>{venture.shortLabel}</strong>
                      <span className="registry-venture-references">
                        <span
                          className={venture.memberCount > 0 ? 'is-blocking' : ''}
                        >
                          {venture.memberCount}{' '}
                          {venture.memberCount === 1 ? 'member' : 'members'}
                        </span>
                        <span
                          className={venture.projectCount > 0 ? 'is-blocking' : ''}
                        >
                          {venture.projectCount}{' '}
                          {venture.projectCount === 1 ? 'project' : 'projects'}
                        </span>
                        <span
                          className={venture.outcomeCount > 0 ? 'is-blocking' : ''}
                        >
                          {venture.outcomeCount}{' '}
                          {venture.outcomeCount === 1 ? 'outcome' : 'outcomes'}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="registry-remove-button"
                    onClick={() => openRemoveVenture(venture)}
                    aria-label={`Remove ${venture.name}`}
                    title={`Remove ${venture.name}`}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          className="registry-panel registry-members-panel"
          aria-labelledby="members-title"
        >
          <header className="registry-panel-header">
            <div>
              <p className="registry-kicker">MEMBERSHIP</p>
              <h2 id="members-title">Members</h2>
              <div className="registry-member-toolbar">
                <label className="registry-member-search">
                  <span className="sr-only">Search members</span>
                  <input
                    type="search"
                    aria-label="Search members"
                    placeholder="Search members"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />
                </label>
                <label className="registry-role-filter">
                  <span className="sr-only">Filter members by role</span>
                  <select
                    aria-label="Filter members by role"
                    value={memberRoleFilter}
                    onChange={(event) =>
                      setMemberRoleFilter(
                        event.target.value as
                          | 'ALL'
                          | 'ADMINISTRATOR'
                          | 'MEMBER',
                      )
                    }
                  >
                    <option value="ALL">All roles</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                    <option value="MEMBER">Member</option>
                  </select>
                </label>
              </div>
            </div>
            <button
              type="button"
              className="registry-primary-button registry-add-button"
              onClick={openCreateMember}
              disabled={!ventures.data?.length}
            >
              + Add member
            </button>
          </header>

          {members.isPending && (
            <div
              className="registry-member-loading"
              aria-label="Loading members"
            >
              {[0, 1, 2, 3].map((item) => (
                <div className="registry-venture-skeleton" key={item} />
              ))}
            </div>
          )}

          {members.isError && (
            <div className="registry-state-card" role="alert">
              <strong>Members could not be loaded.</strong>
              <p>{messageFromError(members.error)}</p>
              <button
                type="button"
                className="registry-secondary-button"
                onClick={() => void members.refetch()}
              >
                Try again
              </button>
            </div>
          )}

          {members.isSuccess && members.data.length === 0 && (
            <div className="registry-state-card registry-empty-state">
              <strong>No members yet</strong>
              <p>Add the first authorized Prometheus member.</p>
            </div>
          )}

          {members.isSuccess && members.data.length > 0 && (
            <>
              {(resendInvitation.isError || removeMember.isError) && (
                <div className="registry-form-error" role="alert">
                  {messageFromError(
                    removeMember.error ?? resendInvitation.error,
                  )}
                </div>
              )}
              {filteredMembers.length === 0 ? (
                <div className="registry-state-card registry-filtered-empty">
                  <strong>No matching members</strong>
                  <p>Try a different search or role filter.</p>
                </div>
              ) : (
                <div className="registry-table-wrap">
                  <table className="registry-members-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Venture</th>
                        <th>Access</th>
                        <th>Authentication</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="registry-member-row"
                          tabIndex={0}
                          aria-label={`Edit ${member.fullName}`}
                          onClick={() => openEditMember(member)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openEditMember(member);
                            }
                          }}
                        >
                          <td>
                            <div className="registry-member-identity">
                              <MemberAvatar name={member.fullName} profileImagePath={member.profileImagePath} />
                              <div>
                                <strong>{member.fullName}</strong>
                                <small>{member.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className="registry-venture-short-label"
                              title={(member.venture?.name ?? 'No venture')}
                            >
                              {(member.venture?.shortLabel ?? 'Unassigned')}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`registry-badge status ${member.status.toLowerCase()}`}
                            >
                              {member.status === 'DEACTIVATED'
                                ? 'Deactivated'
                                : member.status === 'INVITED'
                                  ? 'Invited'
                                  : 'Active'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`registry-auth-status ${member.authenticationStatus.toLowerCase()}`}
                            >
                              {member.authenticationStatus === 'LINKED'
                                ? 'Linked'
                                : 'Setup pending'}
                            </span>
                            <small className="registry-auth-caption">
                              {member.authenticationStatus === 'LINKED'
                                ? 'Authentication identity connected'
                                : member.invitationDeliveryStatus === 'SENT'
                                  ? 'Invitation delivered; waiting for account setup'
                                  : 'Invitation not delivered'}
                            </small>
                            {member.authenticationStatus === 'SETUP_PENDING' &&
                              member.status !== 'DEACTIVATED' && (
                                <button
                                  type="button"
                                  className="registry-inline-action"
                                  disabled={
                                    resendInvitation.isPending &&
                                    resendInvitation.variables === member.id
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    resendInvitation.reset();
                                    resendInvitation.mutate(member.id);
                                  }}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  {resendInvitation.isPending &&
                                  resendInvitation.variables === member.id
                                    ? 'Sending...'
                                    : member.invitationDeliveryStatus === 'SENT'
                                      ? 'Resend invitation'
                                      : 'Send invitation'}
                                </button>
                              )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="registry-member-remove-action"
                              disabled={
                                removeMember.isPending &&
                                removeMember.variables === member.id
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                removeMember.reset();
                                setMemberToRemove(member);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              {removeMember.isPending &&
                              removeMember.variables === member.id
                                ? 'Removing...'
                                : 'Remove'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {dialogState && (
        <VentureDialog
          state={dialogState}
          members={members.data ?? []}
          isSaving={saveVenture.isPending}
          saveError={saveVenture.error}
          onClose={closeDialog}
          onSave={save}
        />
      )}
      {ventureToRemove && (
        <RemoveVentureDialog
          venture={ventureToRemove}
          isRemoving={deleteVenture.isPending}
          removeError={deleteVenture.error}
          onClose={closeRemoveVenture}
          onConfirm={confirmRemoveVenture}
        />
      )}
      {memberToRemove && (
        <RemoveMemberDialog
          member={memberToRemove}
          isRemoving={removeMember.isPending}
          removeError={removeMember.error}
          onClose={() => {
            if (!removeMember.isPending) {
              removeMember.reset();
              setMemberToRemove(null);
            }
          }}
          onConfirm={() => removeMember.mutate(memberToRemove.id)}
        />
      )}
      {memberDialogState && (
        <MemberDialog
          state={memberDialogState}
          ventures={ventures.data ?? []}
          members={members.data ?? []}
          isSaving={saveMember.isPending}
          saveError={saveMember.error}
          onClose={closeMemberDialog}
          onSave={saveRegistryMember}
          onSelectExistingMember={openEditMember}
        />
      )}
    </section>
  );
}
