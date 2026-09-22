import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDialog } from './ProjectDialog';

describe('ProjectDialog', () => {
  it('closes with Escape and restores focus to the invoking control', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <ProjectDialog title="Edit project" onClose={onClose}>
        <button type="button">Save</button>
      </ProjectDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Edit project' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('closes from the backdrop but not from dialog content', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ProjectDialog title="Edit project" onClose={onClose}>
        <button type="button">Save</button>
      </ProjectDialog>,
    );
    const backdrop = container.ownerDocument.querySelector(
      '.projects-dialog-backdrop',
    );
    expect(backdrop).not.toBeNull();

    fireEvent.click(screen.getByRole('dialog', { name: 'Edit project' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the dialog accessible name for the close button', () => {
    const onClose = vi.fn();
    render(
      <ProjectDialog
        title="Review all member submissions together against the expected outcome."
        ariaLabel="Review Outcome"
        onClose={onClose}
      >
        <p>Review details</p>
      </ProjectDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Review Outcome' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Review Outcome' }),
    );
    expect(dialog).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks dismissal while an operation is pending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <ProjectDialog title="Edit project" onClose={onClose} pending>
        <button type="button">Save</button>
      </ProjectDialog>,
    );

    expect(screen.getByRole('button', { name: 'Close Edit project' })).toBeDisabled();
    await user.keyboard('{Escape}');
    fireEvent.click(container.ownerDocument.querySelector('.projects-dialog-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
