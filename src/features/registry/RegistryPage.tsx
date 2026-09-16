import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateDepartmentRequestSchema,
  CreateMemberRequestSchema,
  RegistryDepartmentSchema,
  RegistryDepartmentsResponseSchema,
  RegistryMemberSchema,
  RegistryMembersResponseSchema,
  UpdateMemberRequestSchema,
  type CreateDepartmentRequest,
  type DepartmentFormValues,
  type MemberFormValues,
  type RegistryDepartment,
  type RegistryMember,
  type UpdateMemberRequest,
} from '../../../shared/contracts/registry';
import { apiFetch } from '../../lib/api';
import './registry.css';
import './member-name-combobox.css';

const departmentsQueryKey = ['registry', 'departments'] as const;
const membersQueryKey = ['registry', 'members'] as const;

type DepartmentDialogState =
  { mode: 'create' } | { mode: 'edit'; department: RegistryDepartment };

type SaveDepartmentInput = {
  departmentId?: string;
  request: CreateDepartmentRequest;
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

function sortDepartments(
  departments: RegistryDepartment[],
): RegistryDepartment[] {
  return [...departments].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
}

function DepartmentDialog({
  state,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  state: DepartmentDialogState;
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: CreateDepartmentRequest) => Promise<void>;
}) {
  const department = state.mode === 'edit' ? state.department : undefined;
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
  } = useForm<DepartmentFormValues>({
    defaultValues: {
      name: department?.name ?? '',
      shortLabel: department?.shortLabel ?? '',
      description: department?.description ?? '',
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
      name: department?.name ?? '',
      shortLabel: department?.shortLabel ?? '',
      description: department?.description ?? '',
    });
    const focusFrame = window.requestAnimationFrame(() => setFocus('name'));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [department, reset, setFocus]);

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
    const parsed = CreateDepartmentRequestSchema.safeParse(values);
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
        aria-labelledby="department-dialog-title"
      >
        <header className="registry-dialog-header">
          <div>
            <p className="registry-kicker">
              {state.mode === 'create'
                ? 'NEW ORGANIZATION UNIT'
                : 'ORGANIZATION UNIT'}
            </p>
            <h2 id="department-dialog-title">
              {state.mode === 'create' ? 'Add department' : 'Edit department'}
            </h2>
            <p>Define the organization unit used to group members and work.</p>
          </div>
          <button
            type="button"
            className="registry-icon-button"
            aria-label="Close department dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </header>

        <form className="registry-form" onSubmit={submit} noValidate>
          <div className="registry-form-row">
            <label className="registry-field">
              <span>Department name</span>
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
              placeholder="What this department is responsible for"
            />
            {errors.description?.message && (
              <small>{errors.description.message}</small>
            )}
          </label>

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
                  ? 'Create department'
                  : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function MemberDialog({
  state,
  departments,
  members,
  isSaving,
  saveError,
  onClose,
  onSave,
  onSelectExistingMember,
}: {
  state: MemberDialogState;
  departments: RegistryDepartment[];
  members: RegistryMember[];
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: UpdateMemberRequest) => Promise<void>;
  onSelectExistingMember: (member: RegistryMember) => void;
}) {
  const member = state.mode === 'edit' ? state.member : undefined;
  const defaultDepartmentId =
    member?.departmentId ?? departments[0]?.id ?? '';
  const defaultDepartmentName =
    departments.find((department) => department.id === defaultDepartmentId)
      ?.name ?? '';
  const [departmentSearch, setDepartmentSearch] = useState(
    defaultDepartmentName,
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
    setFocus,
    setValue,
    watch,
  } = useForm<MemberFormValues>({
    defaultValues: {
      fullName: member?.fullName ?? '',
      email: member?.email ?? '',
      departmentId: defaultDepartmentId,
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
    const nextDepartmentId =
      member?.departmentId ?? departments[0]?.id ?? '';
    const nextDepartmentName =
      departments.find((department) => department.id === nextDepartmentId)
        ?.name ?? '';
    reset({
      fullName: member?.fullName ?? '',
      email: member?.email ?? '',
      departmentId: nextDepartmentId,
      position: member?.position ?? '',
      workspaceRole: member?.workspaceRole ?? 'MEMBER',
      status: member?.status ?? 'INVITED',
    });
    setDepartmentSearch(nextDepartmentName);
    setFullNameSuggestionsOpen(false);
    setActiveMemberSuggestion(0);
    const focusFrame = window.requestAnimationFrame(() => setFocus('fullName'));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [departments, member, reset, setFocus]);

  useEffect(() => {
    setActiveMemberSuggestion(0);
  }, [fullName]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
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
  }, [isSaving, onClose]);

  const submit = handleSubmit(async (values) => {
    clearErrors();
    const parsed = (
      state.mode === 'create'
        ? CreateMemberRequestSchema
        : UpdateMemberRequestSchema
    ).safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'fullName' ||
          field === 'email' ||
          field === 'departmentId' ||
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
                autoFocus
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
                  window.setTimeout(() => setFullNameSuggestionsOpen(false), 100);
                }}
                onKeyDown={(event) => {
                  if (state.mode !== 'create' || !fullNameSuggestionsOpen) return;
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
                    setActiveMemberSuggestion((current) => Math.max(current - 1, 0));
                  } else if (
                    event.key === 'Enter' &&
                    existingMemberSuggestions[activeMemberSuggestion]
                  ) {
                    event.preventDefault();
                    selectExistingMember(
                      existingMemberSuggestions[activeMemberSuggestion],
                    );
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
                      No existing member found. Continue entering the new member.
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
              <span>Department</span>
              <input
                type="search"
                list="registry-department-options"
                value={departmentSearch}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setDepartmentSearch(nextSearch);
                  const selectedDepartment = departments.find(
                    (department) =>
                      department.name.localeCompare(nextSearch.trim(), undefined, {
                        sensitivity: 'base',
                      }) === 0,
                  );
                  setValue('departmentId', selectedDepartment?.id ?? '', {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                placeholder="Search departments"
                autoComplete="off"
                aria-invalid={Boolean(errors.departmentId)}
              />
              <datalist id="registry-department-options">
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.shortLabel}
                  </option>
                ))}
              </datalist>
              <input type="hidden" {...register('departmentId')} />
              {errors.departmentId?.message && (
                <small>{errors.departmentId.message}</small>
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
              disabled={isSaving || departments.length === 0}
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

function memberInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function RegistryPage({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DepartmentDialogState | null>(
    null,
  );
  const [memberDialogState, setMemberDialogState] =
    useState<MemberDialogState | null>(null);

  const departments = useQuery({
    queryKey: departmentsQueryKey,
    queryFn: ({ signal }) =>
      apiFetch('/registry/departments', RegistryDepartmentsResponseSchema, {
        accessToken,
        signal,
      }),
    retry: false,
  });

  const members = useQuery({
    queryKey: membersQueryKey,
    queryFn: ({ signal }) =>
      apiFetch('/registry/members', RegistryMembersResponseSchema, {
        accessToken,
        signal,
      }),
    retry: false,
  });

  const saveDepartment = useMutation({
    mutationFn: ({ departmentId, request }: SaveDepartmentInput) =>
      apiFetch(
        departmentId
          ? `/registry/departments/${departmentId}`
          : '/registry/departments',
        RegistryDepartmentSchema,
        {
          accessToken,
          method: departmentId ? 'PATCH' : 'POST',
          body: request,
        },
      ),
    onSuccess: (savedDepartment) => {
      queryClient.setQueryData<RegistryDepartment[]>(
        departmentsQueryKey,
        (current = []) =>
          sortDepartments([
            ...current.filter(
              (department) => department.id !== savedDepartment.id,
            ),
            savedDepartment,
          ]),
      );
      setDialogState(null);
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
      queryClient.setQueryData<RegistryMember[]>(
        membersQueryKey,
        (current = []) =>
          [
            ...current.filter((member) => member.id !== savedMember.id),
            savedMember,
          ].sort((left, right) =>
            left.fullName.localeCompare(right.fullName, undefined, {
              sensitivity: 'base',
            }),
          ),
      );
      void queryClient.invalidateQueries({ queryKey: departmentsQueryKey });
      setMemberDialogState(null);
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
      queryClient.setQueryData<RegistryMember[]>(
        membersQueryKey,
        (current = []) =>
          current.map((member) =>
            member.id === savedMember.id ? savedMember : member,
          ),
      );
    },
  });

  const departmentCount = departments.data?.length ?? 0;
  const totalAssignedMembers = useMemo(
    () =>
      departments.data?.reduce(
        (total, department) => total + department.memberCount,
        0,
      ) ?? 0,
    [departments.data],
  );
  const administratorCount =
    members.data?.filter((member) => member.workspaceRole === 'ADMINISTRATOR')
      .length ?? 0;
  const unassignedMembers =
    members.data?.filter((member) => !member.departmentId) ?? [];

  const openCreate = () => {
    saveDepartment.reset();
    setDialogState({ mode: 'create' });
  };

  const openEdit = (department: RegistryDepartment) => {
    saveDepartment.reset();
    setDialogState({ mode: 'edit', department });
  };

  const closeDialog = () => {
    if (saveDepartment.isPending) return;
    saveDepartment.reset();
    setDialogState(null);
  };

  const save = async (request: CreateDepartmentRequest) => {
    const departmentId =
      dialogState?.mode === 'edit' ? dialogState.department.id : undefined;
    await saveDepartment.mutateAsync({ departmentId, request });
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
          <p>
            Maintain departments, member records, roles, and workspace
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
          <span>Departments</span>
          <strong>{departments.isPending ? '...' : departmentCount}</strong>
          <small>Organization units</small>
        </article>
        <article className="registry-summary-card">
          <span>Authorized members</span>
          <strong>
            {members.isPending ? '...' : (members.data?.length ?? 0)}
          </strong>
          <small>{totalAssignedMembers} assigned to a department</small>
        </article>
        <article className="registry-summary-card registry-summary-context">
          <span>Registry authority</span>
          <strong>{members.isPending ? '...' : administratorCount}</strong>
          <small>Can manage access</small>
        </article>
      </div>

      <div className="registry-content-grid">
        <section className="registry-panel" aria-labelledby="departments-title">
          <header className="registry-panel-header">
            <div>
              <p className="registry-kicker">STRUCTURE</p>
              <h2 id="departments-title">Departments</h2>
              <p>Create organization units that can own members and work.</p>
            </div>
            <button
              type="button"
              className="registry-primary-button registry-add-button"
              onClick={openCreate}
            >
              + Add department
            </button>
          </header>

          {departments.isPending && (
            <div
              className="registry-department-list"
              aria-label="Loading departments"
            >
              {[0, 1, 2].map((item) => (
                <div className="registry-department-skeleton" key={item} />
              ))}
            </div>
          )}

          {departments.isError && (
            <div className="registry-state-card" role="alert">
              <strong>Departments could not be loaded.</strong>
              <p>{messageFromError(departments.error)}</p>
              <button
                type="button"
                className="registry-secondary-button"
                onClick={() => void departments.refetch()}
              >
                Try again
              </button>
            </div>
          )}

          {departments.isSuccess && departments.data.length === 0 && (
            <div className="registry-state-card registry-empty-state">
              <span aria-hidden="true">⌁</span>
              <strong>No departments yet</strong>
              <p>Create the first organization unit for your workspace.</p>
              <button
                type="button"
                className="registry-secondary-button"
                onClick={openCreate}
              >
                Add department
              </button>
            </div>
          )}

          {departments.isSuccess && departments.data.length > 0 && (
            <div className="registry-department-list">
              {departments.data.map((department) => (
                <article
                  className="registry-department-card"
                  key={department.id}
                >
                  <div className="registry-department-icon" aria-hidden="true">
                    ⌁
                  </div>
                  <div className="registry-department-copy">
                    <strong>
                      {department.name}
                      <span>{department.shortLabel}</span>
                    </strong>
                    <p>{department.description || 'No description yet.'}</p>
                  </div>
                  <span className="registry-member-count">
                    {department.memberCount}{' '}
                    {department.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <button
                    type="button"
                    className="registry-edit-button"
                    onClick={() => openEdit(department)}
                    aria-label={`Edit ${department.name}`}
                  >
                    Edit
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
              <p>
                Membership authorizes workspace access. Authentication remains
                separate.
              </p>
            </div>
            <button
              type="button"
              className="registry-primary-button registry-add-button"
              onClick={openCreateMember}
              disabled={!departments.data?.length}
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
                <div className="registry-department-skeleton" key={item} />
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
              {unassignedMembers.length > 0 && (
                <div className="registry-assignment-alert" role="status">
                  <div>
                    <strong>
                      {unassignedMembers.length}{' '}
                      {unassignedMembers.length === 1
                        ? 'member needs'
                        : 'members need'}{' '}
                      a department
                    </strong>
                    <p>
                      Assign each legacy Member deliberately before the
                      Department relationship can become required.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="registry-secondary-button"
                    onClick={() => openEditMember(unassignedMembers[0])}
                  >
                    Assign department
                  </button>
                </div>
              )}
              {resendInvitation.isError && (
                <div className="registry-form-error" role="alert">
                  {messageFromError(resendInvitation.error)}
                </div>
              )}
              <div className="registry-table-wrap">
                <table className="registry-members-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Role</th>
                      <th>Access</th>
                      <th>Authentication</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.data.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="registry-member-identity">
                            <span>{memberInitials(member.fullName)}</span>
                            <div>
                              <strong>{member.fullName}</strong>
                              <small>{member.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {member.department?.name ?? (
                            <button
                              type="button"
                              className="registry-inline-action warning"
                              onClick={() => openEditMember(member)}
                            >
                              Assign department
                            </button>
                          )}
                        </td>
                        <td>{member.position ?? 'Not set'}</td>
                        <td>
                          <span className="registry-badge role">
                            {member.workspaceRole === 'ADMINISTRATOR'
                              ? 'Administrator'
                              : 'Member'}
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
                                onClick={() => {
                                  resendInvitation.reset();
                                  resendInvitation.mutate(member.id);
                                }}
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
                            className="registry-edit-button"
                            onClick={() => openEditMember(member)}
                            aria-label={`Edit ${member.fullName}`}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {dialogState && (
        <DepartmentDialog
          state={dialogState}
          isSaving={saveDepartment.isPending}
          saveError={saveDepartment.error}
          onClose={closeDialog}
          onSave={save}
        />
      )}
      {memberDialogState && (
        <MemberDialog
          state={memberDialogState}
          departments={departments.data ?? []}
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
