import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OutcomeDeliverySchema,
  SubmitOutputInputSchema,
  type OutcomeDelivery,
  type Submission,
} from '../../../shared/contracts/outcome-delivery';
import { apiFetch } from '../../lib/api';
import { projectKeys } from './project-queries';
import { ProjectDialog } from './ProjectDialog';
import { OutcomeReviewDialog } from './OutcomeReviewDialog';
import { OutputContent } from './OutputContent';
import { Link } from 'react-router-dom';

function OutputForm({
  data,
  pending,
  save,
}: {
  data: OutcomeDelivery;
  pending: boolean;
  save: (
    action: 'draft' | 'submissions',
    body: unknown,
  ) => Promise<OutcomeDelivery>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      content: data.draft?.content ?? '',
      note: data.draft?.note ?? '',
    },
  });
  const requestId = useRef<string | null>(null);
  const draftVersion = useRef(data.draft?.updatedAt ?? null);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const perform = (action: 'draft' | 'submissions') =>
    handleSubmit(async (values) => {
      if (inFlight.current) return;
      const body =
        action === 'draft'
          ? { ...values, updatedAt: draftVersion.current }
          : {
              ...values,
              requestId: requestId.current ?? crypto.randomUUID(),
              draftUpdatedAt: draftVersion.current,
            };
      if (action === 'submissions') {
        const parsed = SubmitOutputInputSchema.safeParse(body);
        if (!parsed.success) {
          setError('content', { message: parsed.error.issues[0]?.message });
          return;
        }
        requestId.current = parsed.data.requestId;
      }
      inFlight.current = true;
      try {
        const result = await save(action, body);
        draftVersion.current = result.draft?.updatedAt ?? null;
        if (action === 'submissions') {
          reset({ content: '', note: '' });
          requestId.current = null;
        }
        setSaved(action === 'draft');
      } catch {
        /* Keep values and request ID for a safe retry. */
      } finally {
        inFlight.current = false;
      }
    });
  return (
    <form
      className="outcome-work-form"
      onSubmit={perform('submissions')}
      noValidate
    >
      <label className="projects-field">
        <span>Output name, text, or link</span>
        <textarea
          aria-label="Output content"
          {...register('content', {
            onChange: () => {
              requestId.current = null;
              setSaved(false);
            },
          })}
          disabled={!data.canSubmit || pending}
          aria-invalid={Boolean(errors.content)}
        />
        {errors.content && <small role="alert">{errors.content.message}</small>}
      </label>
      <label className="projects-field">
        <span>
          Submission notes <small>Optional</small>
        </span>
        <textarea
          aria-label="Submission notes"
          {...register('note', {
            onChange: () => {
              requestId.current = null;
              setSaved(false);
            },
          })}
          disabled={!data.canSubmit || pending}
        />
      </label>
      <div className="outcome-work-actions">
        <button
          className="projects-secondary-button"
          type="button"
          disabled={!data.canSubmit || pending}
          onClick={() => void perform('draft')()}
        >
          Save draft
        </button>
        <button
          className="projects-primary-button"
          type="submit"
          disabled={!data.canSubmit || pending}
        >
          {pending ? 'Saving...' : 'Submit for review'}
        </button>
        {saved && <span role="status">Draft saved</span>}
      </div>
      {data.draft && (
        <p className="workflow-empty-note">
          Draft saved {new Date(data.draft.updatedAt).toLocaleString()}
        </p>
      )}
    </form>
  );
}

export function OutcomeDeliveryPanel({
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Submission | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reopenVersion, setReopenVersion] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const overrideForm = useForm({ defaultValues: { reason: '' } });
  const inFlight = useRef(false);
  const key = ['projects', projectId, 'delivery', outcomeId, isJoined];
  const path = `/projects/${projectId}/outcomes/${outcomeId}/delivery`;
  const delivery = useQuery({
    queryKey: key,
    queryFn: () => apiFetch(path, OutcomeDeliverySchema, { accessToken }),
    retry: false,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
  const mutation = useMutation({
    mutationFn: ({ action, body }: { action: string; body: unknown }) =>
      apiFetch(`${path}/${action}`, OutcomeDeliverySchema, {
        accessToken,
        method:
          action === 'draft' || action === 'review-draft' ? 'PUT' : 'POST',
        body,
      }),
    onSuccess: (data, { action }) => {
      queryClient.setQueryData(key, data);
      if (action !== 'draft' && action !== 'review-draft') {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: projectKeys.list }),
          queryClient.invalidateQueries({
            queryKey: projectKeys.detail(projectId),
          }),
          queryClient.invalidateQueries({
            queryKey: projectKeys.workflow(projectId),
          }),
        ]);
      }
    },
  });
  const act = async (action: string, body: unknown) => {
    if (inFlight.current)
      throw new Error('A delivery action is already being saved.');
    inFlight.current = true;
    try {
      return await mutation.mutateAsync({ action, body });
    } finally {
      inFlight.current = false;
    }
  };
  if (delivery.isPending)
    return (
      <section className="outcome-work-area" aria-label="Loading submissions">
        <div className="projects-skeleton" />
        <p>Loading shared submission history...</p>
      </section>
    );
  if (delivery.isError)
    return (
      <section className="projects-state-card" role="alert">
        <p>Submissions could not be loaded.</p>
        <p>{delivery.error.message}</p>
        <button type="button" onClick={() => void delivery.refetch()}>
          Retry submissions
        </button>
      </section>
    );
  const data = delivery.data;
  const accepted = data.lifecycleStatus === 'ACCEPTED';
  return (
    <section className="outcome-work-area" aria-label="Outputs and feedback">
      <header className="workflow-section-heading">
        <div>
          <p className="projects-kicker">SHARED OUTCOME RECORD</p>
          <h3>
            {accepted
              ? 'Accepted Outcome'
              : data.isLead
                ? 'Outcome Submissions'
                : 'My Outputs & Feedback'}
          </h3>
          <p>Every team contribution stays in one shared history.</p>
        </div>
        {data.hasForReview && (
          <span className="workflow-state">For Review</span>
        )}
      </header>
      {accepted && (
        <p className="workflow-form-preview">
          The Project Lead accepted the combined work. Membership and submission
          history are preserved.
        </p>
      )}
      {data.isLead && (
        <div className="outcome-work-actions">
          {!accepted && data.submissions.length > 0 && (
            <button
              className="projects-primary-button"
              type="button"
              onClick={() => {
                mutation.reset();
                setReviewOpen(true);
              }}
            >
              Review Outcome
            </button>
          )}
          {accepted && (
            <button
              className="projects-secondary-button"
              type="button"
              onClick={() => setReopenVersion(data.outcomeUpdatedAt)}
            >
              Reopen Outcome
            </button>
          )}
          {data.lifecycleStatus === 'NEEDS_REVISION' && (
            <button
              className="projects-secondary-button"
              type="button"
              disabled={mutation.isPending}
              onClick={() =>
                void act('resolve-revision', {
                  outcomeUpdatedAt: data.outcomeUpdatedAt,
                }).catch(() => {})
              }
            >
              Mark revision addressed
            </button>
          )}
        </div>
      )}
      {data.revisions.length > 0 && (
        <section
          className="outcome-revision-history"
          aria-label="Revision feedback"
        >
          <h4>
            {data.lifecycleStatus === 'NEEDS_REVISION'
              ? 'Needs Revision'
              : 'Revision history'}
          </h4>
          {data.revisions.map((item) => (
            <article key={item.id}>
              <p className="outcome-output-content">{item.message}</p>
              <small>
                {item.requester.fullName} ·{' '}
                {new Date(item.createdAt).toLocaleString()} ·{' '}
                {item.resolvedAt ? 'Addressed' : 'Revision requested'}
              </small>
            </article>
          ))}
        </section>
      )}
      {mutation.isError && (
        <p role="alert" className="projects-save-error">
          {mutation.error.message}
        </p>
      )}
      {isJoined && !accepted && (
        <OutputForm
          key={outcomeId}
          data={data}
          pending={mutation.isPending}
          save={act}
        />
      )}
      <h4>
        Shared submission history{' '}
        <span className="outcome-task-count">
          {data.submissions.length} submissions
        </span>
      </h4>
      {!data.submissions.length && (
        <div className="projects-state-card">No submissions yet.</div>
      )}
      <div className="outcome-submission-list">
        {data.submissions.map((submission, index) => (
          <button
            className="outcome-submission-card"
            type="button"
            key={submission.id}
            onClick={() => setSelected(submission)}
          >
            <span className="outcome-submission-version">
              v{data.submissions.length - index}
              {index === 0 ? ' · Latest' : ''}
            </span>
            <strong>{submission.content}</strong>
            <span>
              Submitted by {submission.submitter.fullName} ·{' '}
              {new Date(submission.createdAt).toLocaleString()}
            </span>
            <span>
              {submission.reviewStatus === 'FOR_REVIEW'
                ? 'For Review'
                : 'Reviewed'}
            </span>
            <span>View submission →</span>
          </button>
        ))}
      </div>
      {data.acceptances.length > 0 && (
        <section
          className="outcome-acceptance-history"
          aria-label="Acceptance history"
        >
          <h4>Acceptance history</h4>
          {data.acceptances.map((item) => (
            <details key={item.id} open>
              <summary>
                Accepted {new Date(item.acceptedAt).toLocaleString()} by{' '}
                {item.acceptedBy.fullName}
                {item.reopenedAt ? ' · Reopened' : ' · Current acceptance'}
              </summary>
              <p>{item.feedback}</p>
              <p>
                Credited Outcome Members:{' '}
                {item.members.map((member) => member.fullName).join(', ') ||
                  'No members'}
              </p>
              {item.reopenedAt && (
                <p>
                  Reopened {new Date(item.reopenedAt).toLocaleString()} by{' '}
                  {item.reopenedBy?.fullName}
                </p>
              )}
              <ul>
                {item.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    {criterion.verified ? '✓ ' : ''}
                    {criterion.description}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
      {data.dependencies.length > 0 && (
        <section
          className="outcome-dependency-list"
          aria-label="Dependency decisions"
        >
          <h4>Dependencies</h4>
          {data.dependencies.map((item) => (
            <article key={item.id}>
              <Link
                to={`/projects/${projectId}/outcomes/${item.prerequisiteId}`}
              >
                {item.title}
              </Link>
              <span>{item.resolved ? 'Resolved' : 'Waiting'}</span>
              {item.overrideReason && (
                <p>Lead override: {item.overrideReason}</p>
              )}
              {data.isLead && !item.resolved && (
                <button
                  className="projects-secondary-button"
                  type="button"
                  onClick={() => {
                    overrideForm.reset();
                    setOverrideId(item.id);
                  }}
                >
                  Skip dependency
                </button>
              )}
            </article>
          ))}
        </section>
      )}
      <section className="outcome-activity">
        <div className="workflow-section-heading">
          <h4>Recent activity</h4>
          <button
            className="workflow-icon-button"
            type="button"
            onClick={() => setShowActivity(!showActivity)}
          >
            {showActivity ? 'Show recent' : 'View all activity'}
          </button>
        </div>
        {!data.activity.length && <p>No activity yet.</p>}
        <ul>
          {data.activity.slice(0, showActivity ? undefined : 6).map((item) => (
            <li key={item.id}>
              <span>
                {item.action.toLowerCase().replaceAll('_', ' ')} ·{' '}
                {item.actor ?? 'System'}
              </span>
              <time>{new Date(item.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      </section>
      {selected && (
        <ProjectDialog
          title="Submission record"
          pending={mutation.isPending}
          onClose={() => setSelected(null)}
        >
          {mutation.error && <p role="alert">{mutation.error.message}</p>}
          <p>
            Submitted by {selected.submitter.fullName} ·{' '}
            {new Date(selected.createdAt).toLocaleString()}
          </p>
          {selected.reviews.map((item) => (
            <article key={item.id}>
              <h4>Reviewed by {item.reviewer.fullName}</h4>
              <p>{item.note || 'Reviewed without additional notes.'}</p>
              <ul>
                {item.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    {criterion.verified ? '✓' : '○'} {criterion.description}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {data.isLead && !accepted && (
            <div className="outcome-work-actions">
              <button
                className="projects-primary-button"
                type="button"
                onClick={() => {
                  setSelected(null);
                  setReviewOpen(true);
                }}
              >
                Continue to Outcome review
              </button>
              {selected.reviewStatus === 'FOR_REVIEW' && (
                <button
                  className="projects-secondary-button"
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    void act(`submissions/${selected.id}/reviews`, {
                      criterionIds: [],
                      note: 'Submission inspected by the Project Lead.',
                      outcomeUpdatedAt: data.outcomeUpdatedAt,
                      submissionIds: data.submissions.map((item) => item.id),
                    })
                      .then(() => setSelected(null))
                      .catch(() => {})
                  }
                >
                  Mark submission reviewed
                </button>
              )}
            </div>
          )}
          <OutputContent content={selected.content} />
          <h3>Notes</h3>
          <p className="outcome-output-content">
            {selected.note || 'No notes provided.'}
          </p>
          <p>
            {selected.reviewStatus === 'FOR_REVIEW'
              ? 'Awaiting Project Lead review'
              : 'Reviewed'}
          </p>
        </ProjectDialog>
      )}
      {reviewOpen && (
        <OutcomeReviewDialog
          data={data}
          pending={mutation.isPending}
          error={mutation.error}
          act={act}
          onClose={() => setReviewOpen(false)}
        />
      )}
      {reopenVersion && (
        <ProjectDialog
          title="Reopen accepted Outcome"
          pending={mutation.isPending}
          onClose={() => setReopenVersion(null)}
        >
          <p>
            Existing memberships, submissions, acceptance history, and credit
            remain preserved. Unfinished dependents may relock.
          </p>
          {mutation.error && <p role="alert">{mutation.error.message}</p>}
          <button
            className="projects-primary-button"
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              void act('reopen', { outcomeUpdatedAt: reopenVersion })
                .then(() => setReopenVersion(null))
                .catch(() => {})
            }
          >
            Confirm reopen
          </button>
        </ProjectDialog>
      )}
      {overrideId && (
        <ProjectDialog
          title="Skip dependency"
          pending={mutation.isPending}
          onClose={() => setOverrideId(null)}
        >
          <form
            onSubmit={overrideForm.handleSubmit(async ({ reason }) => {
              try {
                await act(`dependencies/${overrideId}/override`, { reason });
                setOverrideId(null);
              } catch {
                /* Keep reason and show mutation error. */
              }
            })}
          >
            <p>
              This resolves this dependency only. The prerequisite Outcome
              retains its lifecycle and history.
            </p>
            <label className="projects-field">
              <span>Reason for dependency override</span>
              <textarea
                {...overrideForm.register('reason', { required: true })}
                required
              />
            </label>
            {mutation.error && <p role="alert">{mutation.error.message}</p>}
            <button
              className="projects-primary-button"
              disabled={mutation.isPending}
              type="submit"
            >
              Confirm skip dependency
            </button>
          </form>
        </ProjectDialog>
      )}
    </section>
  );
}
