import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OutcomeWorkSchema,
  WorkItemInputSchema,
  type Feature,
  type OutcomeWork,
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

function FeatureComposer({
  pending,
  onSave,
  onCancel,
  initialTitle = '',
  initialDescription = '',
  submitLabel = 'Add feature',
  autoFocus = true,
}: {
  pending: boolean;
  onSave: (input: { title: string; description?: string }) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  initialDescription?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      titleInputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Feature title is required');
      titleInputRef.current?.focus();
      return;
    }
    setError(null);
    try {
      await onSave({
        title: trimmedTitle,
        description: description.trim() || undefined,
      });
      if (!initialTitle) {
        setTitle('');
        setDescription('');
      }
    } catch {
      /* Shared mutation error preserves the inputs. */
    }
  };

  return (
    <form className="pw-feature-composer" onSubmit={handleSubmit} noValidate>
      <div className="pw-feature-composer-grid">
        <input
          ref={titleInputRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          disabled={pending}
          placeholder="Feature name"
          aria-label="Feature title"
          aria-invalid={Boolean(error)}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          placeholder="Short description (optional)"
          aria-label="Feature description"
        />
      </div>
      {error && (
        <small role="alert" className="field-error-msg" style={{ marginTop: 4 }}>
          {error}
        </small>
      )}
      <div className="pw-feature-composer-actions">
        <button
          type="button"
          className="projects-secondary-button pw-composer-cancel-btn"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="projects-primary-button pw-composer-submit-btn"
          disabled={pending || !title.trim()}
        >
          {pending
            ? submitLabel === 'Save feature'
              ? 'Saving...'
              : 'Adding...'
            : submitLabel}
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
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

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
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.15s ease',
              display: 'block',
            }}
            aria-hidden="true"
          >
            <path
              d="M3 1.5L6.5 5L3 8.5"
              stroke="#c44d2d"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="feature-icon-badge" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            style={{ display: 'block' }}
          >
            <circle cx="8" cy="8" r="6" stroke="#ea580c" strokeWidth="1.8" />
            <circle cx="8" cy="8" r="3.4" fill="#ea580c" />
          </svg>
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
                setEditing(editing === feature.id ? null : feature.id);
              }}
              disabled={pending}
            >
              {editing === feature.id ? 'Close' : 'Edit feature'}
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
            <div className="pw-feature-edit-wrap">
              <FeatureComposer
                initialTitle={feature.title}
                initialDescription={feature.description ?? ''}
                submitLabel="Save feature"
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={async (input) => {
                  await change({
                    path: `/features/${feature.id}`,
                    method: 'PATCH',
                    body: { ...input, updatedAt: feature.updatedAt },
                  });
                  setEditing(null);
                }}
              />
            </div>
          )}
          {feature.tasks.map((task) => (
            <div key={task.id} className="outcome-task">
              <div className="outcome-task-row">
                <input
                  type="checkbox"
                  aria-label={`Complete ${task.title}`}
                  checked={task.status === 'DONE'}
                  disabled={!canExecute}
                  onChange={(event) => {
                    if (savingTaskIds.has(task.id)) return;
                    const done = event.target.checked;
                    setSavingTaskIds((prev) => new Set(prev).add(task.id));
                    void change({
                      path: `/tasks/${task.id}/state`,
                      method: 'PATCH',
                      body: {
                        status: done ? 'DONE' : 'TODO',
                        updatedAt: task.updatedAt,
                      },
                    })
                      .catch(() => {})
                      .finally(() => {
                        setSavingTaskIds((prev) => {
                          const next = new Set(prev);
                          next.delete(task.id);
                          return next;
                        });
                      });
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
            <form
              className="pw-task-actions"
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = newTaskTitle.trim();
                if (!trimmed || taskSubmitting) return;
                setTaskSubmitting(true);
                setTaskError(null);
                try {
                  await change({
                    path: `/features/${feature.id}/tasks`,
                    method: 'POST',
                    body: { title: trimmed },
                  });
                  setNewTaskTitle('');
                } catch (err) {
                  setTaskError((err as Error).message || 'Failed to add task');
                } finally {
                  setTaskSubmitting(false);
                }
              }}
            >
              <input
                value={newTaskTitle}
                onChange={(e) => {
                  setNewTaskTitle(e.target.value);
                  if (taskError) setTaskError(null);
                }}
                disabled={pending || taskSubmitting}
                placeholder={
                  canExecute ? 'Add a task...' : 'Add a task to plan ahead...'
                }
                aria-label={`Add a task to ${feature.title}`}
              />
              <button
                type="submit"
                className="projects-secondary-button pw-task-add-button"
                disabled={pending || taskSubmitting || !newTaskTitle.trim()}
              >
                {taskSubmitting ? 'Adding...' : 'Add task'}
              </button>
            </form>
          )}
          {taskError && (
            <small
              role="alert"
              className="field-error-msg"
              style={{ margin: '4px 0 0 2px' }}
            >
              {taskError}
            </small>
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
  });
  const mutation = useMutation({
    mutationFn: (input: Change) =>
      apiFetch(path + input.path, OutcomeWorkSchema, {
        accessToken,
        method: input.method,
        body: input.body,
      }),
    onMutate: async (input: Change) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWork = queryClient.getQueryData<OutcomeWork>(queryKey);

      if (
        previousWork &&
        input.path.startsWith('/tasks/') &&
        input.path.endsWith('/state')
      ) {
        const taskId = input.path.replace('/tasks/', '').replace('/state', '');
        const newStatus = (input.body as { status: 'TODO' | 'DONE' }).status;

        const updatedFeatures = previousWork.features.map((feature) => ({
          ...feature,
          tasks: feature.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  completedAt:
                    newStatus === 'DONE' ? new Date().toISOString() : null,
                }
              : t,
          ),
        }));

        const totalTasks = updatedFeatures.reduce(
          (sum, f) => sum + f.tasks.length,
          0,
        );
        const completedTasks = updatedFeatures.reduce(
          (sum, f) => sum + f.tasks.filter((t) => t.status === 'DONE').length,
          0,
        );
        const progress =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null;

        queryClient.setQueryData<OutcomeWork>(queryKey, {
          ...previousWork,
          features: updatedFeatures,
          totalTasks,
          completedTasks,
          progress,
        });
      }

      return { previousWork };
    },
    onError: (_err, _input, context) => {
      if (context?.previousWork) {
        queryClient.setQueryData(queryKey, context.previousWork);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'delivery', outcomeId],
      });
    },
  });
  const change = async (input: Change) => {
    const isTaskState =
      input.path.startsWith('/tasks/') && input.path.endsWith('/state');
    if (!isTaskState) {
      if (inFlight.current)
        throw new Error('A work change is already being saved.');
      inFlight.current = true;
    }
    try {
      await mutation.mutateAsync(input);
    } finally {
      if (!isTaskState) {
        inFlight.current = false;
      }
    }
  };
  if (work.isPending)
    return (
      <section
        className="work-section work-plan-section outcome-skeleton-card"
        aria-label="Loading Outcome work"
        aria-busy="true"
      >
        <div className="work-section-head pw-sk-header-row">
          <div className="work-section-title-wrap pw-sk-title-group">
            <div className="pw-sk-line pw-sk-title" />
            <div className="pw-sk-line pw-sk-desc" />
          </div>
          <div className="pw-sk-shimmer pw-sk-btn" />
        </div>
        <div className="pw-sk-feature-card">
          <div className="pw-sk-feature-top">
            <div className="pw-sk-shimmer pw-sk-checkbox" />
            <div className="pw-sk-line" style={{ width: 140, height: 12 }} />
            <div
              className="pw-sk-shimmer pw-sk-line"
              style={{ width: 48, height: 16, borderRadius: 999, marginLeft: 'auto' }}
            />
          </div>
          <div className="pw-sk-task-list">
            <div className="pw-sk-task-item">
              <div className="pw-sk-shimmer pw-sk-checkbox" />
              <div className="pw-sk-line" style={{ width: 180, height: 10 }} />
              <div className="pw-sk-shimmer pw-sk-avatar" />
            </div>
            <div className="pw-sk-task-item">
              <div className="pw-sk-shimmer pw-sk-checkbox" />
              <div className="pw-sk-line" style={{ width: 120, height: 10 }} />
              <div className="pw-sk-shimmer pw-sk-avatar" />
            </div>
          </div>
        </div>
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
            {isJoined ? 'My Work Plan' : 'Team Work Plan'}
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
            aria-label="Add a feature to this outcome"
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
      {mutation.isError && (
        <div role="alert" className="projects-save-error">
          {mutation.error.message}
          <button type="button" onClick={() => void work.refetch()}>
            Refresh work
          </button>
        </div>
      )}
      {!work.data.features.length && (
        <div className="outcome-features-empty-state">
          <div className="outcome-features-empty-icon" aria-hidden="true">
            ◉
          </div>
          <strong className="outcome-features-empty-title">
            No features defined yet
          </strong>
          <p className="outcome-features-empty-body">
            {work.data.canPlan
              ? 'Start by adding the main pieces of work needed to achieve this outcome.'
              : 'No features have been defined yet. Join this outcome to contribute to its work plan.'}
          </p>
          {work.data.canPlan && !composer && (
            <button
              type="button"
              className="feature-add-button outcome-features-empty-action"
              disabled={mutation.isPending}
              onClick={() => setComposer(true)}
            >
              ＋ Add feature
            </button>
          )}
          {work.data.canPlan && composer && (
            <div style={{ width: '100%', marginTop: '12px' }}>
              <FeatureComposer
                pending={mutation.isPending}
                onCancel={() => setComposer(false)}
                onSave={async (input) => {
                  await change({ path: '/features', method: 'POST', body: input });
                  setComposer(false);
                }}
              />
            </div>
          )}
        </div>
      )}
      {work.data.features.length > 0 && (
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
      )}
      {work.data.canPlan && work.data.features.length > 0 && (
        <>
          {composer ? (
            <div style={{ marginTop: '10px' }}>
              <FeatureComposer
                pending={mutation.isPending}
                onCancel={() => setComposer(false)}
                onSave={async (input) => {
                  await change({ path: '/features', method: 'POST', body: input });
                  setComposer(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="add-feature-large"
              disabled={mutation.isPending}
              onClick={() => setComposer(true)}
            >
              ＋ Add another feature
            </button>
          )}
        </>
      )}
    </section>
  );
}
