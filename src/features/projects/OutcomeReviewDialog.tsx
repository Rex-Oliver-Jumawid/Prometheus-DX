import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { OutcomeDelivery } from '../../../shared/contracts/outcome-delivery';
import { ProjectDialog } from './ProjectDialog';
import { OutputContent } from './OutputContent';

export function OutcomeReviewDialog({
  data,
  pending,
  error,
  act,
  onClose,
}: {
  data: OutcomeDelivery;
  pending: boolean;
  error: Error | null;
  act: (action: string, body: unknown) => Promise<OutcomeDelivery>;
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
  return (
    <ProjectDialog title="Review Outcome" pending={pending} onClose={onClose}>
      <p>
        Review all team submissions together and make one decision for the
        Outcome.
      </p>
      <div className="outcome-review-evidence">
        {reviewedData.submissions.map((item) => (
          <article key={item.id}>
            <strong>{item.submitter.fullName}</strong>
            <OutputContent content={item.content} />
            {item.note && <p>{item.note}</p>}
          </article>
        ))}
      </div>
      <form onSubmit={decide('accept')} noValidate>
        <h3>Acceptance criteria</h3>
        <p>
          {checked.length} / {reviewedData.criteria.length} verified
        </p>
        {!reviewedData.criteria.length && (
          <p>No acceptance criteria were defined.</p>
        )}
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
        <label className="projects-field">
          <span>Outcome review feedback</span>
          <textarea
            aria-label="Outcome review feedback"
            {...register('note')}
            disabled={pending}
          />
        </label>
        <button
          className="workflow-icon-button"
          type="button"
          disabled={pending}
          onClick={() => void saveDraft()}
        >
          Save review notes
        </button>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="projects-save-error">
            {error.message}
          </p>
        )}
        <footer className="projects-dialog-actions">
          <button
            className="projects-secondary-button"
            type="button"
            disabled={pending}
            onClick={() => void decide('request-revision')()}
          >
            Request revision
          </button>
          <button
            className="projects-primary-button"
            type="submit"
            disabled={pending}
          >
            Accept Outcome
          </button>
        </footer>
      </form>
    </ProjectDialog>
  );
}
