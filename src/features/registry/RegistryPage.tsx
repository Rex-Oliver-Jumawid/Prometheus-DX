import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  CreateDepartmentRequestSchema,
  RegistryDepartmentSchema,
  RegistryDepartmentsResponseSchema,
  type CreateDepartmentRequest,
  type DepartmentFormValues,
  type RegistryDepartment,
} from '../../../shared/contracts/registry';
import { apiFetch } from '../../lib/api';
import './registry.css';

const departmentsQueryKey = ['registry', 'departments'] as const;

type DepartmentDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; department: RegistryDepartment };

type SaveDepartmentInput = {
  departmentId?: string;
  request: CreateDepartmentRequest;
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
  const restoreFocusRef = useRef<HTMLElement | null>(null);
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
      description: department?.description ?? '',
    },
  });

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    reset({
      name: department?.name ?? '',
      description: department?.description ?? '',
    });
    setFocus('name');
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
        if (field === 'name' || field === 'description') {
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

  return (
    <div
      className="registry-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
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
            <p>
              Define the organization unit used to group members and work.
            </p>
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
          <label className="registry-field">
            <span>Department name</span>
            <input
              {...register('name')}
              aria-invalid={Boolean(errors.name)}
              autoComplete="off"
              placeholder="e.g. Research & Development"
            />
            {errors.name?.message && <small>{errors.name.message}</small>}
          </label>

          <label className="registry-field">
            <span>Description</span>
            <textarea
              {...register('description')}
              aria-invalid={Boolean(errors.description)}
              rows={4}
              placeholder="What does this department own?"
            />
            {errors.description?.message && (
              <small>{errors.description.message}</small>
            )}
          </label>

          {saveError && (
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
    </div>
  );
}

export function RegistryPage({ accessToken }: { accessToken?: string }) {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DepartmentDialogState | null>(
    null,
  );

  const departments = useQuery({
    queryKey: departmentsQueryKey,
    queryFn: ({ signal }) =>
      apiFetch('/registry/departments', RegistryDepartmentsResponseSchema, {
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

  const departmentCount = departments.data?.length ?? 0;
  const totalAssignedMembers = useMemo(
    () =>
      departments.data?.reduce(
        (total, department) => total + department.memberCount,
        0,
      ) ?? 0,
    [departments.data],
  );

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
          <span>Assigned members</span>
          <strong>{departments.isPending ? '...' : totalAssignedMembers}</strong>
          <small>Linked to a department</small>
        </article>
        <article className="registry-summary-card registry-summary-context">
          <span>Registry authority</span>
          <strong>Admin</strong>
          <small>Protected by workspace role</small>
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
            <div className="registry-department-list" aria-label="Loading departments">
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
                <article className="registry-department-card" key={department.id}>
                  <div className="registry-department-icon" aria-hidden="true">
                    ⌁
                  </div>
                  <div className="registry-department-copy">
                    <strong>{department.name}</strong>
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

        <aside className="registry-panel registry-members-context">
          <div>
            <p className="registry-kicker">MEMBERSHIP</p>
            <h2>Members</h2>
            <p>
              Membership authorizes workspace access. Authentication remains
              separate.
            </p>
          </div>
          <div className="registry-context-card">
            <span aria-hidden="true">◎</span>
            <div>
              <strong>Department structure is live</strong>
              <p>
                Member assignment and authentication status build on these
                persisted organization units.
              </p>
            </div>
          </div>
        </aside>
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
    </section>
  );
}
