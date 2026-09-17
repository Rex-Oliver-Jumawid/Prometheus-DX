import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  CreateProjectRequestSchema,
  type CreateProjectRequest,
} from '../../../shared/contracts/project';
import { projectCreateOptionsQuery } from './project-queries';

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function CreateProjectDialog({
  accessToken,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  accessToken?: string;
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: CreateProjectRequest) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const options = useQuery({
    ...projectCreateOptionsQuery(accessToken),
    enabled: Boolean(accessToken),
  });
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setFocus,
  } = useForm<CreateProjectRequest>({
    defaultValues: {
      name: '',
      description: '',
      leadMemberId: '',
      departmentIds: [],
    },
  });

  useEffect(() => {
    const restoreFocusTo = restoreFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => setFocus('name'));
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      restoreFocusTo?.focus();
    };
  }, [setFocus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) return onClose();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const submit = handleSubmit(async (values) => {
    clearErrors();
    const parsed = CreateProjectRequestSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'name' ||
          field === 'description' ||
          field === 'leadMemberId' ||
          field === 'departmentIds'
        ) {
          setError(field, { type: 'validate', message: issue.message });
        }
      }
      return;
    }
    try {
      await onSave(parsed.data);
    } catch {
      // The mutation error is rendered without discarding form values.
    }
  });

  const unavailable =
    options.isSuccess &&
    (!options.data.leads.length || !options.data.departments.length);

  return createPortal(
    <div
      className="projects-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="projects-dialog vw-add-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
      >
        <header className="vw-add-project-header">
          <div>
            <div className="vw-add-project-kicker">PROJECTS</div>
            <h2 id="create-project-title" className="vw-add-project-title">
              Add Project
            </h2>
          </div>
          <button
            type="button"
            className="vw-add-project-close"
            aria-label="Close Add Project dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ✕
          </button>
        </header>
        <form className="vw-add-project-form" onSubmit={submit} noValidate>
          <div className="vw-add-project-body">
            <div className="vw-add-project-field">
              <label htmlFor="project-name-input">Project name</label>
              <input
                id="project-name-input"
                {...register('name')}
                aria-invalid={Boolean(errors.name)}
                autoComplete="off"
                placeholder="e.g. Customer Portal"
              />
              {errors.name?.message && (
                <small className="projects-field-error">
                  {errors.name.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field">
              <label htmlFor="project-description-input">Description</label>
              <textarea
                id="project-description-input"
                {...register('description')}
                aria-invalid={Boolean(errors.description)}
                placeholder="What is this project trying to achieve?"
              />
              {errors.description?.message && (
                <small className="projects-field-error">
                  {errors.description.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field-grid">
              <div className="vw-add-project-field">
                <label htmlFor="project-status-select">Status</label>
                <select
                  id="project-status-select"
                  defaultValue="PLANNING"
                  aria-label="Project status"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS" disabled>
                    In Progress
                  </option>
                  <option value="DONE" disabled>
                    Done
                  </option>
                </select>
              </div>

              <div className="vw-add-project-field">
                <label htmlFor="project-lead-select">Project lead</label>
                {options.isPending ? (
                  <select
                    id="project-lead-select"
                    aria-label="Project Lead"
                    disabled
                  >
                    <option>Loading Project Leads...</option>
                  </select>
                ) : (
                  <select
                    id="project-lead-select"
                    aria-label="Project Lead"
                    {...register('leadMemberId')}
                    aria-invalid={Boolean(errors.leadMemberId)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose an active Member
                    </option>
                    {options.data?.leads.map((lead) => (
                      <option value={lead.id} key={lead.id}>
                        {lead.fullName}
                      </option>
                    ))}
                  </select>
                )}
                {errors.leadMemberId?.message && (
                  <small className="projects-field-error">
                    {errors.leadMemberId.message}
                  </small>
                )}
              </div>
            </div>

            {options.isError && (
              <div
                className="projects-options-state projects-error"
                role="alert"
              >
                <strong>Creation options could not be loaded.</strong>
                <span>{errorMessage(options.error)}</span>
                <button type="button" onClick={() => void options.refetch()}>
                  Retry
                </button>
              </div>
            )}

            {unavailable && (
              <div
                className="projects-options-state projects-error"
                role="alert"
              >
                <strong>Project creation is not ready yet.</strong>
                <span>
                  {!options.data?.leads.length
                    ? 'No active Members are available to lead a Project.'
                    : 'No persisted Departments are available.'}
                </span>
              </div>
            )}

            <div className="vw-add-project-field">
              <label>Departments involved</label>
              {options.isPending ? (
                <div className="vw-add-project-loading-text">
                  Loading departments...
                </div>
              ) : (
                <div
                  className="vw-new-project-depts"
                  role="group"
                  aria-label="Departments involved"
                >
                  {options.data?.departments.map((department) => (
                    <label
                      key={department.id}
                      className="vw-dept-checkbox-card"
                    >
                      <input
                        type="checkbox"
                        value={department.id}
                        {...register('departmentIds')}
                      />
                      <span>{department.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {errors.departmentIds?.message && (
                <small className="projects-field-error">
                  {errors.departmentIds.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-preview">
              The project workspace will start blank. Add stages and outcomes
              later from inside the project workspace.
            </div>
          </div>

          {Boolean(saveError) && (
            <div className="projects-save-error" role="alert">
              {errorMessage(saveError)}
            </div>
          )}
          <footer className="vw-add-project-foot">
            <button
              type="button"
              className="vw-add-project-btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="vw-add-project-btn-create"
              disabled={isSaving || !options.isSuccess || unavailable}
            >
              {isSaving ? 'Creating...' : 'Create Project'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
