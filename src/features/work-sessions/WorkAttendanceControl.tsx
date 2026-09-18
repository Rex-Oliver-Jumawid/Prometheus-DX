import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  CorrectWorkSessionResponseSchema,
  CurrentWorkSessionResponseSchema,
} from '../../../shared/contracts/work-session';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { scheduleKeys } from '../schedule/schedule-queries';
import {
  formatDuration,
  formatManilaDateTime,
  manilaInputToIso,
  toLocalDateTimeInput,
} from './work-session-format';
import {
  currentWorkSessionQuery,
  teamWorkKeys,
  workSessionKeys,
} from './work-session-queries';
import './work-sessions.css';

export function WorkAttendanceControl() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const current = useQuery(currentWorkSessionQuery(session?.access_token));
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [correctedTimeIn, setCorrectedTimeIn] = useState('');
  const [correctedTimeOut, setCorrectedTimeOut] = useState('');

  const active = current.data?.session ?? null;
  const activeId = active?.id;
  const activeStatus = active?.status;
  const activeTimeIn = active?.timeIn;
  const activeUpdatedAt = active?.updatedAt;
  useEffect(() => {
    if (!activeId || activeStatus !== 'OPEN') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeId, activeStatus, activeTimeIn]);

  useEffect(() => {
    if (activeStatus === 'NEEDS_CORRECTION' && activeTimeIn && activeUpdatedAt) {
      setCorrectedTimeIn(toLocalDateTimeInput(activeTimeIn));
      setCorrectedTimeOut(toLocalDateTimeInput(activeUpdatedAt));
      setExpanded(true);
    }
  }, [activeId, activeStatus, activeTimeIn, activeUpdatedAt]);

  const refreshAffectedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workSessionKeys.all }),
      queryClient.invalidateQueries({ queryKey: teamWorkKeys.all }),
      queryClient.invalidateQueries({ queryKey: scheduleKeys.team }),
    ]);
  };

  const mutation = useMutation({
    mutationFn: (action: 'time-in' | 'time-out') =>
      apiFetch(`/work-sessions/${action}`, CurrentWorkSessionResponseSchema, {
        accessToken: session?.access_token,
        method: 'POST',
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(workSessionKeys.current, response);
      await refreshAffectedQueries();
    },
  });

  const correction = useMutation({
    mutationFn: () =>
      apiFetch(
        `/work-sessions/${active?.id}/corrections`,
        CorrectWorkSessionResponseSchema,
        {
          accessToken: session?.access_token,
          method: 'POST',
          body: {
            newTimeIn: manilaInputToIso(correctedTimeIn),
            newTimeOut: manilaInputToIso(correctedTimeOut),
            reason,
          },
        },
      ),
    onSuccess: async () => {
      setReason('');
      setExpanded(false);
      await refreshAffectedQueries();
    },
  });

  if (current.isPending) {
    return (
      <div className="attendance-control loading">Loading attendance...</div>
    );
  }

  if (current.isError) {
    return (
      <div className="attendance-control error" role="alert">
        <span>Attendance unavailable</span>
        <button onClick={() => void current.refetch()}>Retry</button>
      </div>
    );
  }

  const elapsed =
    active?.status === 'OPEN'
      ? Math.max(0, Math.floor((now - Date.parse(active.timeIn)) / 1_000))
      : 0;

  return (
    <aside
      className={`attendance-control${active?.status === 'OPEN' ? ' active' : ''}${active?.status === 'NEEDS_CORRECTION' ? ' correction' : ''}`}
      aria-label="Time attendance"
    >
      <button
        className="attendance-main"
        type="button"
        disabled={mutation.isPending || active?.status === 'NEEDS_CORRECTION'}
        onClick={() =>
          mutation.mutate(active?.status === 'OPEN' ? 'time-out' : 'time-in')
        }
      >
        <span className="attendance-dot" aria-hidden="true" />
        <span>
          <strong>
            {active?.status === 'OPEN'
              ? 'Time Out'
              : active?.status === 'NEEDS_CORRECTION'
                ? 'Correction required'
                : 'Time In'}
          </strong>
          <small>
            {active?.status === 'OPEN'
              ? `Since ${formatManilaDateTime(active.timeIn)}`
              : active?.status === 'NEEDS_CORRECTION'
                ? 'Resolve the previous session to continue'
                : 'Start a persisted work session'}
          </small>
        </span>
        {active?.status === 'OPEN' && (
          <time aria-label="Elapsed work session">
            {formatDuration(elapsed)}
          </time>
        )}
      </button>

      {(mutation.isError || correction.isError) && (
        <p className="attendance-error" role="alert">
          {(mutation.error ?? correction.error)?.message}
        </p>
      )}

      {active?.status === 'NEEDS_CORRECTION' && (
        <div className="attendance-correction">
          <button
            className="attendance-expand"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide correction' : 'Correct session'}
          </button>
          {expanded && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                correction.mutate();
              }}
            >
              <label>
                <span>Correct Time In</span>
                <input
                  type="datetime-local"
                  required
                  value={correctedTimeIn}
                  onChange={(event) => setCorrectedTimeIn(event.target.value)}
                />
              </label>
              <label>
                <span>Correct Time Out</span>
                <input
                  type="datetime-local"
                  required
                  value={correctedTimeOut}
                  onChange={(event) => setCorrectedTimeOut(event.target.value)}
                />
              </label>
              <label>
                <span>Reason</span>
                <textarea
                  required
                  minLength={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <button
                disabled={correction.isPending || reason.trim().length < 3}
              >
                {correction.isPending ? 'Saving...' : 'Save correction'}
              </button>
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
