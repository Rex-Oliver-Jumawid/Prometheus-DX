import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  type ProjectDepartmentSummary,
  type ProjectMemberSummary,
} from '../../../shared/contracts/project';
import {
  CreateOutcomeRequestSchema,
  CreateStageRequestSchema,
  OutcomeSchema,
  StageSchema,
  UpdateOutcomeRequestSchema,
  UpdateStageRequestSchema,
  type CreateOutcomeRequest,
  type CreateStageRequest,
  type Outcome,
  type ProjectWorkflowResponse,
  type Stage,
} from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';
import { OutcomeWorkArea } from './OutcomeWorkArea';
import { OutcomeDeliveryPanel } from './OutcomeDeliveryPanel';
import { OutcomeContextRail } from './OutcomeContextRail';
import {
  projectCreateOptionsQuery,
  projectKeys,
  projectWorkflowQuery,
} from './project-queries';

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

const DeleteMutationResponseSchema = z.object({ success: z.boolean() });

function lifecycleLabel(status: Outcome['lifecycleStatus']) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
}

function deptClass(shortLabel: string) {
  const norm = shortLabel.toLowerCase();
  if (norm.includes('sem') || norm.includes('s&m') || norm.includes('sm'))
    return 'sm';
  if (norm.includes('rd') || norm.includes('r&d')) return 'rd';
  if (norm.includes('creative') || norm.includes('design')) return 'creative';
  return 'general';
}

function getOutcomeBadge(outcome: Outcome) {
  if (outcome.lifecycleStatus === 'ACCEPTED') {
    return { className: 'accepted', label: 'ACCEPTED' };
  }
  if (outcome.isLocked) {
    return { className: 'locked', label: 'LOCKED' };
  }
  if (outcome.lifecycleStatus === 'OPEN' && outcome.hasForReview) {
    return { className: 'review', label: 'FOR REVIEW' };
  }
  if (outcome.lifecycleStatus === 'OPEN') {
    return { className: 'progress', label: 'IN PROGRESS' };
  }
  return { className: 'revision', label: 'FOR REVISION' };
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.7 2.3a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L6.1 12.9 2.5 13.5l.6-3.6 7.6-7.6Z" />
      <path d="m9.6 3.4 3 3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function getOutcomeAction(outcome: Outcome, isLead?: boolean) {
  if (isLead) {
    if (outcome.lifecycleStatus === 'ACCEPTED') {
      return 'View Accepted Output';
    }
    if (outcome.hasForReview) {
      return 'Verify Output';
    }
    if (outcome.lifecycleStatus === 'OPEN') {
      return 'Open workspace';
    }
    return 'View Revision Request';
  }
  if (outcome.lifecycleStatus === 'ACCEPTED') {
    return 'View Accepted Output';
  }
  if (outcome.isLocked) {
    return 'View workspace';
  }
  return 'Open workspace';
}

function AcceptanceProgress({
  outcomes,
  label,
}: {
  outcomes: Outcome[];
  label: string;
}) {
  const accepted = outcomes.filter(
    (outcome) => outcome.lifecycleStatus === 'ACCEPTED',
  ).length;
  return (
    <div className="outcome-work-progress" aria-label={label}>
      <span>
        {accepted} / {outcomes.length} Outcomes accepted
      </span>
      {outcomes.length ? (
        <>
          <strong>{Math.round((accepted / outcomes.length) * 100)}%</strong>
          <progress aria-label={label} value={accepted} max={outcomes.length} />
        </>
      ) : (
        <span>Progress unavailable</span>
      )}
    </div>
  );
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

function DeleteConfirmationDialog({
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
              This action permanently removes the record if it has no protected history.
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
                  This stage contains <strong>{stageOutcomeCount}</strong> outcome
                  {stageOutcomeCount === 1 ? '' : 's'}. All child outcomes will
                  also be deleted. If any outcome has permanent memberships,
                  submissions, or dependents, deletion will be prevented.
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

function StageDialog({
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

function OutcomeDialog({
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
                      Checklist for Project Lead review
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

type EditorState =
  | { type: 'create-stage' }
  | { type: 'edit-stage'; stage: Stage }
  | { type: 'delete-stage'; stage: Stage }
  | { type: 'create-outcome'; stage: Stage }
  | { type: 'edit-outcome'; stage: Stage; outcome: Outcome }
  | { type: 'delete-outcome'; stage: Stage; outcome: Outcome }
  | null;

export function ProjectWorkflow({
  projectId,
  outcomeId,
  accessToken,
  isLead,
}: {
  projectId: string;
  outcomeId?: string;
  accessToken?: string;
  isLead?: boolean;
}) {
  const navigate = useNavigate();
  const [editor, setEditor] = useState<EditorState>(null);
  const [scope, setScope] = useState<'whole' | 'mine'>('whole');
  const queryClient = useQueryClient();
  const workflow = useQuery({
    ...projectWorkflowQuery(projectId, accessToken),
  });
  const options = useQuery({
    ...projectCreateOptionsQuery(accessToken),
    enabled: Boolean(workflow.data?.canManageStructure || accessToken),
    staleTime: 5 * 60 * 1000,
  });

  const closeEditor = () => setEditor(null);
  const updateWorkflowCache = (
    updater: (current: ProjectWorkflowResponse) => ProjectWorkflowResponse,
  ) => {
    queryClient.setQueryData<ProjectWorkflowResponse>(
      projectKeys.workflow(projectId),
      (current) => (current ? updater(current) : current),
    );
  };
  const completeMutation = () => {
    closeEditor();
    void queryClient.invalidateQueries({
      queryKey: projectKeys.workflow(projectId),
    });
  };
  const createStage = useMutation({
    mutationFn: (input: CreateStageRequest) =>
      apiFetch(`/projects/${projectId}/stages`, StageSchema, {
        accessToken,
        method: 'POST',
        body: input,
      }),
    onSuccess: (created) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: [...current.stages, created].sort(
          (first, second) => first.position - second.position,
        ),
      }));
      completeMutation();
    },
  });
  const updateStage = useMutation({
    mutationFn: ({
      stageId,
      input,
    }: {
      stageId: string;
      input: CreateStageRequest;
    }) =>
      apiFetch(`/projects/${projectId}/stages/${stageId}`, StageSchema, {
        accessToken,
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (updated) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === updated.id ? updated : stage,
        ),
      }));
      completeMutation();
    },
  });
  const createOutcome = useMutation({
    mutationFn: ({
      stageId,
      input,
    }: {
      stageId: string;
      input: CreateOutcomeRequest;
    }) =>
      apiFetch(
        `/projects/${projectId}/stages/${stageId}/outcomes`,
        OutcomeSchema,
        {
          accessToken,
          method: 'POST',
          body: input,
        },
      ),
    onSuccess: (created, variables) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === variables.stageId
            ? {
                ...stage,
                outcomes: [...stage.outcomes, created].sort(
                  (first, second) => first.position - second.position,
                ),
              }
            : stage,
        ),
      }));
      completeMutation();
    },
  });
  const updateOutcome = useMutation({
    mutationFn: ({
      outcomeId: id,
      input,
    }: {
      outcomeId: string;
      input: CreateOutcomeRequest;
    }) =>
      apiFetch(`/projects/${projectId}/outcomes/${id}`, OutcomeSchema, {
        accessToken,
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (updated) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) => ({
          ...stage,
          outcomes: stage.outcomes.map((outcome) =>
            outcome.id === updated.id ? updated : outcome,
          ),
        })),
      }));
      completeMutation();
    },
  });
  const joinOutcome = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/projects/${projectId}/outcomes/${id}/join`, OutcomeSchema, {
        accessToken,
        method: 'POST',
      }),
    onSuccess: async (updated) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) => ({
          ...stage,
          outcomes: stage.outcomes.map((outcome) =>
            outcome.id === updated.id ? updated : outcome,
          ),
        })),
      }));
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(projectId),
        }),
      ]);
    },
  });
  const deleteStage = useMutation({
    mutationFn: (stageId: string) =>
      apiFetch(
        `/projects/${projectId}/stages/${stageId}`,
        DeleteMutationResponseSchema,
        {
          accessToken,
          method: 'DELETE',
        },
      ),
    onSuccess: (_, stageId) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages
          .filter((stage) => stage.id !== stageId)
          .sort((first, second) => first.position - second.position),
      }));
      completeMutation();
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(projectId),
        }),
      ]);
    },
  });
  const deleteOutcome = useMutation({
    mutationFn: ({
      outcomeId: id,
    }: {
      stageId: string;
      outcomeId: string;
    }) =>
      apiFetch(
        `/projects/${projectId}/outcomes/${id}`,
        DeleteMutationResponseSchema,
        {
          accessToken,
          method: 'DELETE',
        },
      ),
    onSuccess: (_, variables) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === variables.stageId
            ? {
                ...stage,
                outcomes: stage.outcomes
                  .filter((item) => item.id !== variables.outcomeId)
                  .sort((first, second) => first.position - second.position),
              }
            : stage,
        ),
      }));
      completeMutation();
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.list }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(projectId),
        }),
      ]);
      if (outcomeId === variables.outcomeId) {
        navigate(`/projects/${projectId}`);
      }
    },
  });

  if (workflow.isPending) {
    return (
      <div
        className="pw-board-skeleton-wrap"
        aria-label="Loading Stages and Outcomes"
      >
        <div className="pw-board-skeleton">
          <div className="pw-stage-column-skeleton" />
          <div className="pw-stage-column-skeleton" />
          <div className="pw-stage-column-skeleton" />
        </div>
      </div>
    );
  }
  if (workflow.isError || !workflow.data) {
    return (
      <section
        className="projects-state-card project-workflow-section"
        role="alert"
      >
        <strong>Project workflow could not be loaded.</strong>
        <p>{errorMessage(workflow.error)}</p>
        <button
          type="button"
          className="projects-secondary-button"
          onClick={() => void workflow.refetch()}
        >
          Retry
        </button>
      </section>
    );
  }

  const allOutcomes = workflow.data.stages.flatMap((stage) => stage.outcomes);
  const selectedOutcome = outcomeId
    ? allOutcomes.find((item) => item.id === outcomeId)
    : undefined;
  const selectedStage = selectedOutcome
    ? workflow.data.stages.find((stage) => stage.id === selectedOutcome.stageId)
    : undefined;

  if (outcomeId && (!selectedOutcome || !selectedStage)) {
    return (
      <section className="projects-state-card project-workflow-section">
        <strong>Outcome not found</strong>
        <p>This Outcome does not belong to the requested Project.</p>
        <Link className="projects-secondary-link" to={`/projects/${projectId}`}>
          Back to Project Workspace
        </Link>
      </section>
    );
  }

  if (selectedOutcome && selectedStage) {
    return (
      <section
        className="project-workflow-section workflow-outcome-details"
        aria-labelledby="outcome-details-title"
      >
        {/* Navigation row above header card */}
        <div className="pw-workspace-navigation">
          <Link
            to={`/projects/${projectId}`}
            className="workspace-back-button"
            aria-label="Back to Project Workspace"
          >
            <span>←</span>
            <span>Back to Content</span>
          </Link>
          <div className="pw-workspace-nav-meta">
            {selectedOutcome.isJoined ? (
              <span className="pw-joined-badge">✓ Joined outcome</span>
            ) : selectedOutcome.lifecycleStatus === 'ACCEPTED' ? (
              <span className="workflow-closed-note">Joining is closed</span>
            ) : (
              <button
                type="button"
                className="pw-join-button"
                disabled={joinOutcome.isPending}
                onClick={() => void joinOutcome.mutateAsync(selectedOutcome.id)}
              >
                {joinOutcome.isPending ? 'Joining...' : '+ Join outcome'}
              </button>
            )}
            {isLead ? (
              <button
                type="button"
                className="pw-workspace-tag pw-outcome-details-trigger"
                onClick={() =>
                  setEditor({
                    type: 'edit-outcome',
                    stage: selectedStage,
                    outcome: selectedOutcome,
                  })
                }
              >
                <span>Outcome Details</span>
                <span className="pw-outcome-details-pencil" aria-hidden="true">
                  <PencilIcon />
                </span>
              </button>
            ) : (
              <span className="pw-workspace-tag">Outcome workspace</span>
            )}
          </div>
        </div>

        {joinOutcome.isError && (
          <p className="project-status-error" role="alert">
            {errorMessage(joinOutcome.error)}
          </p>
        )}

        {!selectedOutcome.isJoined && !isLead && (
          <div className="pw-readonly-note">
            {selectedOutcome.lifecycleStatus === 'ACCEPTED'
              ? 'This outcome is accepted and closed. You can inspect its work and submission history, but joining and new contributions are disabled.'
              : 'You can inspect this outcome. Join it to contribute features, tasks, and output submissions.'}
          </div>
        )}

        {/* Outcome Header Card */}
        <section
          className="outcome-workspace-header"
          aria-labelledby="outcome-details-title"
        >
          <div className="workspace-header-main">
            <div className="workspace-heading-copy">
              <div className="workspace-kicker-row">
                <span className="workspace-accent-line" aria-hidden="true" />
                <p className="kicker">
                  {selectedStage.name.toUpperCase()} /{' '}
                  {selectedOutcome.departments[0]?.name.toUpperCase() ||
                    'OUTCOME'}
                </p>
              </div>
              <h2 id="outcome-details-title" className="workspace-title">
                {selectedOutcome.title}
              </h2>
              <p className="workspace-desc">
                {selectedOutcome.description ||
                  (isLead
                    ? `You are supervising this outcome. Review the combined work and all team submissions before making the final outcome decision.`
                    : selectedOutcome.isJoined
                      ? 'You are participating in this outcome. Its workspace keeps features, tasks, outputs, and history together.'
                      : 'You can inspect this outcome workspace. Join it if you want to contribute to its features and tasks.')}
              </p>
            </div>
            <div className="pw-workspace-state-actions">
              <span
                className={`workflow-state ${selectedOutcome.lifecycleStatus.toLowerCase()}`}
              >
                {selectedOutcome.isLocked
                  ? 'Locked by prerequisite'
                  : selectedOutcome.lifecycleStatus === 'OPEN' &&
                      selectedOutcome.hasForReview
                    ? 'For Review'
                    : lifecycleLabel(selectedOutcome.lifecycleStatus)}
              </span>
              {isLead && (
                <button
                  type="button"
                  className="projects-secondary-button pw-outcome-detail-delete-btn"
                  onClick={() =>
                    setEditor({
                      type: 'delete-outcome',
                      stage: selectedStage,
                      outcome: selectedOutcome,
                    })
                  }
                >
                  Delete Outcome
                </button>
              )}
            </div>
          </div>

          {/* Expected Outcome callout */}
          <div className="acceptance-block">
            <div className="expected-icon" aria-hidden="true">
              ◎
            </div>
            <div className="expected-content">
              <div className="acceptance-label">Expected outcome</div>
              <div className="acceptance-text">
                {selectedOutcome.description || selectedOutcome.title}
              </div>
            </div>
          </div>

          {/* Acceptance Criteria Chips */}
          <div className="acceptance-criteria-wrap">
            <div className="acceptance-label">Acceptance criteria</div>
            <div className="criteria-list">
              {selectedOutcome.acceptanceCriteria.length > 0 ? (
                selectedOutcome.acceptanceCriteria.map((criterion) => (
                  <span key={criterion.id} className="criterion-pill">
                    <span className="criterion-check" aria-hidden="true">
                      ✓
                    </span>
                    <span>{criterion.description}</span>
                  </span>
                ))
              ) : (
                <span className="criterion-pill empty">
                  No acceptance criteria specified.
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 2-Column Layout */}
        <div className="workspace-layout">
          <main className="workbench">
            <OutcomeWorkArea
              key={selectedOutcome.id}
              projectId={projectId}
              outcomeId={selectedOutcome.id}
              accessToken={accessToken}
              isJoined={selectedOutcome.isJoined}
            />
            <OutcomeDeliveryPanel
              key={`delivery-${selectedOutcome.id}`}
              projectId={projectId}
              outcomeId={selectedOutcome.id}
              accessToken={accessToken}
              isJoined={selectedOutcome.isJoined}
            />
          </main>
          <OutcomeContextRail
            projectId={projectId}
            outcomeId={selectedOutcome.id}
            accessToken={accessToken}
            isJoined={selectedOutcome.isJoined}
            outcome={selectedOutcome}
          />
        </div>
        {editor?.type === 'edit-outcome' && options.isSuccess && (
          <OutcomeDialog
            stage={editor.stage}
            stages={workflow.data.stages}
            outcome={editor.outcome}
            departments={options.data.departments}
            members={options.data.leads}
            availablePrerequisites={allOutcomes.filter(
              (item) => item.id !== editor.outcome.id,
            )}
            isSaving={updateOutcome.isPending}
            saveError={updateOutcome.error}
            onClose={closeEditor}
            onSave={(input) =>
              updateOutcome.mutateAsync({
                outcomeId: editor.outcome.id,
                input,
              })
            }
          />
        )}
        {editor?.type === 'delete-outcome' && (
          <DeleteConfirmationDialog
            type="outcome"
            name={editor.outcome.title}
            isDeleting={deleteOutcome.isPending}
            deleteError={deleteOutcome.error}
            onClose={closeEditor}
            onConfirm={() =>
              deleteOutcome.mutateAsync({
                stageId: editor.stage.id,
                outcomeId: editor.outcome.id,
              })
            }
          />
        )}
      </section>
    );
  }

  const outcomeEditor =
    editor?.type === 'create-outcome' || editor?.type === 'edit-outcome'
      ? editor
      : null;
  const scopedOutcomes =
    scope === 'mine'
      ? allOutcomes.filter((item) => item.isJoined)
      : allOutcomes;
  const visibleStages =
    scope === 'mine'
      ? workflow.data.stages.filter((stage) =>
          stage.outcomes.some((outcome) => outcome.isJoined),
        )
      : workflow.data.stages;

  return (
    <section
      className="project-workflow-section pw-content-tab-section"
      aria-labelledby="project-workflow-title"
    >
      <div className="toolbar content-board-toolbar">
        <div>
          <h2 className="toolbar-title" id="project-workflow-title">
            <span className="sr-only">Stages and Outcomes </span>Project stages
          </h2>
          <div className="toolbar-sub" id="pwContentBoardSubtitle">
            {scope === 'mine'
              ? `My Work - ${scopedOutcomes.length} outcome${scopedOutcomes.length === 1 ? '' : 's'} joined by you.`
              : 'Whole Work - complete project visibility across every stage, department, and assigned member.'}
          </div>
        </div>
        <div className="content-board-actions scope-actions-right">
          <div
            className="board-scope-toggle"
            aria-label="Project content scope"
          >
            <button
              type="button"
              className={`board-scope-btn ${scope === 'whole' ? 'active' : ''}`}
              onClick={() => setScope('whole')}
            >
              Whole Work
            </button>
            <button
              type="button"
              className={`board-scope-btn ${scope === 'mine' ? 'active' : ''}`}
              onClick={() => setScope('mine')}
            >
              My Work
            </button>
          </div>
          {workflow.data.canManageStructure && (
            <div className="actions" id="pwContentActions">
              <button
                type="button"
                className="btn pw-outcome-button"
                disabled={workflow.data.stages.length === 0}
                onClick={() => {
                  if (workflow.data.stages.length > 0) {
                    setEditor({
                      type: 'create-outcome',
                      stage: workflow.data.stages[0],
                    });
                  }
                }}
              >
                + Outcome
              </button>
              <button
                type="button"
                className="btn primary pw-stage-button"
                onClick={() => setEditor({ type: 'create-stage' })}
              >
                + Stage
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sr-only">
        <AcceptanceProgress
          outcomes={allOutcomes}
          label="Project acceptance progress"
        />
      </div>

      {workflow.data.stages.length === 0 ? (
        <div className="board-wrap">
          <div className="board">
            <section className="pw-empty-stage-state">
              <div className="pw-empty-stage-icon">＋</div>
              <strong>No Stages yet</strong>
              <p>
                {workflow.data.canManageStructure
                  ? 'This project is blank. Create the first stage, then add outcomes inside it.'
                  : 'The Project Lead has not added workflow structure yet.'}
              </p>
              {workflow.data.canManageStructure && (
                <button
                  type="button"
                  className="btn primary pw-stage-button"
                  aria-label="+ Add Stage"
                  onClick={() => setEditor({ type: 'create-stage' })}
                >
                  + Add Stage
                </button>
              )}
            </section>
          </div>
        </div>
      ) : scope === 'mine' && visibleStages.length === 0 ? (
        <div className="board-wrap">
          <div className="board">
            <div className="projects-state-card workflow-empty-state">
              <strong>No joined Outcomes</strong>
              <p>
                No project outcomes are currently joined by you. Switch to{' '}
                <strong>Whole Work</strong> to inspect the complete project.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="board-wrap">
          <div className="board" id="pwBoard">
            {visibleStages.map((stage) => {
              const stageOutcomes =
                scope === 'mine'
                  ? stage.outcomes.filter((outcome) => outcome.isJoined)
                  : stage.outcomes;
              const acceptedCount = stage.outcomes.filter(
                (outcome) => outcome.lifecycleStatus === 'ACCEPTED',
              ).length;
              return (
                <section className="stage workflow-stage" key={stage.id}>
                  <div className="stage-head">
                    <div className="stage-num">
                      STAGE {String(stage.position + 1)}
                    </div>
                    <div className="stage-title-row">
                      <h3 className="stage-title">{stage.name}</h3>
                      <div className="stage-title-meta">
                        <span className="count">
                          {stageOutcomes.length} outcome
                          {stageOutcomes.length === 1 ? '' : 's'}
                        </span>
                        {workflow.data.canManageStructure && (
                          <div className="pw-stage-actions">
                            <button
                              type="button"
                              className="pw-stage-edit"
                              title="Rename stage"
                              aria-label={`Edit Stage ${stage.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditor({ type: 'edit-stage', stage });
                              }}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              className="pw-stage-delete"
                              title="Delete stage"
                              aria-label={`Delete Stage ${stage.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditor({ type: 'delete-stage', stage });
                              }}
                            >
                              <XIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <progress
                      aria-label={`${stage.name} acceptance progress`}
                      value={acceptedCount}
                      max={stage.outcomes.length}
                      className="sr-only"
                    />
                  </div>

                  <div className="stage-cards">
                    {(() => {
                      const prereqsInSameStage = new Set<string>();
                      stageOutcomes.forEach((o) => {
                        o.prerequisites.forEach((p) => {
                          if (stageOutcomes.some((item) => item.id === p.id)) {
                            prereqsInSameStage.add(p.id);
                          }
                        });
                      });

                      return stageOutcomes.map((outcome) => {
                        if (outcome.prerequisites.length > 0) {
                          return outcome.prerequisites.map((prereq) => {
                            const prereqOutcome = allOutcomes.find(
                              (item) => item.id === prereq.id,
                            );
                            const prereqDept =
                              prereqOutcome?.departments[0]?.shortLabel ??
                              prereqOutcome?.departments[0]?.name ??
                              'General';
                            const depDept =
                              outcome.departments[0]?.shortLabel ??
                              outcome.departments[0]?.name ??
                              'General';
                            const prereqStatusLabel = prereq.resolved
                              ? 'Resolved'
                              : prereqOutcome?.lifecycleStatus === 'ACCEPTED'
                                ? 'Accepted'
                                : prereqOutcome?.hasForReview
                                  ? 'For Review'
                                  : prereqOutcome
                                    ? lifecycleLabel(
                                        prereqOutcome.lifecycleStatus,
                                      )
                                    : 'Waiting';
                            const depStatusLabel = prereq.resolved
                              ? lifecycleLabel(outcome.lifecycleStatus)
                              : 'Locked';

                            return (
                              <article
                                key={`dependency-${prereq.id}-${outcome.id}`}
                                className="dependency-group"
                              >
                                <div className="dep-head">
                                  <span className="dep-title">DEPENDENCY</span>
                                  <span
                                    className={`dep-state ${
                                      prereq.resolved ? 'resolved' : 'waiting'
                                    }`}
                                  >
                                    {prereq.resolved ? 'RESOLVED' : 'WAITING'}
                                  </span>
                                </div>

                                <div className="dep-flow">
                                  <div className="dep-mini">
                                    <div className="dep-mini-top">
                                      <h4 className="dep-mini-title">
                                        <Link
                                          to={`/projects/${projectId}/outcomes/${prereq.id}`}
                                        >
                                          {prereqOutcome?.title ?? prereq.title}
                                        </Link>
                                      </h4>

                                    </div>
                                    <div className="dep-mini-meta">
                                      {prereqDept} · {prereqStatusLabel}
                                    </div>
                                  </div>

                                  <span
                                    className="dep-arrow"
                                    aria-hidden="true"
                                  >
                                    →
                                  </span>

                                  <div className="dep-mini">
                                    <div className="dep-mini-top">
                                      <h4 className="dep-mini-title">
                                        <Link
                                          to={`/projects/${projectId}/outcomes/${outcome.id}`}
                                        >
                                          {outcome.title}
                                        </Link>
                                      </h4>

                                    </div>
                                    <div className="dep-mini-meta">
                                      {depDept} · {depStatusLabel}
                                    </div>
                                  </div>
                                </div>

                                <div className="dep-actions-row">
                                  <Link
                                    to={`/projects/${projectId}/outcomes/${prereq.id}`}
                                    className="dep-verify-btn"
                                  >
                                    Verify prerequisite
                                  </Link>
                                  <Link
                                    to={`/projects/${projectId}/outcomes/${outcome.id}`}
                                    className="dep-skip-btn"
                                  >
                                    Skip dependency
                                  </Link>
                                </div>

                                <span className="sr-only">
                                  Prerequisites:{' '}
                                  {outcome.prerequisites
                                    .map(
                                      ({ title, resolved }) =>
                                        `${title} (${
                                          resolved ? 'Resolved' : 'Waiting'
                                        })`,
                                    )
                                    .join(', ')}
                                </span>
                              </article>
                            );
                          });
                        }

                        if (prereqsInSameStage.has(outcome.id)) {
                          return null;
                        }

                        const stateBadge = getOutcomeBadge(outcome);
                        const actionText = getOutcomeAction(outcome, isLead);

                        return (
                          <article
                            className={`outcome-card ${
                              outcome.lifecycleStatus === 'OPEN' &&
                              outcome.hasForReview
                                ? 'pw-review'
                                : ''
                            }`}
                            key={outcome.id}
                          >
                            <div className="card-top">
                              <h4 className="outcome-title">{outcome.title}</h4>
                              <div className="pw-outcome-card-actions">
                                <span
                                  className={`state ${stateBadge.className}`}
                                >
                                  {stateBadge.label}
                                </span>
                                {workflow.data.canManageStructure && (
                                  <>
                                    <button
                                      type="button"
                                      className="pw-outcome-edit-btn"
                                      title="Edit outcome"
                                      aria-label={`Edit Outcome ${outcome.title}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditor({
                                          type: 'edit-outcome',
                                          stage,
                                          outcome,
                                        });
                                      }}
                                    >
                                      <PencilIcon />
                                    </button>
                                    <button
                                      type="button"
                                      className="pw-outcome-delete-btn"
                                      title="Delete outcome"
                                      aria-label={`Delete Outcome ${outcome.title}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditor({
                                          type: 'delete-outcome',
                                          stage,
                                          outcome,
                                        });
                                      }}
                                    >
                                      <XIcon />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <p className="outcome-desc">
                              {outcome.description ||
                                'No description provided.'}
                            </p>

                            <div className="tags">
                              {outcome.departments.map((department) => (
                                <span
                                  key={department.id}
                                  className={`dept ${deptClass(
                                    department.shortLabel,
                                  )}`}
                                >
                                  {department.shortLabel}
                                </span>
                              ))}
                              {outcome.members && outcome.members.length > 0 ? (
                                outcome.members.map((member) => (
                                  <span key={member.id} className="member">
                                    {member.fullName}
                                  </span>
                                ))
                              ) : outcome.isJoined ? (
                                <span className="member">Joined</span>
                              ) : null}
                            </div>

                            <div className="card-foot">
                              <span className="tiny">
                                {outcome.lifecycleStatus === 'ACCEPTED'
                                  ? '100%'
                                  : outcome.hasForReview
                                    ? '80%'
                                    : outcome.lifecycleStatus ===
                                        'NEEDS_REVISION'
                                      ? '50%'
                                      : outcome.isJoined
                                        ? '30%'
                                        : '0%'}{' '}
                                work progress
                              </span>
                              <Link
                                to={`/projects/${projectId}/outcomes/${outcome.id}`}
                                className="pw-card-action"
                              >
                                {actionText} →
                              </Link>
                            </div>
                          </article>
                        );
                      });
                    })()}

                    {stageOutcomes.length === 0 && (
                      <p className="workflow-stage-empty">
                        No Outcomes in this Stage.
                      </p>
                    )}

                    {workflow.data.canManageStructure && (
                      <button
                        type="button"
                        className="add-outcome"
                        aria-label="+ Add Outcome"
                        onClick={() =>
                          setEditor({ type: 'create-outcome', stage })
                        }
                      >
                        + Add outcome to stage
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {(editor?.type === 'create-stage' || editor?.type === 'edit-stage') && (
        <StageDialog
          stage={editor.type === 'edit-stage' ? editor.stage : undefined}
          isSaving={
            editor.type === 'edit-stage'
              ? updateStage.isPending
              : createStage.isPending
          }
          saveError={
            editor.type === 'edit-stage' ? updateStage.error : createStage.error
          }
          onClose={closeEditor}
          onSave={(input) =>
            editor.type === 'edit-stage'
              ? updateStage.mutateAsync({ stageId: editor.stage.id, input })
              : createStage.mutateAsync(input)
          }
        />
      )}
      {editor?.type === 'delete-stage' && (
        <DeleteConfirmationDialog
          type="stage"
          name={editor.stage.name}
          stageOutcomeCount={editor.stage.outcomes.length}
          isDeleting={deleteStage.isPending}
          deleteError={deleteStage.error}
          onClose={closeEditor}
          onConfirm={() => deleteStage.mutateAsync(editor.stage.id)}
        />
      )}
      {editor?.type === 'delete-outcome' && (
        <DeleteConfirmationDialog
          type="outcome"
          name={editor.outcome.title}
          isDeleting={deleteOutcome.isPending}
          deleteError={deleteOutcome.error}
          onClose={closeEditor}
          onConfirm={() =>
            deleteOutcome.mutateAsync({
              stageId: editor.stage.id,
              outcomeId: editor.outcome.id,
            })
          }
        />
      )}
      {outcomeEditor && (
        <OutcomeDialog
          stage={outcomeEditor.stage}
          stages={workflow.data.stages}
          outcome={
            outcomeEditor.type === 'edit-outcome'
              ? outcomeEditor.outcome
              : undefined
          }
          departments={options.data?.departments ?? []}
          members={options.data?.leads ?? []}
          availablePrerequisites={allOutcomes.filter(
            (item) =>
              outcomeEditor.type !== 'edit-outcome' ||
              item.id !== outcomeEditor.outcome.id,
          )}
          isSaving={
            outcomeEditor.type === 'edit-outcome'
              ? updateOutcome.isPending
              : createOutcome.isPending
          }
          saveError={
            outcomeEditor.type === 'edit-outcome'
              ? updateOutcome.error
              : createOutcome.error
          }
          onClose={closeEditor}
          onSave={(input, targetStageId) =>
            outcomeEditor.type === 'edit-outcome'
              ? updateOutcome.mutateAsync({
                  outcomeId: outcomeEditor.outcome.id,
                  input,
                })
              : createOutcome.mutateAsync({
                  stageId: targetStageId || outcomeEditor.stage.id,
                  input,
                })
          }
        />
      )}
    </section>
  );
}
