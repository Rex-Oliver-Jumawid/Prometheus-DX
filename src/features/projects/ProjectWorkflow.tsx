import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ProjectCreateOptionsResponseSchema,
  type ProjectDepartmentSummary,
} from '../../../shared/contracts/project';
import {
  CreateOutcomeRequestSchema,
  CreateStageRequestSchema,
  OutcomeSchema,
  ProjectWorkflowResponseSchema,
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
import { ProjectMembersPanel } from './ProjectMembersPanel';

const workflowKey = (projectId: string) =>
  ['projects', 'workflow', projectId] as const;

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

function lifecycleLabel(status: Outcome['lifecycleStatus']) {
  return status
    .split('_')
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(' ');
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
        className="projects-dialog workflow-stage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-stage-dialog-title"
      >
        <header className="projects-dialog-header">
          <div>
            <p className="projects-kicker">PROJECT EDITING</p>
            <h2 id="workflow-stage-dialog-title">
              {stage ? 'Edit project stage' : 'Add project stage'}
            </h2>
            <p>
              Stages organize the Project workflow into a deterministic
              sequence.
            </p>
          </div>
          <button
            type="button"
            className="projects-icon-button"
            aria-label="Close Stage dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </header>
        <form onSubmit={submit} noValidate>
          <div className="projects-dialog-body">
            <label className="projects-field">
              <span>Stage name</span>
              <input
                id="workflow-stage-name"
                {...register('name')}
                placeholder="e.g. Discovery and Planning"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name?.message && <small>{errors.name.message}</small>}
            </label>
            <label className="projects-field">
              <span>
                Description <small>Optional</small>
              </span>
              <textarea
                {...register('description')}
                placeholder="What is the purpose of this stage?"
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description?.message && (
                <small>{errors.description.message}</small>
              )}
            </label>
            <p className="workflow-form-preview">
              {stage
                ? 'The Stage keeps its current position and Outcomes.'
                : 'The Stage will be added after the existing workflow stages.'}
            </p>
          </div>
          {Boolean(saveError) && (
            <div className="projects-save-error" role="alert">
              {errorMessage(saveError)}
            </div>
          )}
          <footer className="projects-dialog-actions">
            <button
              type="button"
              className="projects-secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="projects-primary-button"
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
  outcome,
  departments,
  availablePrerequisites,
  isSaving,
  saveError,
  onClose,
  onSave,
}: {
  stage: Stage;
  outcome?: Outcome;
  departments: ProjectDepartmentSummary[];
  availablePrerequisites: Outcome[];
  isSaving: boolean;
  saveError: unknown;
  onClose: () => void;
  onSave: (input: CreateOutcomeRequest) => Promise<unknown>;
}) {
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
        className="projects-dialog workflow-outcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-outcome-dialog-title"
      >
        <header className="projects-dialog-header">
          <div>
            <p className="projects-kicker">PROJECT EDITING</p>
            <h2 id="workflow-outcome-dialog-title">
              {outcome ? 'Edit project outcome' : 'Add project outcome'}
            </h2>
            <p>
              {stage.name} - define the expected result and how it will be
              evaluated.
            </p>
          </div>
          <button
            type="button"
            className="projects-icon-button"
            aria-label="Close Outcome dialog"
            onClick={onClose}
            disabled={isSaving}
          >
            ×
          </button>
        </header>
        <form onSubmit={submit} noValidate>
          <div className="projects-dialog-body">
            <label className="projects-field">
              <span>Stage</span>
              <input value={stage.name} disabled />
            </label>
            <fieldset className="projects-department-field">
              <legend>Responsible Departments</legend>
              <p>Select one or more persisted Departments.</p>
              <div className="projects-department-options">
                {departments.map((department) => (
                  <label key={department.id}>
                    <input
                      type="checkbox"
                      value={department.id}
                      {...register('departmentIds')}
                    />
                    <span>
                      {department.name}
                      <small>{department.shortLabel}</small>
                    </span>
                  </label>
                ))}
              </div>
              {errors.departmentIds?.message && (
                <small className="projects-field-error">
                  {errors.departmentIds.message}
                </small>
              )}
            </fieldset>
            <label className="projects-field">
              <span>Outcome</span>
              <input
                id="workflow-outcome-title"
                {...register('title')}
                aria-label="Outcome title"
                placeholder="Expected result"
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title?.message && <small>{errors.title.message}</small>}
            </label>
            <label className="projects-field">
              <span>
                Outcome description <small>Optional</small>
              </span>
              <textarea
                {...register('description')}
                placeholder="Briefly describe what this Outcome should achieve."
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description?.message && (
                <small>{errors.description.message}</small>
              )}
            </label>
            <fieldset className="workflow-criteria-builder">
              <div className="workflow-criteria-header">
                <div>
                  <legend>Acceptance criteria</legend>
                  <p>
                    Define what must be true before this Outcome is accepted.
                  </p>
                </div>
                <button
                  type="button"
                  className="projects-secondary-button"
                  onClick={() => criteria.append({ value: '' })}
                >
                  + Add criterion
                </button>
              </div>
              <div className="workflow-criteria-list">
                {criteria.fields.map((field, index) => (
                  <div className="workflow-criterion-row" key={field.id}>
                    <span>{index + 1}</span>
                    <label>
                      <span className="sr-only">
                        Acceptance criterion {index + 1}
                      </span>
                      <input
                        {...register(`acceptanceCriteria.${index}.value`, {
                          onChange: () => clearErrors('acceptanceCriteria'),
                        })}
                        placeholder="A verifiable result"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove acceptance criterion ${index + 1}`}
                      onClick={() => criteria.remove(index)}
                      disabled={criteria.fields.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {errors.acceptanceCriteria?.message && (
                <small className="projects-field-error">
                  {errors.acceptanceCriteria.message}
                </small>
              )}
            </fieldset>
            <fieldset className="workflow-prerequisite-field">
              <legend>
                Prerequisite Outcomes <small>Optional</small>
              </legend>
              <p>Only Outcomes in this Project may be selected.</p>
              {availablePrerequisites.length ? (
                <div className="workflow-prerequisite-options">
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
                <p className="workflow-empty-note">
                  No other Outcomes exist yet.
                </p>
              )}
              {errors.prerequisiteOutcomeIds?.message && (
                <small className="projects-field-error">
                  {errors.prerequisiteOutcomeIds.message}
                </small>
              )}
            </fieldset>
          </div>
          {Boolean(saveError) && (
            <div className="projects-save-error" role="alert">
              {errorMessage(saveError)}
            </div>
          )}
          <footer className="projects-dialog-actions">
            <button
              type="button"
              className="projects-secondary-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="projects-primary-button"
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
  | { type: 'create-outcome'; stage: Stage }
  | { type: 'edit-outcome'; stage: Stage; outcome: Outcome }
  | null;

export function ProjectWorkflow({
  projectId,
  outcomeId,
  accessToken,
}: {
  projectId: string;
  outcomeId?: string;
  accessToken?: string;
}) {
  const [editor, setEditor] = useState<EditorState>(null);
  const queryClient = useQueryClient();
  const workflow = useQuery({
    queryKey: workflowKey(projectId),
    queryFn: ({ signal }) =>
      apiFetch(
        `/projects/${projectId}/workflow`,
        ProjectWorkflowResponseSchema,
        {
          accessToken,
          signal,
        },
      ),
    retry: false,
  });
  const options = useQuery({
    queryKey: ['projects', 'create-options'],
    queryFn: ({ signal }) =>
      apiFetch('/projects/create-options', ProjectCreateOptionsResponseSchema, {
        accessToken,
        signal,
      }),
    enabled: Boolean(
      editor && 'stage' in editor && editor.type.includes('outcome'),
    ),
    retry: false,
  });

  const closeEditor = () => setEditor(null);
  const updateWorkflowCache = (
    updater: (current: ProjectWorkflowResponse) => ProjectWorkflowResponse,
  ) => {
    queryClient.setQueryData<ProjectWorkflowResponse>(
      workflowKey(projectId),
      (current) => (current ? updater(current) : current),
    );
  };
  const completeMutation = async () => {
    closeEditor();
    await queryClient.invalidateQueries({ queryKey: workflowKey(projectId) });
  };
  const createStage = useMutation({
    mutationFn: (input: CreateStageRequest) =>
      apiFetch(`/projects/${projectId}/stages`, StageSchema, {
        accessToken,
        method: 'POST',
        body: input,
      }),
    onSuccess: async (created) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: [...current.stages, created].sort(
          (first, second) => first.position - second.position,
        ),
      }));
      await completeMutation();
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
    onSuccess: async (updated) => {
      updateWorkflowCache((current) => ({
        ...current,
        stages: current.stages.map((stage) =>
          stage.id === updated.id ? updated : stage,
        ),
      }));
      await completeMutation();
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
    onSuccess: async (created, variables) => {
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
      await completeMutation();
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
      await completeMutation();
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
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (workflow.isPending) {
    return (
      <section
        className="project-workflow-section"
        aria-label="Loading Project workflow"
      >
        <div className="projects-skeleton" />
        <p>Loading Stages and Outcomes...</p>
      </section>
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
        <div className="workflow-section-heading">
          <div>
            <Link className="project-back-link" to={`/projects/${projectId}`}>
              Back to workflow
            </Link>
            <p className="projects-kicker">
              STAGE {selectedStage.position + 1} / {selectedStage.name}
            </p>
            <h2 id="outcome-details-title">{selectedOutcome.title}</h2>
            <p>{selectedOutcome.description || 'No description provided.'}</p>
          </div>
          <div className="workflow-heading-actions">
            <span
              className={`workflow-state ${selectedOutcome.lifecycleStatus.toLowerCase()}`}
            >
              {selectedOutcome.isLocked
                ? 'Locked by prerequisite'
                : lifecycleLabel(selectedOutcome.lifecycleStatus)}
            </span>
            {selectedOutcome.isJoined ? (
              <span className="workflow-joined-badge">✓ Joined Outcome</span>
            ) : selectedOutcome.lifecycleStatus === 'ACCEPTED' ? (
              <span className="workflow-closed-note">Joining is closed</span>
            ) : (
              <button
                type="button"
                className="projects-primary-button"
                disabled={joinOutcome.isPending}
                onClick={() => void joinOutcome.mutateAsync(selectedOutcome.id)}
              >
                {joinOutcome.isPending ? 'Joining...' : '+ Join Outcome'}
              </button>
            )}
            {workflow.data.canManageStructure && (
              <button
                type="button"
                className="projects-secondary-button"
                onClick={() =>
                  setEditor({
                    type: 'edit-outcome',
                    stage: selectedStage,
                    outcome: selectedOutcome,
                  })
                }
              >
                Edit Outcome
              </button>
            )}
          </div>
        </div>
        {joinOutcome.isError && (
          <p className="project-status-error" role="alert">
            {errorMessage(joinOutcome.error)}
          </p>
        )}
        <div className="workflow-detail-grid">
          <section className="workflow-detail-card">
            <h3>Expected outcome</h3>
            <p>{selectedOutcome.description || selectedOutcome.title}</p>
          </section>
          <section className="workflow-detail-card">
            <h3>Responsible Departments</h3>
            <div className="project-detail-departments">
              {selectedOutcome.departments.map((department) => (
                <span key={department.id}>{department.name}</span>
              ))}
            </div>
          </section>
          <section className="workflow-detail-card workflow-detail-wide">
            <h3>Acceptance criteria</h3>
            <ol>
              {selectedOutcome.acceptanceCriteria.map((criterion) => (
                <li key={criterion.id}>{criterion.description}</li>
              ))}
            </ol>
          </section>
          <section className="workflow-detail-card">
            <h3>Prerequisites</h3>
            {selectedOutcome.prerequisites.length ? (
              <ul>
                {selectedOutcome.prerequisites.map((prerequisite) => (
                  <li key={prerequisite.id}>
                    {prerequisite.title} -{' '}
                    {prerequisite.resolved ? 'Resolved' : 'Waiting'}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No prerequisite. This Outcome can proceed independently.</p>
            )}
          </section>
          <section className="workflow-detail-card">
            <h3>Outcome Members</h3>
            <p>
              {selectedOutcome.members.length
                ? selectedOutcome.members
                    .map(({ fullName }) => fullName)
                    .join(', ')
                : 'No one has joined this Outcome yet.'}
            </p>
          </section>
        </div>
        {editor?.type === 'edit-outcome' && options.isSuccess && (
          <OutcomeDialog
            stage={editor.stage}
            outcome={editor.outcome}
            departments={options.data.departments}
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
      </section>
    );
  }

  const outcomeEditor =
    editor?.type === 'create-outcome' || editor?.type === 'edit-outcome'
      ? editor
      : null;
  return (
    <section
      className="project-workflow-section"
      aria-labelledby="project-workflow-title"
    >
      <div className="workflow-section-heading">
        <div>
          <p className="projects-kicker">PROJECT WORKSPACE</p>
          <h2 id="project-workflow-title">Stages and Outcomes</h2>
          <p>
            Follow the Project from expected result to expected result. Outcome
            participation remains opt-in.
          </p>
        </div>
        {workflow.data.canManageStructure && (
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => setEditor({ type: 'create-stage' })}
          >
            + Add Stage
          </button>
        )}
      </div>
      {workflow.data.stages.length === 0 ? (
        <div className="projects-state-card workflow-empty-state">
          <strong>No Stages yet</strong>
          <p>
            {workflow.data.canManageStructure
              ? 'Add the first Stage to begin structuring this Project.'
              : 'The Project Lead has not added workflow structure yet.'}
          </p>
        </div>
      ) : (
        <div className="workflow-stage-rail">
          {workflow.data.stages.map((stage) => (
            <article className="workflow-stage" key={stage.id}>
              <header>
                <div>
                  <span>
                    Stage {String(stage.position + 1).padStart(2, '0')}
                  </span>
                  <h3>{stage.name}</h3>
                  {stage.description && <p>{stage.description}</p>}
                </div>
                {workflow.data.canManageStructure && (
                  <button
                    type="button"
                    className="workflow-icon-button"
                    aria-label={`Edit Stage ${stage.name}`}
                    onClick={() => setEditor({ type: 'edit-stage', stage })}
                  >
                    Edit
                  </button>
                )}
              </header>
              <div className="workflow-outcome-list">
                {stage.outcomes.map((outcome) => (
                  <article className="workflow-outcome-card" key={outcome.id}>
                    <div className="workflow-outcome-meta">
                      <span
                        className={`workflow-state ${outcome.lifecycleStatus.toLowerCase()}`}
                      >
                        {outcome.isLocked
                          ? 'Locked'
                          : lifecycleLabel(outcome.lifecycleStatus)}
                      </span>
                      {workflow.data.canManageStructure && (
                        <button
                          type="button"
                          aria-label={`Edit Outcome ${outcome.title}`}
                          onClick={() =>
                            setEditor({ type: 'edit-outcome', stage, outcome })
                          }
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    <h4>{outcome.title}</h4>
                    <p>{outcome.description || 'No description provided.'}</p>
                    <div className="workflow-outcome-departments">
                      {outcome.departments.map((department) => (
                        <span key={department.id}>{department.shortLabel}</span>
                      ))}
                    </div>
                    {outcome.prerequisites.length > 0 && (
                      <p className="workflow-prerequisite-note">
                        Waiting on:{' '}
                        {outcome.prerequisites
                          .map(({ title }) => title)
                          .join(', ')}
                      </p>
                    )}
                    <Link to={`/projects/${projectId}/outcomes/${outcome.id}`}>
                      Outcome Details <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
                {stage.outcomes.length === 0 && (
                  <p className="workflow-stage-empty">
                    No Outcomes in this Stage.
                  </p>
                )}
              </div>
              {workflow.data.canManageStructure && (
                <button
                  type="button"
                  className="workflow-add-outcome"
                  onClick={() => setEditor({ type: 'create-outcome', stage })}
                >
                  + Add Outcome
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <ProjectMembersPanel projectId={projectId} accessToken={accessToken} />
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
      {outcomeEditor && options.isPending && (
        <div className="workflow-editor-loading" role="status">
          Loading Outcome options...
        </div>
      )}
      {outcomeEditor && options.isError && (
        <div className="workflow-editor-loading" role="alert">
          Outcome options could not be loaded.
          <button type="button" onClick={() => void options.refetch()}>
            Retry
          </button>
          <button type="button" onClick={closeEditor}>
            Cancel
          </button>
        </div>
      )}
      {outcomeEditor && options.isSuccess && (
        <OutcomeDialog
          stage={outcomeEditor.stage}
          outcome={
            outcomeEditor.type === 'edit-outcome'
              ? outcomeEditor.outcome
              : undefined
          }
          departments={options.data.departments}
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
          onSave={(input) =>
            outcomeEditor.type === 'edit-outcome'
              ? updateOutcome.mutateAsync({
                  outcomeId: outcomeEditor.outcome.id,
                  input,
                })
              : createOutcome.mutateAsync({
                  stageId: outcomeEditor.stage.id,
                  input,
                })
          }
        />
      )}
    </section>
  );
}
