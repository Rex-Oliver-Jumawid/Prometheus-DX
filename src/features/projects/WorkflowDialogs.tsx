import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import type {
  ProjectDepartmentSummary,
  ProjectMemberSummary,
} from '../../../shared/contracts/project';
import {
  CreateOutcomeRequestSchema,
  CreateStageRequestSchema,
  UpdateOutcomeRequestSchema,
  UpdateStageRequestSchema,
  type CreateOutcomeRequest,
  type CreateStageRequest,
  type Outcome,
  type Stage,
} from '../../../shared/contracts/project-workflow';

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function useAccessibleDialog(
  dialogRef: React.RefObject<HTMLElement | null>,
  isSaving: boolean,
  onClose: () => void,
  focusSelector: string,
) {
  const restoreFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const restoreFocusTo = restoreFocusRef.current;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(focusSelector)?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      restoreFocusTo?.focus();
    };
  }, [dialogRef, focusSelector]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
        return;
      }
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
  }, [dialogRef, isSaving, onClose]);
}

export function DeleteConfirmationDialog({
  type,
  name,
  stageOutcomeCount,
  isDeleting,
  deleteError,
  onClose,
  onConfirm,
}: {
  type: 'stage' | 'outcome';
  name: string;
  stageOutcomeCount?: number;
  isDeleting: boolean;
  deleteError: unknown;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  useAccessibleDialog(dialogRef, isDeleting, onClose, '#delete-confirm-cancel');

  const handleConfirm = async () => {
    if (submittingRef.current || isDeleting) return;
    submittingRef.current = true;
    try {
      await onConfirm();
    } catch {
      submittingRef.current = false;
    }
  };

  const isStage = type === 'stage';
  const title = isStage ? 'Delete Stage' : 'Delete Outcome';

  return createPortal(
    <div
      className="projects-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="projects-dialog pw-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
      >
        <div className="projects-dialog-header pw-delete-dialog-header">
          <div className="pw-delete-icon-wrap" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <h2 id="delete-dialog-title">{title}</h2>
            <p className="vw-modal-subtitle">
              {isStage
                ? 'This removes the Stage and deletable child Outcomes. Protected work or delivery history still prevents deletion.'
                : 'This removes the Outcome and its assignments. Protected work, delivery, or dependency history still prevents deletion.'}
            </p>
          </div>
        </div>

        <div
          className="projects-dialog-body pw-delete-dialog-body"
          id="delete-dialog-desc"
        >
          <p className="pw-delete-confirm-message">
            Are you sure you want to delete {isStage ? 'stage' : 'outcome'}{' '}
            <strong className="pw-delete-item-name">{name}</strong>?
          </p>

          {isStage &&
            typeof stageOutcomeCount === 'number' &&
            stageOutcomeCount > 0 && (
              <div className="pw-delete-warning-box">
                <span className="pw-delete-warning-icon" aria-hidden="true">
                  ⚠
                </span>
                <span>
                  This stage contains <strong>{stageOutcomeCount}</strong>{' '}
                  outcome
                  {stageOutcomeCount === 1 ? '' : 's'}. All child outcomes will
                  also be deleted. If any outcome has work, submission,
                  acceptance, revision, or dependency history, deletion will be
                  prevented.
                </span>
              </div>
            )}

          {deleteError ? (
            <div className="projects-form-banner error" role="alert">
              {errorMessage(deleteError)}
            </div>
          ) : null}
        </div>

        <div className="projects-dialog-actions pw-delete-dialog-actions">
          <button
            id="delete-confirm-cancel"
            type="button"
            className="projects-secondary-button"
            disabled={isDeleting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pw-delete-confirm-btn"
            disabled={isDeleting}
            onClick={() => void handleConfirm()}
          >
            {isDeleting
              ? 'Deleting...'
              : isStage
                ? 'Delete Stage'
                : 'Delete Outcome'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function StageDialog({
  stage,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  stage?: Stage;
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: CreateStageRequest) => Promise<unknown>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  useAccessibleDialog(dialogRef, isSaving, onClose, '#workflow-stage-name');
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<CreateStageRequest>({
    defaultValues: {
      name: stage?.name ?? '',
      description: stage?.description ?? '',
    },
  });
  const submit = handleSubmit(async (values) => {
    if (submittingRef.current) return;
    const schema = stage ? UpdateStageRequestSchema : CreateStageRequestSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'description') {
          setError(field, { type: 'validate', message: issue.message });
        }
      }
      return;
    }
    submittingRef.current = true;
    try {
      await onSave(parsed.data);
    } catch {
      submittingRef.current = false;
      // The mutation error remains visible without discarding the form.
    }
  });

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
        className="vw-add-project-dialog workflow-stage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-stage-dialog-title"
      >
        <header className="vw-add-project-header">
          <div>
            <div className="vw-add-project-kicker">PROJECT STAGE</div>
            <h2
              id="workflow-stage-dialog-title"
              className="vw-add-project-title"
            >
              {stage ? 'Edit project stage' : 'Add project stage'}
            </h2>
            <p className="vw-modal-subtitle">
              Stages organize the Project workflow into a deterministic
              sequence.
            </p>
          </div>
          <button
            type="button"
            className="vw-add-project-close"
            aria-label="Close Stage dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ✕
          </button>
        </header>
        <form className="vw-add-project-form" onSubmit={submit} noValidate>
          <div className="vw-add-project-body">
            <div className="vw-add-project-field">
              <label htmlFor="workflow-stage-name">Stage name</label>
              <input
                id="workflow-stage-name"
                {...register('name')}
                placeholder="e.g. Discovery & Planning"
                aria-invalid={Boolean(errors.name)}
                autoComplete="off"
              />
              {errors.name?.message && (
                <small className="projects-field-error">
                  {errors.name.message}
                </small>
              )}
            </div>
            <div className="vw-add-project-preview">
              {stage
                ? 'The Stage keeps its current position and Outcomes.'
                : 'The Stage will be added after the existing workflow stages.'}
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
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : stage ? 'Save stage' : 'Create stage'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

type OutcomeFormValues = Omit<CreateOutcomeRequest, 'acceptanceCriteria'> & {
  acceptanceCriteria: { value: string }[];
};

export function OutcomeDialog({
  stage,
  stages,
  outcome,
  departments,
  members,
  availablePrerequisites,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  stage: Stage;
  stages?: Stage[];
  outcome?: Outcome;
  departments: ProjectDepartmentSummary[];
  members: ProjectMemberSummary[];
  availablePrerequisites: Outcome[];
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (
    input: CreateOutcomeRequest,
    targetStageId?: string,
  ) => Promise<unknown>;
}) {
  const [selectedStageId, setSelectedStageId] = useState(stage.id);
  const dialogRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  useAccessibleDialog(dialogRef, isSaving, onClose, '#workflow-outcome-title');
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<OutcomeFormValues>({
    defaultValues: {
      title: outcome?.title ?? '',
      description: outcome?.description ?? '',
      departmentIds: outcome?.departments.map(({ id }) => id) ?? [],
      memberIds: outcome?.members?.map(({ id }) => id) ?? [],
      acceptanceCriteria: outcome?.acceptanceCriteria.map(
        ({ description }) => ({
          value: description,
        }),
      ) ?? [{ value: '' }],
      prerequisiteOutcomeIds: outcome?.prerequisites.map(({ id }) => id) ?? [],
    },
  });
  const criteria = useFieldArray({ control, name: 'acceptanceCriteria' });
  const submit = handleSubmit(async (values) => {
    if (submittingRef.current) return;
    const input = {
      ...values,
      acceptanceCriteria: values.acceptanceCriteria.map(({ value }) => value),
    };
    const schema = outcome
      ? UpdateOutcomeRequestSchema
      : CreateOutcomeRequestSchema;
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'title' ||
          field === 'description' ||
          field === 'departmentIds' ||
          field === 'memberIds' ||
          field === 'acceptanceCriteria' ||
          field === 'prerequisiteOutcomeIds'
        ) {
          setError(field, { type: 'validate', message: issue.message });
        }
      }
      return;
    }
    submittingRef.current = true;
    try {
      await onSave(parsed.data, selectedStageId);
    } catch {
      submittingRef.current = false;
      // The mutation error remains visible without discarding the form.
    }
  });

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
        className="vw-add-project-dialog workflow-outcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-outcome-dialog-title"
      >
        <header className="vw-add-project-header">
          <div>
            <div className="vw-add-project-kicker">PROJECT EDITING</div>
            <h2
              id="workflow-outcome-dialog-title"
              className="vw-add-project-title"
            >
              {outcome ? 'Edit project outcome' : 'Add project outcome'}
            </h2>
          </div>
          <button
            type="button"
            className="vw-add-project-close"
            aria-label="Close Outcome dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ✕
          </button>
        </header>
        <form className="vw-add-project-form" onSubmit={submit} noValidate>
          <div className="vw-add-project-body">
            <div className="vw-add-project-field">
              <label htmlFor="workflow-outcome-stage">Stage</label>
              {stages && stages.length > 1 && !outcome ? (
                <select
                  id="workflow-outcome-stage"
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(e.target.value)}
                  disabled={isSaving}
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="workflow-outcome-stage"
                  value={stage.name}
                  disabled
                />
              )}
            </div>

            <div className="vw-add-project-field">
              <label>
                Departments{' '}
                <span className="pw-field-hint">Select one or more</span>
              </label>
              <div
                className="pw-multi-check-grid pw-department-check-grid"
                role="group"
                aria-label="Departments involved"
              >
                {departments.map((department) => (
                  <label key={department.id}>
                    <input
                      type="checkbox"
                      value={department.id}
                      {...register('departmentIds')}
                    />
                    <span>
                      {department.name}{' '}
                      <small
                        style={{
                          opacity: 0.65,
                          fontSize: '0.85em',
                          marginLeft: 4,
                        }}
                      >
                        {department.shortLabel}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              {errors.departmentIds?.message && (
                <small className="projects-field-error">
                  {errors.departmentIds.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field">
              <label>
                Members{' '}
                <span className="pw-field-hint">Select one or more</span>
              </label>
              {members.length > 0 ? (
                <div
                  className="pw-multi-check-grid pw-member-check-grid"
                  role="group"
                  aria-label="Members involved"
                >
                  {members.map((member) => (
                    <label key={member.id}>
                      <input
                        type="checkbox"
                        value={member.id}
                        {...register('memberIds')}
                      />
                      <span>{member.fullName}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="vw-empty-note">No active members available.</p>
              )}
              {errors.memberIds?.message && (
                <small className="projects-field-error">
                  {errors.memberIds.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field">
              <label htmlFor="workflow-outcome-title">Outcome</label>
              <input
                id="workflow-outcome-title"
                {...register('title')}
                aria-label="Outcome title"
                placeholder="Expected result"
                aria-invalid={Boolean(errors.title)}
                autoComplete="off"
              />
              {errors.title?.message && (
                <small className="projects-field-error">
                  {errors.title.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field">
              <label htmlFor="workflow-outcome-description">
                Outcome description{' '}
                <span className="pw-field-hint">Optional</span>
              </label>
              <textarea
                id="workflow-outcome-description"
                aria-label="Outcome description Optional"
                {...register('description')}
                placeholder="Briefly describe what this outcome should achieve."
                aria-invalid={Boolean(errors.description)}
                rows={3}
              />
              {errors.description?.message && (
                <small className="projects-field-error">
                  {errors.description.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field pw-criteria-builder">
              <div className="pw-criteria-builder-head">
                <div>
                  <label>
                    Acceptance criteria{' '}
                    <span className="pw-field-hint">
                      Checklist for project review
                    </span>
                  </label>
                  <p>
                    Define exactly what must be true before this outcome can be
                    accepted.
                  </p>
                </div>
                <button
                  type="button"
                  className="pw-add-criterion-btn"
                  onClick={() => criteria.append({ value: '' })}
                >
                  + Add criterion
                </button>
              </div>
              <div className="pw-criteria-rows">
                {criteria.fields.map((field, index) => (
                  <div className="pw-criterion-row" key={field.id}>
                    <span className="pw-criterion-number">{index + 1}</span>
                    <input
                      aria-label={`Acceptance criterion ${index + 1}`}
                      {...register(`acceptanceCriteria.${index}.value`, {
                        onChange: () => clearErrors('acceptanceCriteria'),
                      })}
                      placeholder="A verifiable result"
                    />
                    <button
                      type="button"
                      className="pw-criterion-remove"
                      aria-label={`Remove acceptance criterion ${index + 1}`}
                      onClick={() => criteria.remove(index)}
                      disabled={criteria.fields.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {errors.acceptanceCriteria?.message && (
                <small className="projects-field-error">
                  {errors.acceptanceCriteria.message}
                </small>
              )}
            </div>

            <div className="vw-add-project-field">
              <label>
                Prerequisite outcome{' '}
                <span className="pw-field-hint">Optional</span>
              </label>
              {availablePrerequisites.length ? (
                <div className="pw-multi-check-grid pw-prereq-check-grid">
                  {availablePrerequisites.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        value={item.id}
                        {...register('prerequisiteOutcomeIds')}
                      />
                      <span>{item.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="vw-empty-note">No other Outcomes exist yet.</p>
              )}
              <div className="vw-add-project-preview">
                Select a prerequisite only if this outcome must wait for another
                outcome before work begins.
              </div>
              {errors.prerequisiteOutcomeIds?.message && (
                <small className="projects-field-error">
                  {errors.prerequisiteOutcomeIds.message}
                </small>
              )}
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
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : outcome
                  ? 'Save outcome'
                  : 'Create outcome'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
