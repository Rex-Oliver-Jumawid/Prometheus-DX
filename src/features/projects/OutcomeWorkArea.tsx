import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OutcomeWorkSchema,
  WorkItemInputSchema,
  type Feature,
  type Task,
  type WorkItemInput,
} from '../../../shared/contracts/outcome-work';
import { apiFetch } from '../../lib/api';
import './outcome-work.css';

type Change = {
  path: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
};

function WorkItemForm({
  label,
  item,
  pending,
  onSave,
  onCancel,
}: {
  label: string;
  item?: Feature | Task;
  pending: boolean;
  onSave: (input: WorkItemInput, updatedAt?: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const submitting = useRef(false);
  const originalVersion = useRef(item?.updatedAt);
  const editingExisting = Boolean(item);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors },
  } = useForm<WorkItemInput>({
    defaultValues: {
      title: item?.title ?? '',
      description: item?.description ?? '',
    },
  });
  useEffect(() => {
    if (label === 'Feature' || editingExisting) setFocus('title');
  }, [editingExisting, label, setFocus]);
  const submit = handleSubmit(async (values) => {
    if (submitting.current) return;
    const parsed = WorkItemInputSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'title' || issue.path[0] === 'description')
          setError(issue.path[0], { message: issue.message });
      }
      return;
    }
    submitting.current = true;
    try {
      await onSave(parsed.data, originalVersion.current);
      reset();
    } catch {
      /* The shared mutation error preserves the entered form. */
    } finally {
      submitting.current = false;
    }
  });
  return (
    <form className="outcome-work-form" onSubmit={submit} noValidate>
      <label className="projects-field">
        <span>{label} title</span>
        <input
          {...register('title')}
          disabled={pending}
          aria-label={`${label} title`}
          aria-invalid={Boolean(errors.title)}
          placeholder={
            label === 'Feature' ? 'e.g. Authentication' : 'Add a task...'
          }
        />
        {errors.title && <small role="alert">{errors.title.message}</small>}
      </label>
      <label className="projects-field">
        <span>
          {label} description <small>Optional</small>
        </span>
        <textarea {...register('description')} rows={2} disabled={pending} />
        {errors.description && (
          <small role="alert">{errors.description.message}</small>
        )}
      </label>
      <div className="outcome-work-actions">
        {onCancel && (
          <button
            type="button"
            className="projects-secondary-button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="projects-primary-button"
          type="submit"
          disabled={pending}
        >
          {pending
            ? 'Saving...'
            : item
              ? `Save ${label.toLowerCase()}`
              : `Add ${label.toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}

function FeatureCard({
  feature,
  canPlan,
  canExecute,
  pending,
  change,
}: {
  feature: Feature;
  canPlan: boolean;
  canExecute: boolean;
  pending: boolean;
  change: (input: Change) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<{
    id: string;
    done: boolean;
  } | null>(null);
  const done = feature.tasks.filter((task) => task.status === 'DONE').length;
  const donePercent = feature.tasks.length
    ? Math.round((done / feature.tasks.length) * 100)
    : 0;

  return (
    <article
      className="outcome-feature"
      aria-label={`Feature ${feature.title}`}
    >
      <header className="outcome-feature-header">
        <button
          type="button"
          className="feature-toggle-btn"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${feature.title}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '›' : '⌄'}
        </button>
        <div className="feature-icon-badge" aria-hidden="true">
          ◉
        </div>
        <div className="outcome-feature-title">
          <h4>{feature.title}</h4>
          {feature.description && <p>{feature.description}</p>}
        </div>
        <div className="feature-progress-box">
          <span className="outcome-task-count">
            {done}/{feature.tasks.length} tasks
          </span>
          <div className="feature-mini-track" aria-hidden="true">
            <span
              className="feature-mini-fill"
              style={{ width: `${donePercent}%` }}
            />
          </div>
        </div>
        {canPlan && (
          <div className="outcome-work-actions">
            <button
              type="button"
              className="workflow-icon-button"
              onClick={() => {
                setCollapsed(false);
                setEditing(feature.id);
              }}
              disabled={pending}
            >
              Edit feature
            </button>
            <button
              type="button"
              className="workflow-icon-button"
              aria-label={`Delete feature ${feature.title}`}
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete feature "${feature.title}" and its tasks?`,
                  )
                )
                  void change({
                    path: `/features/${feature.id}`,
                    method: 'DELETE',
                  }).catch(() => {});
              }}
            >
              ×
            </button>
          </div>
        )}
      </header>
      {!collapsed && (
        <div className="outcome-feature-body">
          {editing === feature.id && canPlan && (
            <WorkItemForm
              label="Feature"
              item={feature}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={async (input, updatedAt) => {
                await change({
                  path: `/features/${feature.id}`,
                  method: 'PATCH',
                  body: { ...input, updatedAt },
                });
                setEditing(null);
              }}
            />
          )}
          {!feature.tasks.length && (
            <p className="workflow-empty-note">No tasks yet.</p>
          )}
          {feature.tasks.map((task) => (
            <div key={task.id} className="outcome-task">
              <div className="outcome-task-row">
                <input
                  type="checkbox"
                  aria-label={`Complete ${task.title}`}
                  checked={
                    pendingTask?.id === task.id
                      ? pendingTask.done
                      : task.status === 'DONE'
                  }
                  disabled={!canExecute || pending}
                  onChange={(event) => {
                    const done = event.target.checked;
                    setPendingTask({ id: task.id, done });
                    void change({
                      path: `/tasks/${task.id}/state`,
                      method: 'PATCH',
                      body: {
                        status: done ? 'DONE' : 'TODO',
                        updatedAt: task.updatedAt,
                      },
                    })
                      .catch(() => {})
                      .finally(() => setPendingTask(null));
                  }}
                />
                <div
                  className={task.status === 'DONE' ? 'outcome-task-done' : ''}
                >
                  <span>{task.title}</span>
                  {task.description && <p>{task.description}</p>}
                </div>
                <span className="outcome-task-status">
                  {task.status === 'DONE' ? 'Done' : 'Open'}
                </span>
                {canPlan && (
                  <>
                    <button
                      type="button"
                      className="workflow-icon-button"
                      aria-label={`Edit task ${task.title}`}
                      disabled={pending}
                      onClick={() => setEditing(task.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="workflow-icon-button"
                      aria-label={`Delete task ${task.title}`}
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Delete task "${task.title}"?`))
                          void change({
                            path: `/tasks/${task.id}`,
                            method: 'DELETE',
                          }).catch(() => {});
                      }}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
              {editing === task.id && canPlan && (
                <WorkItemForm
                  label="Task"
                  item={task}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={async (input, updatedAt) => {
                    await change({
                      path: `/tasks/${task.id}`,
                      method: 'PATCH',
                      body: { ...input, updatedAt },
                    });
                    setEditing(null);
                  }}
                />
              )}
            </div>
          ))}
          {canPlan && (
            <WorkItemForm
              label="Task"
              pending={pending}
              onSave={(input) =>
                change({
                  path: `/features/${feature.id}/tasks`,
                  method: 'POST',
                  body: input,
                })
              }
            />
          )}
        </div>
      )}
    </article>
  );
}

export function OutcomeWorkArea({
  projectId,
  outcomeId,
  accessToken,
  isJoined,
}: {
  projectId: string;
  outcomeId: string;
  accessToken?: string;
  isJoined: boolean;
}) {
  const [composer, setComposer] = useState(false);
  const inFlight = useRef(false);
  const queryClient = useQueryClient();
  const queryKey = ['projects', projectId, 'outcome-work', outcomeId, isJoined];
  const path = `/projects/${projectId}/outcomes/${outcomeId}/work`;
  const work = useQuery({
    queryKey,
    queryFn: () => apiFetch(path, OutcomeWorkSchema, { accessToken }),
    retry: false,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
  const mutation = useMutation({
    mutationFn: (input: Change) =>
      apiFetch(path + input.path, OutcomeWorkSchema, {
        accessToken,
        method: input.method,
        body: input.body,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'delivery', outcomeId],
      });
    },
  });
  const change = async (input: Change) => {
    if (inFlight.current)
      throw new Error('A work change is already being saved.');
    inFlight.current = true;
    try {
      await mutation.mutateAsync(input);
    } finally {
      inFlight.current = false;
    }
  };
  if (work.isPending)
    return (
      <section className="outcome-work-area" aria-label="Loading Outcome work">
        <div className="projects-skeleton" />
        <p>Loading Features and Tasks...</p>
      </section>
    );
  if (work.isError)
    return (
      <section className="projects-state-card" role="alert">
        <p>Outcome work could not be loaded.</p>
        <p>{work.error.message}</p>
        <button type="button" onClick={() => void work.refetch()}>
          Retry work area
        </button>
      </section>
    );
  return (
    <section className="work-section work-plan-section" aria-labelledby="outcome-work-title">
      <header className="work-section-head">
        <div className="work-section-title-wrap">
          <h3 id="outcome-work-title">
            {isJoined ? 'My Work Plan' : 'Member Work Plan'}
          </h3>
          <p>
            {isJoined
              ? 'Break the outcome into features, then manage the tasks needed to produce the output.'
              : 'Read-only view of how the work was organized behind this outcome.'}
          </p>
        </div>
        {work.data.canPlan && (
          <button
            type="button"
            className="feature-add-button"
            disabled={mutation.isPending}
            onClick={() => setComposer(true)}
          >
            ＋ Add feature
          </button>
        )}
      </header>
      {work.data.canPlan && !work.data.canExecute && (
        <div className="locked-workspace-banner">
          This outcome is waiting on a prerequisite. You may plan features and
          tasks now, but task completion and output submission stay locked until
          the dependency is resolved.
        </div>
      )}
      {!isJoined && (
        <p className="workflow-empty-note">
          Join this outcome to contribute to its work plan.
        </p>
      )}
      {mutation.isError && (
        <div role="alert" className="projects-save-error">
          {mutation.error.message}
          <button type="button" onClick={() => void work.refetch()}>
            Refresh work
          </button>
        </div>
      )}
      {composer && work.data.canPlan && (
        <WorkItemForm
          label="Feature"
          pending={mutation.isPending}
          onCancel={() => setComposer(false)}
          onSave={async (input) => {
            await change({ path: '/features', method: 'POST', body: input });
            setComposer(false);
          }}
        />
      )}
      {!work.data.features.length && (
        <div className="projects-state-card">
          <strong>No features yet</strong>
          <p>
            {work.data.canPlan
              ? 'Start by adding the main pieces of work needed to achieve this outcome.'
              : 'No features have been defined yet. Join this outcome to contribute to its work plan.'}
          </p>
        </div>
      )}
      <div className="feature-list">
        {work.data.features.map((feature) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            canPlan={work.data.canPlan}
            canExecute={work.data.canExecute}
            pending={mutation.isPending}
            change={change}
          />
        ))}
      </div>
      {work.data.canPlan && (
        <button
          type="button"
          className="add-feature-large"
          disabled={mutation.isPending}
          onClick={() => setComposer(true)}
        >
          ＋ Add another feature
        </button>
      )}
    </section>
  );
}
