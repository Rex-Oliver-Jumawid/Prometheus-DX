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
  const [formError, setFormError] = useState<string | null>(null);

  const perform = (action: 'draft' | 'submissions') =>
    handleSubmit(async (values) => {
      if (inFlight.current) return;
      setFormError(null);
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
          setSaved(false);
        } else {
          setSaved(true);
        }
      } catch (err) {
        setFormError((err as Error).message || 'Failed to save delivery output.');
      } finally {
        inFlight.current = false;
      }
    });

  return (
    <div className="output-editor">
      <div className="pw-output-current">
        <div className="pw-output-current-copy">
          <span className="pw-output-current-label">Working submission</span>
          <strong className="pw-output-current-version">
            {data.submissions.length === 0
              ? 'First submission'
              : `Version ${data.submissions.length + 1}`}
          </strong>
        </div>
        <small className="pw-output-current-help">
          Prepare the output you want the Project Lead to verify.
        </small>
      </div>
      <form
        className="outcome-work-form"
        onSubmit={perform('submissions')}
        noValidate
      >
        <div className="field">
          <label className="field-label">Output name or link</label>
          <input
            className="field-input"
            aria-label="Output content"
            placeholder="Build URL, GitHub PR, Figma link, document, client approval..."
            {...register('content', {
              onChange: () => {
                requestId.current = null;
                setSaved(false);
                setFormError(null);
              },
            })}
            disabled={!data.canSubmit || pending}
            aria-invalid={Boolean(errors.content)}
          />
          {errors.content && (
            <small role="alert" className="field-error-msg">{errors.content.message}</small>
          )}
        </div>
        <div className="field">
          <label className="field-label">
            What changed / submission notes
          </label>
          <textarea
            className="field-textarea"
            aria-label="Submission notes"
            placeholder="Explain what you produced, what changed since the previous version, and what the Project Lead should verify."
            {...register('note', {
              onChange: () => {
                requestId.current = null;
                setSaved(false);
                setFormError(null);
              },
            })}
            disabled={!data.canSubmit || pending}
          />
        </div>
        {formError && (
          <p role="alert" className="projects-save-error" style={{ margin: '6px 0 2px' }}>
            {formError}
          </p>
        )}
        <div className="output-actions-row">
          {saved && <span role="status" className="draft-saved-indicator">Draft saved</span>}
          <button
            className="projects-secondary-button pw-draft-btn"
            type="button"
            disabled={!data.canSubmit || pending}
            onClick={() => void perform('draft')()}
          >
            Save draft
          </button>
          <button
            className="projects-primary-button pw-submit-btn"
            type="submit"
            disabled={!data.canSubmit || pending}
          >
            {pending ? 'Saving...' : 'Submit for review'}
          </button>
        </div>
        {data.draft && (
          <p className="workflow-empty-note" style={{ textAlign: 'right', marginTop: '4px' }}>
            Draft saved {new Date(data.draft.updatedAt).toLocaleString()}
          </p>
        )}
      </form>
    </div>
  );
}

export function OutcomeDeliveryPanel({
  projectId,
  outcomeId,
  accessToken,
  isJoined,
  outcomeTitle,
  outcomeDescription,
  departmentLabels = [],
}: {
  projectId: string;
  outcomeId: string;
  accessToken?: string;
  isJoined: boolean;
  outcomeTitle: string;
  outcomeDescription: string;
  departmentLabels?: string[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Submission | null>(null);
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
      <section
        className="work-section output-work-section outcome-skeleton-card"
        aria-label="Loading submissions"
        aria-busy="true"
      >
        <div className="work-section-head pw-sk-header-row">
          <div className="output-section-title-row pw-sk-icon-title-group">
            <div className="pw-sk-shimmer pw-sk-icon" />
            <div className="pw-sk-title-group">
              <div className="pw-sk-line pw-sk-title" />
              <div className="pw-sk-line pw-sk-desc" />
            </div>
          </div>
        </div>
        <div className="pw-sk-output-form">
          <div className="pw-sk-line" style={{ width: 90, height: 10 }} />
          <div className="pw-sk-shimmer pw-sk-textarea" />
          <div className="pw-sk-actions-row">
            <div className="pw-sk-shimmer" style={{ width: 75, height: 26, borderRadius: 8 }} />
            <div className="pw-sk-shimmer" style={{ width: 110, height: 26, borderRadius: 8 }} />
          </div>
        </div>
        <div className="pw-sk-submissions-block">
          <div className="pw-sk-header-row" style={{ marginBottom: 4 }}>
            <div className="pw-sk-line" style={{ width: 110, height: 12 }} />
            <div
              className="pw-sk-shimmer"
              style={{ width: 68, height: 15, borderRadius: 999 }}
            />
          </div>
          <div className="pw-sk-submission-item">
            <div className="pw-sk-shimmer" style={{ width: 22, height: 22, borderRadius: '50%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <div className="pw-sk-line" style={{ width: 130, height: 10 }} />
              <div className="pw-sk-line" style={{ width: 210, height: 9 }} />
            </div>
          </div>
        </div>
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
  const isContributor = isJoined;
  const currentAcceptance =
    data.acceptances.find((item) => !item.reopenedAt) ?? data.acceptances[0];
  const unresolvedDependencies = data.dependencies.filter(
    (item) => !item.resolved,
  );
  const selectedIndex = selected
    ? data.submissions.findIndex((item) => item.id === selected.id)
    : -1;
  const selectedVersion =
    selectedIndex >= 0 ? data.submissions.length - selectedIndex : null;
  const selectedState =
    selected?.reviewStatus === 'FOR_REVIEW' ? 'For Review' : 'Reviewed';
  const contributorNames = Array.from(
    new Set(data.submissions.map((item) => item.submitter.fullName)),
  );

  return (
    <section
      className={`work-section output-work-section${accepted ? ' accepted-outcome-section' : ''}`}
      aria-label="Outputs and feedback"
    >
      <header className="work-section-head">
        <div className="output-section-title-row">
          <div className="output-section-icon" aria-hidden="true">
            ▱
          </div>
          <div>
            <h3 id="outcome-delivery-title">
              {accepted
                ? 'Accepted Outcome'
                : isContributor
                  ? 'My Outputs & Feedback'
                  : data.isLead
                    ? 'Outcome Submissions'
                    : 'Submitted Outputs'}
            </h3>
            <p>
              {accepted
                ? `This outcome is final. ${data.submissions.length} team submission${data.submissions.length === 1 ? ' was' : 's were'} preserved as the evidence behind the decision.`
                : isContributor
                  ? 'Your submission is added to the shared outcome record. The Project Lead reviews all team submissions together.'
                  : data.isLead
                    ? (data.submissions.length > 0
                        ? 'Review all team submissions together, verify the acceptance criteria, then make one decision for the outcome.'
                        : 'No submitted work is available for Project Lead review yet.')
                    : 'Every member submission is preserved and reviewed as part of the outcome.'}
            </p>
          </div>
        </div>
        <div className="pw-output-head-actions">
          <span
            className={`output-status ${accepted ? 'accepted' : data.hasForReview ? 'review' : 'draft'}`}
          >
            {accepted
              ? 'Accepted'
              : data.hasForReview
                ? 'For review'
                : 'Draft'}
          </span>
        </div>
      </header>
      <div className={accepted ? 'pw-accepted-outcome-body' : undefined}>
      {accepted && (
        <div className="pw-outcome-accepted-banner">
          <div className="pw-outcome-accepted-icon" aria-hidden="true">
            ✓
          </div>
          <div>
            <strong>Outcome accepted - submissions are closed</strong>
            <p>
              The Project Lead accepted the combined work for this outcome.
              Members can still view the work and submission history, but no new
              drafts or submissions can be added.
            </p>
          </div>
        </div>
      )}
      {data.isLead && data.lifecycleStatus === 'NEEDS_REVISION' && (
        <div className="outcome-work-actions">
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
        </div>
      )}
      {Boolean(data.revisions?.length) && (
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
      {isContributor && !accepted && (
        <OutputForm
          key={outcomeId}
          data={data}
          pending={mutation.isPending}
          save={act}
        />
      )}
      <section className="pw-submission-history">
        <div className="pw-submission-history-head">
          <div>
            <h4>Team submissions</h4>
            <p>Every member submission is preserved and reviewed as part of the outcome.</p>
          </div>
          <div className="pw-submission-history-actions">
            <span className="pw-submission-count">
              {data.submissions.length} submission
              {data.submissions.length === 1 ? '' : 's'}
            </span>
            {data.isLead && !accepted && data.submissions.length > 0 && (
              <button
                className="projects-primary-button pw-review-outcome-jump"
                type="button"
                onClick={() => {
                  mutation.reset();
                  setReviewOpen(true);
                }}
              >
                Review outcome
              </button>
            )}
          </div>
        </div>
        {!data.submissions.length && (
          <div className="empty-submissions">
            {data.isLead
              ? 'No output has been submitted for Project Lead verification yet.'
              : 'No submissions yet.'}
          </div>
        )}
        <div className="outcome-submission-list">
          {data.submissions.map((submission, index) => (
            <button
              className={`outcome-submission-card${index === 0 ? ' latest' : ''}${accepted ? ' accepted-evidence' : ''}`}
              type="button"
              key={submission.id}
              onClick={() => setSelected(submission)}
            >
              <div className="outcome-sub-card-content">
                <div className="outcome-sub-card-top">
                  <span className="outcome-sub-version-row">
                    <span className="outcome-sub-version-badge">
                      v{data.submissions.length - index}
                    </span>
                    {index === 0 && (
                      <span className="outcome-sub-latest-badge">Latest</span>
                    )}
                  </span>
                  <span
                    className={`outcome-sub-status-badge ${accepted ? 'accepted' : submission.reviewStatus.toLowerCase()}`}
                  >
                    {accepted
                      ? 'Accepted'
                      : submission.reviewStatus === 'FOR_REVIEW'
                        ? 'For review'
                        : 'Reviewed'}
                  </span>
                </div>
                <strong className="outcome-sub-title">
                  {submission.content}
                </strong>
                <span className="outcome-sub-meta">
                  {accepted
                    ? `Accepted by ${currentAcceptance?.acceptedBy.fullName ?? 'Project Lead'}`
                    : (
                        <>
                          Submitted by {submission.submitter.fullName} ·{' '}
                          {new Date(submission.createdAt).toLocaleString()}
                        </>
                      )}
                </span>
                <span className="outcome-sub-link">View submission →</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      </div>
      {data.acceptances.length > 0 && (
        <section
          className="outcome-acceptance-history"
          aria-label="Review history"
        >
          <div className="outcome-acceptance-history-head">
            <h4>Review history</h4>
            {data.isLead && accepted && (
              <button
                className="projects-secondary-button outcome-reopen-button"
                type="button"
                onClick={() => setReopenVersion(data.outcomeUpdatedAt)}
              >
                Reopen Outcome
              </button>
            )}
          </div>
          {data.acceptances.map((item) => (
            <details key={item.id}>
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
      {data.isLead && unresolvedDependencies.length > 0 && (
        <section
          className="outcome-dependency-actions"
          aria-label="Dependency actions"
        >
          <div className="outcome-dependency-actions-head">
            <div>
              <h4>Dependency action required</h4>
              <p>
                Resolve the prerequisite or explicitly skip it before this
                outcome can continue.
              </p>
            </div>
          </div>
          <div className="outcome-dependency-action-list">
            {unresolvedDependencies.map((item) => (
              <article key={item.id} className="outcome-dependency-action-card">
                <div className="outcome-dependency-action-copy">
                  <Link
                    to={`/projects/${projectId}/outcomes/${item.prerequisiteId}`}
                    className="outcome-dependency-action-title"
                  >
                    {item.title}
                  </Link>
                  <span className="outcome-dependency-action-status">
                    Waiting
                  </span>
                </div>
                <button
                  className="projects-secondary-button outcome-dependency-skip"
                  type="button"
                  onClick={() => {
                    overrideForm.reset();
                    setOverrideId(item.id);
                  }}
                >
                  Skip dependency
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <ProjectDialog
          title="Submission record"
          subtitle={`v${selectedVersion ?? 1} · ${selected.content}`}
          pending={mutation.isPending}
          className="submission-record-dialog"
          bodyClassName="submission-record-body"
          onClose={() => setSelected(null)}
        >
          {mutation.error && (
            <p role="alert" className="projects-save-error">
              {mutation.error.message}
            </p>
          )}
          <section className="submission-record-member-pane">
            <span className="submission-record-kicker">Member submission</span>
            <h3>{selected.content}</h3>
            <p className="submission-record-intro">
              Immutable record of this member contribution to the outcome.
            </p>

            <div className="submission-record-meta-row">
              <span>
                Version <strong>v{selectedVersion ?? 1}</strong>
              </span>
              <span>
                State <strong>{selectedState}</strong>
              </span>
              <span>
                Submitted by <strong>{selected.submitter.fullName}</strong>
              </span>
              <span>
                Departments{' '}
                <strong>
                  {departmentLabels.length > 0
                    ? departmentLabels.join(', ')
                    : 'General'}
                </strong>
              </span>
            </div>

            <div className="submission-record-field">
              <span>Submitted / reviewed</span>
              <strong>
                Submitted {new Date(selected.createdAt).toLocaleString()} ·{' '}
                {selected.submitter.fullName}
              </strong>
            </div>

            <div className="submission-record-field">
              <span>Output name or link</span>
              <OutputContent content={selected.content} />
            </div>

            <div className="submission-record-field">
              <span>Submission notes</span>
              <strong>{selected.note || 'No notes provided.'}</strong>
            </div>

            {selected.reviews.length > 0 && (
              <div className="submission-record-review-history">
                {selected.reviews.map((item) => (
                  <article key={item.id}>
                    <span>Reviewed by {item.reviewer.fullName}</span>
                    <strong>
                      {item.note || 'Reviewed without additional notes.'}
                    </strong>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="submission-record-review-pane">
            <span className="submission-record-kicker">Outcome-level review</span>
            <h3>Reviewed with the full submission set</h3>
            <p className="submission-record-intro">
              This is one team contribution. Return to the outcome review to
              verify it together with every current submission and the
              acceptance criteria.
            </p>

            <div className="submission-record-outcome">
              <span>Outcome to satisfy</span>
              <strong>{outcomeDescription}</strong>
            </div>

            <div className="submission-record-status-card">
              <div>
                <strong>Submission status</strong>
                <span>{selectedState}</span>
              </div>
              <p>
                Individual submissions are not accepted or rejected
                independently. The Project Lead makes one outcome-level
                decision from the combined submission set.
              </p>
            </div>

            {data.isLead && !accepted && (
              <div className="submission-record-actions">
                <button
                  className="projects-primary-button"
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setReviewOpen(true);
                  }}
                >
                  Continue to outcome review
                </button>

              </div>
            )}
          </section>
        </ProjectDialog>
      )}
      {reviewOpen && (
        <OutcomeReviewDialog
          data={data}
          pending={mutation.isPending}
          error={mutation.error}
          act={act}
          outcomeTitle={outcomeTitle}
          outcomeDescription={outcomeDescription}
          contributorNames={contributorNames}
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
