import { useQuery } from '@tanstack/react-query';
import {
  DatabaseHealthResponseSchema,
  HealthResponseSchema,
} from '../../../shared/contracts/health';
import { apiFetch } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';

function StatusCard({
  title,
  state,
  detail,
  testId,
}: {
  title: string;
  state: 'checking' | 'success' | 'error' | 'neutral';
  detail: string;
  testId?: string;
}) {
  const label = {
    checking: 'Checking',
    success: 'Connected',
    error: 'Unavailable',
    neutral: 'Ready',
  }[state];

  return (
    <article className="foundation-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[rgb(var(--text-muted))]">
            {title}
          </p>
          <p className="mt-2 text-xl font-semibold" data-testid={testId}>
            {label}
          </p>
        </div>
        <span className={`status-dot status-dot-${state}`} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm leading-6 text-[rgb(var(--text-muted))]">
        {detail}
      </p>
    </article>
  );
}

export function FoundationPage() {
  const apiHealth = useQuery({
    queryKey: ['foundation', 'api-health'],
    queryFn: () => apiFetch('/health', HealthResponseSchema),
  });

  const databaseHealth = useQuery({
    queryKey: ['foundation', 'database-health'],
    queryFn: () => apiFetch('/health/database', DatabaseHealthResponseSchema),
  });

  const supabaseConfigured = getSupabaseClient() !== null;
  const isRefreshing = apiHealth.isFetching || databaseHealth.isFetching;

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Phase 00</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Prometheus foundation
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgb(var(--text-muted))] sm:text-base">
              Minimal production scaffold for validating the browser, NestJS
              API, Prisma database path, and Supabase Auth configuration before
              product screens are built.
            </p>
          </div>
          <button
            type="button"
            className="foundation-button"
            disabled={isRefreshing}
            onClick={() => {
              void apiHealth.refetch();
              void databaseHealth.refetch();
            }}
          >
            {isRefreshing ? 'Checking...' : 'Run checks'}
          </button>
        </header>

        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="Foundation status"
        >
          <StatusCard
            title="NestJS API"
            state={
              apiHealth.isPending
                ? 'checking'
                : apiHealth.isSuccess
                  ? 'success'
                  : 'error'
            }
            testId="api-status"
            detail={
              apiHealth.isSuccess
                ? `Responded at ${new Date(apiHealth.data.timestamp).toLocaleTimeString()}.`
                : apiHealth.error instanceof Error
                  ? apiHealth.error.message
                  : 'Waiting for the API health endpoint.'
            }
          />
          <StatusCard
            title="Supabase PostgreSQL"
            state={
              databaseHealth.isPending
                ? 'checking'
                : databaseHealth.isSuccess
                  ? 'success'
                  : 'error'
            }
            detail={
              databaseHealth.isSuccess
                ? 'Prisma completed a real SELECT 1 query.'
                : databaseHealth.error instanceof Error
                  ? databaseHealth.error.message
                  : 'Waiting for database verification.'
            }
          />
          <StatusCard
            title="Supabase Auth"
            state={supabaseConfigured ? 'success' : 'neutral'}
            detail={
              supabaseConfigured
                ? 'Public Auth client configuration is present. Sign-in is implemented in Phase 01.'
                : 'Foundation is installed. Add the VITE_SUPABASE_* values to configure Auth.'
            }
          />
        </section>

        <section className="foundation-card mt-4">
          <p className="eyebrow">Current boundary</p>
          <h2 className="mt-2 text-xl font-semibold">Foundation only</h2>
          <p className="mt-3 text-sm leading-6 text-[rgb(var(--text-muted))]">
            Authentication flows, Registry, Projects, and business workflows
            intentionally remain out of scope until their implementation phases.
            Use the Phase 00 testcase file as the acceptance gate.
          </p>
        </section>
      </div>
    </main>
  );
}
