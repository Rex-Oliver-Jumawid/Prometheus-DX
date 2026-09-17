import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDialog } from './ProjectDialog';

describe('ProjectDialog', () => {
  it('locks body scrolling and restores the previously focused control on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <ProjectDialog title="Edit project" onClose={() => undefined}>
        <button type="button">Save</button>
      </ProjectDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Edit project' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    trigger.remove();
  });

  it('closes from Escape and backdrop dismissal when not pending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ProjectDialog title="Edit project" onClose={onClose}>
        <button type="button">Save</button>
      </ProjectDialog>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = screen.getByRole('dialog', { name: 'Edit project' })
      .parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('prevents dismissal while a mutation is pending', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ProjectDialog title="Edit project" onClose={onClose} pending>
        <button type="button">Save</button>
      </ProjectDialog>,
    );

    expect(
      screen.getByRole('button', { name: 'Close Edit project' }),
    ).toBeDisabled();

    await user.keyboard('{Escape}');
    const backdrop = screen.getByRole('dialog', { name: 'Edit project' })
      .parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(
      <ProjectDialog title="Edit project" onClose={() => undefined}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </ProjectDialog>,
    );

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Close Edit project' }),
    ).toHaveFocus();
  });
});
