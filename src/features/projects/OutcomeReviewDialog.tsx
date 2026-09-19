import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { OutcomeDelivery } from '../../../shared/contracts/outcome-delivery';
import { ProjectDialog } from './ProjectDialog';
import { OutputContent } from './OutputContent';

function submittedLabel(createdAt: string, submitter: string) {
  const submitted = new Date(createdAt);
  const today = new Date();
  const sameDay =
    submitted.getFullYear() === today.getFullYear() &&
    submitted.getMonth() === today.getMonth() &&
    submitted.getDate() === today.getDate();
  return `Submitted ${sameDay ? 'today' : submitted.toLocaleDateString()} · ${submitter}`;
}

export function OutcomeReviewDialog({
  data,
  pending,
  error,
  act,
  outcomeTitle,
  outcomeDescription,
  contributorNames,
  onClose,
}: {
  data: OutcomeDelivery;
  pending: boolean;
  error: Error | null;
  act: (action: string, body: unknown) => Promise<OutcomeDelivery>;
  outcomeTitle: string;
  outcomeDescription: string;
  contributorNames: string[];
  onClose: () => void;
}) {
  const [reviewedData] = useState(data);
  const draftVersion = useRef(data.reviewDraft?.updatedAt ?? null);
  const busy = useRef(false);
  const [notice, setNotice] = useState('');
  const { register, watch, setValue, getValues, handleSubmit } = useForm({
    defaultValues: {
      note: data.reviewDraft?.note ?? '',
      criterionIds: data.reviewDraft?.criterionIds ?? [],
    },
  });
  const checked = watch('criterionIds');

  const saveDraft = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const saved = await act('review-draft', {
        ...getValues(),
        updatedAt: draftVersion.current,
        submissionIds: reviewedData.submissions.map((item) => item.id),
      });
      draftVersion.current = saved.reviewDraft?.updatedAt ?? null;
      setNotice('Review preparation saved.');
    } catch {
      /* Display the parent's mutation error and preserve the review. */
    } finally {
      busy.current = false;
    }
  };

  const decide = (action: 'accept' | 'request-revision') =>
    handleSubmit(async (values) => {
      if (busy.current) return;
      if (action === 'request-revision' && !values.note.trim()) {
        setNotice('Explain what the team must revise.');
        return;
      }
      if (
        action === 'accept' &&
        reviewedData.criteria.some(
          (item) => !values.criterionIds.includes(item.id),
        )
      ) {
        setNotice(
          'Verify every acceptance criterion against the combined submissions before accepting.',
        );
        return;
      }
      busy.current = true;
      try {
        await act(action, {
          ...values,
          outcomeUpdatedAt: reviewedData.outcomeUpdatedAt,
          submissionIds: reviewedData.submissions.map((item) => item.id),
        });
        onClose();
      } catch {
        /* Preserve the decision form on failure. */
      } finally {
        busy.current = false;
      }
    });

  const latest = reviewedData.submissions[0];

  return (
    <ProjectDialog
      title="Review all member submissions together against the expected outcome."
      ariaLabel="Review Outcome"
      eyebrow="Project Lead verification"
      tag="Outcome review"
      pending={pending}
      className="outcome-review-dialog"
      bodyClassName="outcome-review-dialog-body"
      onClose={onClose}
    >
      <div className="outcome-review-meta">
        <span>
          Contributors{' '}
          <strong>
            {contributorNames.length > 0
              ? contributorNames.join(', ')
              : 'No contributors'}
          </strong>
        </span>
        <span>
          Submissions <strong>{reviewedData.submissions.length} total</strong>
        </span>
        {latest && (
          <span>{submittedLabel(latest.createdAt, latest.submitter.fullName)}</span>
        )}
      </div>

      <div className="outcome-review-summary-grid">
        <section className="outcome-review-summary-card">
          <span className="outcome-review-step">1. Outcome to satisfy</span>
          <strong>{outcomeDescription || outcomeTitle}</strong>
        </section>

        <section className="outcome-review-summary-card outcome-review-submissions">
          <span className="outcome-review-step">2. Team submissions</span>
          <div className="outcome-review-submission-list">
            {reviewedData.submissions.map((item, index) => (
              <article key={item.id}>
                <div>
                  <strong>{item.submitter.fullName}</strong>
                  <span>v{reviewedData.submissions.length - index}</span>
                </div>
                <OutputContent content={item.content} />
              </article>
            ))}
          </div>
        </section>
      </div>

      <form
        className="outcome-review-form"
        onSubmit={decide('accept')}
        noValidate
      >
        <section className="outcome-review-criteria-panel">
          <div className="outcome-review-panel-head">
            <span className="outcome-review-step">
              3. Verify acceptance criteria
            </span>
            <span>
              {checked.length} / {reviewedData.criteria.length} verified
            </span>
          </div>

          {!reviewedData.criteria.length && (
            <p className="outcome-review-empty">
              No acceptance criteria were defined.
            </p>
          )}

          <div className="outcome-review-criteria-list">
            {reviewedData.criteria.map((criterion) => (
              <label className="outcome-review-criterion" key={criterion.id}>
                <input
                  type="checkbox"
                  checked={checked.includes(criterion.id)}
                  disabled={pending}
                  onChange={(event) => {
                    setValue(
                      'criterionIds',
                      event.target.checked
                        ? [...checked, criterion.id]
                        : checked.filter((id) => id !== criterion.id),
                    );
                    void saveDraft();
                  }}
                />
                <span>{criterion.description}</span>
              </label>
            ))}
          </div>
        </section>

        <label className="outcome-review-feedback">
          <span className="outcome-review-step">
            4. Outcome review feedback
          </span>
          <textarea
            aria-label="Outcome review feedback"
            placeholder="Record what passed, or explain exactly what must be revised."
            {...register('note', {
              onBlur: () => void saveDraft(),
            })}
            disabled={pending}
          />
        </label>

        {notice && <p role="status" className="outcome-review-notice">{notice}</p>}
        {error && (
          <p role="alert" className="projects-save-error">
            {error.message}
          </p>
        )}

        <footer className="outcome-review-actions">
          <button
            className="projects-secondary-button"
            type="button"
            aria-label="Request revision"
            disabled={pending}
            onClick={() => void decide('request-revision')()}
          >
            Needs revision
          </button>
          <button
            className="projects-primary-button"
            type="submit"
            aria-label="Accept Outcome"
            disabled={pending}
          >
            Accept outcome
          </button>
        </footer>
      </form>
    </ProjectDialog>
  );
}
