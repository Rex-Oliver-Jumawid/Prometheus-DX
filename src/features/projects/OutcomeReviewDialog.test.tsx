import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OutcomeDelivery } from '../../../shared/contracts/outcome-delivery';
import { OutcomeReviewDialog } from './OutcomeReviewDialog';

const delivery = {
  reviewDraft: null,
  outcomeUpdatedAt: '2026-09-22T00:00:00.000Z',
  submissions: [
    {
      id: 'submission-1',
      content: 'Test evidence',
      createdAt: '2026-09-22T00:00:00.000Z',
      submitter: { fullName: 'Test Member' },
    },
  ],
  criteria: [],
} as unknown as OutcomeDelivery;

function renderReview(
  perform: (action: string, body: unknown) => Promise<OutcomeDelivery>,
) {
  const actOnReview = vi.fn(perform);
  const onClose = vi.fn();
  render(
    <OutcomeReviewDialog
      data={delivery}
      pending={false}
      error={null}
      act={actOnReview}
      outcomeTitle="Test Outcome"
      outcomeDescription="Test Outcome"
      contributorNames={['Test Member']}
      onClose={onClose}
    />,
  );
  return { actOnReview, onClose };
}

describe('OutcomeReviewDialog feedback autosave', () => {
  it('submits feedback directly when the review action causes the textarea to blur', async () => {
    const { actOnReview, onClose } = renderReview(async () => delivery);
    const feedback = screen.getByRole('textbox', {
      name: 'Outcome review feedback',
    });
    const revision = screen.getByRole('button', {
      name: 'Request revision',
    });

    fireEvent.change(feedback, {
      target: { value: 'Add independent verification.' },
    });
    fireEvent.blur(feedback, { relatedTarget: revision });
    fireEvent.click(revision);

    await waitFor(() => {
      expect(actOnReview).toHaveBeenCalledWith(
        'request-revision',
        expect.objectContaining({ note: 'Add independent verification.' }),
      );
    });
    expect(actOnReview).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('waits for an in-flight draft save before requesting revision', async () => {
    let finishDraft!: (result: OutcomeDelivery) => void;
    const draft = new Promise<OutcomeDelivery>((resolve) => {
      finishDraft = resolve;
    });
    const { actOnReview } = renderReview((action) =>
      action === 'review-draft' ? draft : Promise.resolve(delivery),
    );
    const feedback = screen.getByRole('textbox', {
      name: 'Outcome review feedback',
    });
    fireEvent.change(feedback, {
      target: { value: 'Revise the supporting evidence.' },
    });
    fireEvent.blur(feedback);

    await waitFor(() => {
      expect(actOnReview).toHaveBeenCalledWith(
        'review-draft',
        expect.objectContaining({ note: 'Revise the supporting evidence.' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Request revision' }));

    await act(async () => {
      finishDraft({
        ...delivery,
        reviewDraft: {
          updatedAt: '2026-09-22T00:01:00.000Z',
        },
      } as OutcomeDelivery);
      await draft;
    });

    await waitFor(() => {
      expect(actOnReview).toHaveBeenCalledWith(
        'request-revision',
        expect.objectContaining({ note: 'Revise the supporting evidence.' }),
      );
    });
    expect(actOnReview.mock.calls.map(([action]) => action)).toEqual([
      'review-draft',
      'request-revision',
    ]);
  });
});
