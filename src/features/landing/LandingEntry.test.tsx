import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../lib/api';
import { LandingEntry } from './LandingEntry';

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth/auth-context', () => ({ useAuth: auth.useAuth }));
vi.mock('./LandingPage', () => ({
  LandingPage: () => <h1>Public Prometheus landing</h1>,
}));

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingEntry />} />
        <Route path="/workspace" element={<h1>Workspace Home</h1>} />
        <Route path="/access-denied" element={<h1>Access denied</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('session-aware landing entry', () => {
  beforeEach(() => {
    auth.useAuth.mockReturnValue({
      session: null,
      member: undefined,
      memberPending: false,
      memberError: null,
    });
  });

  it('renders the landing page for a signed-out visitor', () => {
    renderRoot();
    expect(screen.getByRole('heading', { name: 'Public Prometheus landing' })).toBeVisible();
  });

  it('waits for session bootstrap without flashing the landing page', () => {
    auth.useAuth.mockReturnValue({
      session: undefined,
      member: undefined,
      memberPending: false,
      memberError: null,
    });
    renderRoot();
    expect(screen.getByRole('main', { busy: true })).toBeInTheDocument();
    expect(screen.queryByText('Public Prometheus landing')).not.toBeInTheDocument();
  });

  it('waits while member access is being verified', () => {
    auth.useAuth.mockReturnValue({
      session: { user: { id: 'member-id' } },
      member: undefined,
      memberPending: true,
      memberError: null,
    });
    renderRoot();
    expect(screen.getByRole('main', { busy: true })).toBeInTheDocument();
    expect(screen.queryByText('Public Prometheus landing')).not.toBeInTheDocument();
  });

  it('takes an authorized member directly to the workspace', () => {
    auth.useAuth.mockReturnValue({
      session: { user: { id: 'member-id' } },
      member: { id: 'member-id' },
      memberPending: false,
      memberError: null,
    });
    renderRoot();
    expect(screen.getByRole('heading', { name: 'Workspace Home' })).toBeVisible();
    expect(screen.queryByText('Public Prometheus landing')).not.toBeInTheDocument();
  });

  it('takes denied members to their existing access screen', () => {
    auth.useAuth.mockReturnValue({
      session: { user: { id: 'member-id' } },
      member: undefined,
      memberPending: false,
      memberError: new ApiRequestError('denied', 403),
    });
    renderRoot();
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });

  it('uses the workspace retry screen for transient authorization failures', () => {
    auth.useAuth.mockReturnValue({
      session: { user: { id: 'member-id' } },
      member: undefined,
      memberPending: false,
      memberError: new ApiRequestError('offline'),
    });
    renderRoot();
    expect(screen.getByRole('heading', { name: 'Workspace Home' })).toBeVisible();
  });
});
