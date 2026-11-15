import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CreateProjectDialog } from './CreateProjectDialog';

vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({
  leads: [{ id: '11111111-1111-4111-8111-111111111111', fullName: 'Project Lead', email: 'lead@example.test' }], ventures: [],
})) }));

it('creates a project before any venture exists', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<QueryClientProvider client={new QueryClient()}><CreateProjectDialog accessToken="test" isSaving={false} saveError={null} onClose={vi.fn()} onSave={save} /></QueryClientProvider>);
  const button = await screen.findByRole('button', { name: 'Create Project' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Independent project' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'No venture grouping yet' } });
  fireEvent.change(screen.getByLabelText('Project Lead'), { target: { value: '11111111-1111-4111-8111-111111111111' } });
  fireEvent.click(button);
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ ventureIds: [] })));
});
