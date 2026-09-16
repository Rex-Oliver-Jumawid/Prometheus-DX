import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  CreateProjectRequestSchema,
  ProjectCreateOptionsResponseSchema,
  type CreateProjectRequest,
} from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
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
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const options = useQuery({
    queryKey: ['projects', 'create-options'],
    queryFn: ({ signal }) =>
      apiFetch('/projects/create-options', ProjectCreateOptionsResponseSchema, {
        accessToken,
        signal,
      }),
    retry: false,
  });
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setFocus,
  } = useForm<CreateProjectRequest>({
    defaultValues: { name: '', description: '', leadMemberId: '', departmentIds: [] },
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
        if (field === 'name' || field === 'description' || field === 'leadMemberId' || field === 'departmentIds') {
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

  const unavailable = options.isSuccess && (!options.data.leads.length || !options.data.departments.length);

  return createPortal(
    <div className="projects-dialog-backdrop" role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget && !isSaving) onClose();
    }}>
      <section ref={dialogRef} className="projects-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <header className="projects-dialog-header">
          <div>
            <p className="projects-kicker">PROJECTS</p>
            <h2 id="create-project-title">Add Project</h2>
            <p>Start with the project details, its accountable Lead, and the departments involved.</p>
          </div>
          <button type="button" className="projects-icon-button" aria-label="Close Create Project dialog" onClick={onClose} disabled={isSaving}>×</button>
        </header>
        <form className="projects-form" onSubmit={submit} noValidate>
          <div className="projects-dialog-body">
            <label className="projects-field">
              <span>Project name</span>
              <input {...register('name')} aria-invalid={Boolean(errors.name)} autoComplete="off" placeholder="e.g. Customer Portal" />
              {errors.name?.message && <small>{errors.name.message}</small>}
            </label>
            <label className="projects-field">
              <span>Description</span>
              <textarea {...register('description')} aria-invalid={Boolean(errors.description)} placeholder="What is this project trying to achieve?" />
              {errors.description?.message && <small>{errors.description.message}</small>}
            </label>
            {options.isPending && <div className="projects-options-state" aria-live="polite">Loading available Project Leads and departments...</div>}
            {options.isError && <div className="projects-options-state projects-error" role="alert"><strong>Creation options could not be loaded.</strong><span>{errorMessage(options.error)}</span><button type="button" onClick={() => void options.refetch()}>Retry</button></div>}
            {unavailable && <div className="projects-options-state projects-error" role="alert"><strong>Project creation is not ready yet.</strong><span>{!options.data.leads.length ? 'No active Members are available to lead a Project.' : 'No persisted Departments are available.'}</span></div>}
            {options.isSuccess && !unavailable && <>
              <label className="projects-field">
                <span>Project Lead</span>
                <select {...register('leadMemberId')} aria-invalid={Boolean(errors.leadMemberId)} defaultValue="">
                  <option value="" disabled>Choose an active Member</option>
                  {options.data.leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.fullName} - {lead.email}</option>)}
                </select>
                {errors.leadMemberId?.message && <small>{errors.leadMemberId.message}</small>}
              </label>
              <fieldset className="projects-department-field" aria-describedby="project-departments-help">
                <legend>Departments involved</legend>
                <p id="project-departments-help">Choose one or more existing departments.</p>
                <div className="projects-department-options">
                  {options.data.departments.map((department) => <label key={department.id}><input type="checkbox" value={department.id} {...register('departmentIds')} /><span>{department.name}<small>{department.shortLabel}</small></span></label>)}
                </div>
                {errors.departmentIds?.message && <small className="projects-field-error">{errors.departmentIds.message}</small>}
              </fieldset>
            </>}
          </div>
          {Boolean(saveError) && <div className="projects-save-error" role="alert">{errorMessage(saveError)}</div>}
          <footer className="projects-dialog-actions">
            <button type="button" className="projects-secondary-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="projects-primary-button" disabled={isSaving || !options.isSuccess || unavailable}>{isSaving ? 'Creating...' : 'Create Project'}</button>
          </footer>
        </form>
      </section>
    </div>, document.body,
  );
}
