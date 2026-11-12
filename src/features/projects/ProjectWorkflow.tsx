import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  DeleteConfirmationDialog,
  StageDialog,
  OutcomeDialog,
} from './WorkflowDialogs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { OutcomeDeliverySchema } from '../../../shared/contracts/outcome-delivery';
import {
  OutcomeSchema,
  ProjectWorkflowResponseSchema,
  StageSchema,
  type CreateOutcomeRequest,
  type CreateStageRequest,
  type MoveOutcomeRequest,
  type Outcome,
  type ProjectWorkflowResponse,
  type Stage,
} from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';
import { OutcomeWorkArea } from './OutcomeWorkArea';
import { OutcomeDeliveryPanel } from './OutcomeDeliveryPanel';
import { OutcomeContextRail } from './OutcomeContextRail';
import { ProjectDialog } from './ProjectDialog';
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

function applyOutcomeMove(
  current: ProjectWorkflowResponse,
  outcomeId: string,
  targetStageId: string,
  targetPosition: number,
): ProjectWorkflowResponse {
  const sourceStage = current.stages.find((stage) =>
    stage.outcomes.some((outcome) => outcome.id === outcomeId),
  );
  const movedOutcome = sourceStage?.outcomes.find(
    (outcome) => outcome.id === outcomeId,
  );
  const targetStage = current.stages.find(
    (stage) => stage.id === targetStageId,
  );
  if (!sourceStage || !movedOutcome || !targetStage) return current;

  return {
    ...current,
    stages: current.stages.map((stage) => {
      if (sourceStage.id === targetStageId && stage.id === sourceStage.id) {
        const outcomes = stage.outcomes.filter(
          (outcome) => outcome.id !== outcomeId,
        );
        const position = Math.min(targetPosition, outcomes.length);
        outcomes.splice(position, 0, {
          ...movedOutcome,
          stageId: targetStageId,
        });
        return {
          ...stage,
          outcomes: outcomes.map((outcome, index) => ({
            ...outcome,
            position: index,
          })),
        };
      }
      if (stage.id === sourceStage.id) {
        return {
          ...stage,
          outcomes: stage.outcomes
            .filter((outcome) => outcome.id !== outcomeId)
            .map((outcome, index) => ({ ...outcome, position: index })),
        };
      }
      if (stage.id === targetStageId) {
        const outcomes = [...stage.outcomes];
        const position = Math.min(targetPosition, outcomes.length);
        outcomes.splice(position, 0, {
          ...movedOutcome,
          stageId: targetStageId,
        });
        return {
          ...stage,
          outcomes: outcomes.map((outcome, index) => ({
            ...outcome,
            position: index,
          })),
        };
      }
      return stage;
    }),
  };
}

type OutcomeDragState = {
  outcomeId: string;
  sourceStageId: string;
};

type OutcomeDropTarget = {
  stageId: string;
  position: number;
  targetOutcomeId?: string;
  edge?: 'before' | 'after';
};

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
  const [draggedOutcome, setDraggedOutcome] = useState<OutcomeDragState | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<OutcomeDropTarget | null>(null);
  const moveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const moveRevisionRef = useRef(0);
  const [dependencyOverride, setDependencyOverride] = useState<{
    dependencyId: string;
    outcomeId: string;
    prerequisiteTitle: string;
    outcomeTitle: string;
  } | null>(null);
  const dependencyOverrideForm = useForm<{ reason: string }>({
    defaultValues: { reason: '' },
  });
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
  const moveOutcome = useMutation({
    mutationFn: ({
      outcomeId: id,
      input,
    }: {
      outcomeId: string;
      input: MoveOutcomeRequest;
      revision: number;
    }) => {
      const request = moveQueueRef.current
        .catch(() => undefined)
        .then(() =>
          apiFetch(
            `/projects/${projectId}/outcomes/${id}/move`,
            ProjectWorkflowResponseSchema,
            {
              accessToken,
              method: 'PATCH',
              body: input,
            },
          ),
        );
      moveQueueRef.current = request.then(
        () => undefined,
        () => undefined,
      );
      return request;
    },
    onMutate: async ({ outcomeId: id, input, revision }) => {
      await queryClient.cancelQueries({
        queryKey: projectKeys.workflow(projectId),
      });
      const previous = queryClient.getQueryData<ProjectWorkflowResponse>(
        projectKeys.workflow(projectId),
      );
      if (previous) {
        updateWorkflowCache((current) =>
          applyOutcomeMove(current, id, input.stageId, input.position),
        );
      }
      return { previous, revision };
    },
    onError: (_error, variables, context) => {
      if (context?.previous && variables.revision === moveRevisionRef.current) {
        queryClient.setQueryData(
          projectKeys.workflow(projectId),
          context.previous,
        );
      }
    },
    onSuccess: (updated, variables) => {
      if (variables.revision === moveRevisionRef.current) {
        queryClient.setQueryData(projectKeys.workflow(projectId), updated);
      }
    },
    onSettled: (_data, _error, variables) => {
      if (variables.revision !== moveRevisionRef.current) return;
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectKeys.workflow(projectId),
        }),
        queryClient.invalidateQueries({ queryKey: projectKeys.list }),
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(projectId),
        }),
      ]);
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
  const overrideDependency = useMutation({
    mutationFn: ({
      dependencyId,
      outcomeId: dependentOutcomeId,
      reason,
    }: {
      dependencyId: string;
      outcomeId: string;
      reason: string;
    }) =>
      apiFetch(
        `/projects/${projectId}/outcomes/${dependentOutcomeId}/delivery/dependencies/${dependencyId}/override`,
        OutcomeDeliverySchema,
        {
          accessToken,
          method: 'POST',
          body: { reason },
        },
      ),
    onSuccess: () => {
      setDependencyOverride(null);
      dependencyOverrideForm.reset();
      void queryClient.invalidateQueries({
        queryKey: projectKeys.workflow(projectId),
      });
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
        queryClient.invalidateQueries({
          queryKey: projectKeys.members(projectId),
        }),
      ]);
    },
  });
  const deleteOutcome = useMutation({
    mutationFn: ({ outcomeId: id }: { stageId: string; outcomeId: string }) =>
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
        queryClient.invalidateQueries({
          queryKey: projectKeys.members(projectId),
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
            {workflow.data.canManageStructure ? (
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

        {!selectedOutcome.isJoined && !workflow.data.canManageStructure && (
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
              {workflow.data.canManageStructure && (
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
              outcomeTitle={selectedOutcome.title}
              outcomeDescription={
                selectedOutcome.description || selectedOutcome.title
              }
              departmentLabels={selectedOutcome.departments.map(
                (department) => department.shortLabel || department.name,
              )}
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
  const canReorderOutcomes =
    workflow.data.canManageStructure && scope === 'whole';

  const clearOutcomeDrag = () => {
    setDraggedOutcome(null);
    setDropTarget(null);
  };

  const queueOutcomeMove = (
    outcomeIdToMove: string,
    stageId: string,
    position: number,
  ) => {
    const revision = ++moveRevisionRef.current;
    moveOutcome.mutate({
      outcomeId: outcomeIdToMove,
      input: { stageId, position },
      revision,
    });
  };

  const commitOutcomeMove = (stageId: string, position: number) => {
    if (!draggedOutcome) return;
    const sourceStage = workflow.data.stages.find(
      (stage) => stage.id === draggedOutcome.sourceStageId,
    );
    const sourcePosition =
      sourceStage?.outcomes.findIndex(
        (outcome) => outcome.id === draggedOutcome.outcomeId,
      ) ?? -1;
    if (
      sourcePosition < 0 ||
      (draggedOutcome.sourceStageId === stageId && sourcePosition === position)
    ) {
      clearOutcomeDrag();
      return;
    }
    queueOutcomeMove(draggedOutcome.outcomeId, stageId, position);
    clearOutcomeDrag();
  };

  const startOutcomeDrag = (
    event: React.DragEvent<HTMLElement>,
    outcome: Outcome,
    stageId: string,
  ) => {
    if (!canReorderOutcomes) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', outcome.id);
    setDraggedOutcome({ outcomeId: outcome.id, sourceStageId: stageId });
    setDropTarget(null);
  };

  const updateCardDropTarget = (
    event: React.DragEvent<HTMLElement>,
    stage: Stage,
    targetOutcome: Outcome,
  ) => {
    if (!draggedOutcome || !canReorderOutcomes) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const targetIndex = stage.outcomes.findIndex(
      (item) => item.id === targetOutcome.id,
    );
    const sourceIndex = stage.outcomes.findIndex(
      (item) => item.id === draggedOutcome.outcomeId,
    );
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge =
      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    let position = targetIndex + (edge === 'after' ? 1 : 0);
    if (
      draggedOutcome.sourceStageId === stage.id &&
      sourceIndex >= 0 &&
      sourceIndex < position
    ) {
      position -= 1;
    }
    position = Math.max(
      0,
      Math.min(
        position,
        stage.outcomes.length -
          (draggedOutcome.sourceStageId === stage.id ? 1 : 0),
      ),
    );
    setDropTarget({
      stageId: stage.id,
      position,
      targetOutcomeId: targetOutcome.id,
      edge,
    });
  };

  const dropOnOutcome = (
    event: React.DragEvent<HTMLElement>,
    stageId: string,
  ) => {
    if (!draggedOutcome || !canReorderOutcomes) return;
    event.preventDefault();
    event.stopPropagation();
    if (dropTarget?.stageId === stageId) {
      commitOutcomeMove(stageId, dropTarget.position);
    }
  };

  const moveOutcomeByKeyboard = (
    stage: Stage,
    outcome: Outcome,
    key: string,
  ) => {
    if (!canReorderOutcomes) return;
    const sourceIndex = stage.outcomes.findIndex(
      (item) => item.id === outcome.id,
    );
    if (sourceIndex < 0) return;

    if (key === 'ArrowUp' && sourceIndex > 0) {
      queueOutcomeMove(outcome.id, stage.id, sourceIndex - 1);
      return;
    }
    if (key === 'ArrowDown' && sourceIndex < stage.outcomes.length - 1) {
      queueOutcomeMove(outcome.id, stage.id, sourceIndex + 1);
      return;
    }

    const stageIndex = workflow.data.stages.findIndex(
      (item) => item.id === stage.id,
    );
    const targetStage =
      key === 'ArrowLeft'
        ? workflow.data.stages[stageIndex - 1]
        : key === 'ArrowRight'
          ? workflow.data.stages[stageIndex + 1]
          : undefined;
    if (!targetStage) return;
    queueOutcomeMove(
      outcome.id,
      targetStage.id,
      Math.min(sourceIndex, targetStage.outcomes.length),
    );
  };

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
                  : 'No workflow structure has been added yet.'}
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
        <div
          className="board-wrap"
          onDragOver={(event) => {
            if (!draggedOutcome || !canReorderOutcomes) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const edgeThreshold = 48;
            if (event.clientX < bounds.left + edgeThreshold) {
              event.currentTarget.scrollLeft -= 28;
            } else if (event.clientX > bounds.right - edgeThreshold) {
              event.currentTarget.scrollLeft += 28;
            }
          }}
        >
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

                  <div
                    className={`stage-cards${
                      dropTarget?.stageId === stage.id
                        ? ' pw-drag-over-stage'
                        : ''
                    }`}
                    onDragOver={(event) => {
                      if (!draggedOutcome || !canReorderOutcomes) return;
                      if (event.target !== event.currentTarget) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      const position =
                        stage.outcomes.length -
                        (draggedOutcome.sourceStageId === stage.id ? 1 : 0);
                      setDropTarget({ stageId: stage.id, position });
                    }}
                    onDrop={(event) => {
                      if (!draggedOutcome || !canReorderOutcomes) return;
                      if (event.target !== event.currentTarget) return;
                      event.preventDefault();
                      commitOutcomeMove(
                        stage.id,
                        dropTarget?.stageId === stage.id
                          ? dropTarget.position
                          : stage.outcomes.length -
                              (draggedOutcome.sourceStageId === stage.id
                                ? 1
                                : 0),
                      );
                    }}
                  >
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
                            const dependencyResolution =
                              prereq.resolution ??
                              (prereqOutcome?.lifecycleStatus === 'ACCEPTED'
                                ? 'ACCEPTED'
                                : prereq.resolved
                                  ? 'OVERRIDDEN'
                                  : 'WAITING');
                            const dependencyResolved =
                              dependencyResolution !== 'WAITING';
                            const dependencySkipped =
                              dependencyResolution === 'OVERRIDDEN';
                            const prereqStatusLabel =
                              dependencyResolution === 'ACCEPTED'
                                ? 'Accepted'
                                : dependencySkipped
                                  ? 'Skipped by Project editor'
                                  : prereqOutcome?.hasForReview
                                    ? 'For Review'
                                    : prereqOutcome
                                      ? lifecycleLabel(
                                          prereqOutcome.lifecycleStatus,
                                        )
                                      : 'Waiting';
                            const depStatusLabel = dependencyResolved
                              ? lifecycleLabel(outcome.lifecycleStatus)
                              : 'Locked';

                            return (
                              <article
                                key={`dependency-${prereq.id}-${outcome.id}`}
                                className={`dependency-group${
                                  dependencySkipped
                                    ? ' skipped'
                                    : dependencyResolved
                                      ? ' resolved'
                                      : ''
                                }${
                                  draggedOutcome?.outcomeId === outcome.id
                                    ? ' pw-dragging'
                                    : ''
                                }${
                                  dropTarget?.targetOutcomeId === outcome.id &&
                                  dropTarget.edge
                                    ? ` pw-drop-${dropTarget.edge}`
                                    : ''
                                }`}
                                draggable={canReorderOutcomes}
                                title={
                                  canReorderOutcomes
                                    ? 'Drag this dependency Outcome or drag either Outcome card inside the dependency.'
                                    : undefined
                                }
                                onDragStart={(event) => {
                                  const target = event.target as HTMLElement;
                                  if (target.closest('a, button')) return;
                                  startOutcomeDrag(event, outcome, stage.id);
                                }}
                                onDragEnd={clearOutcomeDrag}
                                onDragOver={(event) =>
                                  updateCardDropTarget(event, stage, outcome)
                                }
                                onDrop={(event) =>
                                  dropOnOutcome(event, stage.id)
                                }
                              >
                                <div className="dep-head">
                                  <span className="dep-title">DEPENDENCY</span>
                                  <span
                                    className={`dep-state ${
                                      dependencySkipped
                                        ? 'skipped'
                                        : dependencyResolved
                                          ? 'resolved'
                                          : 'waiting'
                                    }`}
                                  >
                                    {dependencySkipped
                                      ? 'SKIPPED'
                                      : dependencyResolved
                                        ? 'RESOLVED'
                                        : 'WAITING'}
                                  </span>
                                </div>

                                <div className="dep-flow">
                                  <Link
                                    to={`/projects/${projectId}/outcomes/${prereq.id}`}
                                    className={`dep-mini${
                                      dependencySkipped
                                        ? ' skipped'
                                        : dependencyResolved
                                          ? ' completed'
                                          : ''
                                    }${
                                      canReorderOutcomes && prereqOutcome
                                        ? ' pw-dependency-draggable'
                                        : ''
                                    }${
                                      draggedOutcome?.outcomeId === prereq.id
                                        ? ' pw-dragging'
                                        : ''
                                    }`}
                                    aria-label={
                                      prereqOutcome?.title ?? prereq.title
                                    }
                                    draggable={Boolean(
                                      canReorderOutcomes && prereqOutcome,
                                    )}
                                    onDragStart={(event) => {
                                      event.stopPropagation();
                                      if (!prereqOutcome) {
                                        event.preventDefault();
                                        return;
                                      }
                                      startOutcomeDrag(
                                        event,
                                        prereqOutcome,
                                        prereqOutcome.stageId,
                                      );
                                    }}
                                    onDragEnd={(event) => {
                                      event.stopPropagation();
                                      clearOutcomeDrag();
                                    }}
                                  >
                                    <div className="dep-mini-top">
                                      <h4 className="dep-mini-title">
                                        {prereqOutcome?.title ?? prereq.title}
                                      </h4>
                                    </div>
                                    <div className="dep-mini-meta">
                                      {prereqDept} · {prereqStatusLabel}
                                    </div>
                                  </Link>

                                  <span
                                    className="dep-arrow"
                                    aria-hidden="true"
                                  >
                                    →
                                  </span>

                                  <Link
                                    to={`/projects/${projectId}/outcomes/${outcome.id}`}
                                    className={`dep-mini${dependencyResolved ? ' next' : ''}${
                                      canReorderOutcomes
                                        ? ' pw-dependency-draggable'
                                        : ''
                                    }${
                                      draggedOutcome?.outcomeId === outcome.id
                                        ? ' pw-dragging'
                                        : ''
                                    }`}
                                    aria-label={outcome.title}
                                    draggable={canReorderOutcomes}
                                    onDragStart={(event) => {
                                      event.stopPropagation();
                                      startOutcomeDrag(
                                        event,
                                        outcome,
                                        stage.id,
                                      );
                                    }}
                                    onDragEnd={(event) => {
                                      event.stopPropagation();
                                      clearOutcomeDrag();
                                    }}
                                  >
                                    <div className="dep-mini-top">
                                      {dependencyResolved && (
                                        <span className="dep-next-label">
                                          NEXT OUTCOME
                                        </span>
                                      )}
                                      <h4 className="dep-mini-title">
                                        {outcome.title}
                                      </h4>
                                    </div>
                                    <div className="dep-mini-meta">
                                      {depDept} · {depStatusLabel}
                                    </div>
                                  </Link>
                                </div>

                                {!dependencyResolved && (
                                  <div className="dep-actions-row">
                                    <Link
                                      to={`/projects/${projectId}/outcomes/${prereq.id}`}
                                      className="dep-verify-btn"
                                    >
                                      Verify prerequisite
                                    </Link>
                                    {prereq.dependencyId &&
                                      workflow.data.canManageStructure && (
                                        <button
                                          type="button"
                                          className="dep-skip-btn"
                                          onClick={() => {
                                            dependencyOverrideForm.reset();
                                            setDependencyOverride({
                                              dependencyId:
                                                prereq.dependencyId!,
                                              outcomeId: outcome.id,
                                              prerequisiteTitle:
                                                prereqOutcome?.title ??
                                                prereq.title,
                                              outcomeTitle: outcome.title,
                                            });
                                          }}
                                        >
                                          Skip dependency
                                        </button>
                                      )}
                                  </div>
                                )}

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
                        const actionText = getOutcomeAction(
                          outcome,
                          workflow.data.canManageStructure,
                        );

                        return (
                          <article
                            className={`outcome-card ${
                              outcome.lifecycleStatus === 'OPEN' &&
                              outcome.hasForReview
                                ? 'pw-review'
                                : ''
                            }${
                              draggedOutcome?.outcomeId === outcome.id
                                ? ' pw-dragging'
                                : ''
                            }${
                              dropTarget?.targetOutcomeId === outcome.id &&
                              dropTarget.edge
                                ? ` pw-drop-${dropTarget.edge}`
                                : ''
                            }`}
                            key={outcome.id}
                            draggable={canReorderOutcomes}
                            tabIndex={canReorderOutcomes ? 0 : undefined}
                            aria-keyshortcuts={
                              canReorderOutcomes
                                ? 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
                                : undefined
                            }
                            title={
                              canReorderOutcomes
                                ? 'Drag to reorder or move to another stage. Keyboard: Alt + arrow keys.'
                                : undefined
                            }
                            onKeyDown={(event) => {
                              if (
                                event.target !== event.currentTarget ||
                                !event.altKey ||
                                ![
                                  'ArrowUp',
                                  'ArrowDown',
                                  'ArrowLeft',
                                  'ArrowRight',
                                ].includes(event.key)
                              ) {
                                return;
                              }
                              event.preventDefault();
                              moveOutcomeByKeyboard(stage, outcome, event.key);
                            }}
                            onDragStart={(event) => {
                              const target = event.target as HTMLElement;
                              if (target.closest('button, a')) {
                                event.preventDefault();
                                return;
                              }
                              startOutcomeDrag(event, outcome, stage.id);
                            }}
                            onDragEnd={clearOutcomeDrag}
                            onDragOver={(event) =>
                              updateCardDropTarget(event, stage, outcome)
                            }
                            onDrop={(event) => dropOnOutcome(event, stage.id)}
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
                                {outcome.workProgress === null
                                  ? 'No tasks yet'
                                  : outcome.workProgress + '% work progress'}
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

      {moveOutcome.error && (
        <p className="projects-form-banner error" role="alert">
          {errorMessage(moveOutcome.error)}
        </p>
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
      {dependencyOverride && (
        <ProjectDialog
          title="Skip dependency"
          eyebrow="Project editor override"
          tag="Dependency override"
          pending={overrideDependency.isPending}
          className="dependency-override-dialog"
          bodyClassName="dependency-override-body"
          onClose={() => {
            setDependencyOverride(null);
            dependencyOverrideForm.reset();
            overrideDependency.reset();
          }}
        >
          <form
            className="dependency-override-form"
            onSubmit={dependencyOverrideForm.handleSubmit(
              async ({ reason }) => {
                try {
                  await overrideDependency.mutateAsync({
                    dependencyId: dependencyOverride.dependencyId,
                    outcomeId: dependencyOverride.outcomeId,
                    reason,
                  });
                } catch {
                  /* Preserve the reason so the Project editor can retry. */
                }
              },
            )}
          >
            <div className="dependency-override-notice">
              <span
                className="dependency-override-notice-icon"
                aria-hidden="true"
              >
                !
              </span>
              <div>
                <strong>Bypass this prerequisite only</strong>
                <p>
                  The prerequisite outcome and its history stay unchanged. This
                  only unlocks the dependent outcome.
                </p>
              </div>
            </div>

            <div
              className="dependency-override-flow"
              aria-label="Dependency being skipped"
            >
              <div>
                <span>Prerequisite</span>
                <strong>{dependencyOverride.prerequisiteTitle}</strong>
              </div>
              <span className="dependency-override-arrow" aria-hidden="true">
                →
              </span>
              <div>
                <span>Unlock outcome</span>
                <strong>{dependencyOverride.outcomeTitle}</strong>
              </div>
            </div>

            <label className="dependency-override-reason">
              <span>Reason for override</span>
              <textarea
                autoFocus
                placeholder="Explain why this outcome may proceed without the prerequisite."
                {...dependencyOverrideForm.register('reason', {
                  required: 'Add a reason before skipping this dependency.',
                })}
              />
            </label>

            {dependencyOverrideForm.formState.errors.reason?.message && (
              <p className="dependency-override-error" role="alert">
                {dependencyOverrideForm.formState.errors.reason.message}
              </p>
            )}
            {overrideDependency.error && (
              <p className="dependency-override-error" role="alert">
                {errorMessage(overrideDependency.error)}
              </p>
            )}

            <footer className="dependency-override-actions">
              <button
                type="button"
                className="projects-secondary-button"
                disabled={overrideDependency.isPending}
                onClick={() => {
                  setDependencyOverride(null);
                  dependencyOverrideForm.reset();
                  overrideDependency.reset();
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="dependency-override-confirm"
                disabled={overrideDependency.isPending}
              >
                {overrideDependency.isPending
                  ? 'Skipping dependency...'
                  : 'Confirm skip dependency'}
              </button>
            </footer>
          </form>
        </ProjectDialog>
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
