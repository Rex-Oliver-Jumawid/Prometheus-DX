import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/api';
import { RoomPanel } from './VisiWorkPage';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  apiFetch: vi.fn(),
}));

vi.mock('../../lib/use-realtime-invalidation', () => ({
  useRealtimeInvalidation: () => () => undefined,
}));

function renderRoom(departmentId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RoomPanel
          roomType={departmentId ? 'DEPARTMENT ROOM' : 'GENERAL ROOM'}
          title={departmentId ? 'R&D Chat' : 'General Chat'}
          subtitle="Company chat"
          accessToken="test-token"
          currentMemberId="11111111-1111-4111-8111-111111111111"
          departmentId={departmentId}
          mentionMembers={[]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VisiWork general and department chat composer', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockImplementation((_path, _schema, options) =>
      options?.method === 'POST'
        ? Promise.resolve({ id: '33333333-3333-4333-8333-333333333333' })
        : Promise.resolve({ items: [], nextCursor: null, canWrite: true }),
    );
  });

  it.each([
    ['general', undefined, '/visiwork/messages', 'Message General Chat'],
    [
      'department',
      '22222222-2222-4222-8222-222222222222',
      '/visiwork/departments/22222222-2222-4222-8222-222222222222/messages',
      'Message R&D Chat',
    ],
  ])('%s chat supports Enter, Shift+Enter and uninterrupted typing', async (
    _room, departmentId, endpoint, label,
  ) => {
    renderRoom(departmentId);
    const input = await screen.findByRole('textbox', { name: label });
    fireEvent.change(input, { target: { value: 'First line' } });
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(vi.mocked(apiFetch).mock.calls.some(([, , options]) => options?.method === 'POST')).toBe(false);

    fireEvent.change(input, { target: { value: 'First line\nSecond line' } });
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })).toBe(false);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      endpoint,
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: {
          body: 'First line\nSecond line',
          mentionMemberIds: [],
        },
      }),
    ));
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Next message' } });
    expect(input).toHaveValue('Next message');
  });
});
