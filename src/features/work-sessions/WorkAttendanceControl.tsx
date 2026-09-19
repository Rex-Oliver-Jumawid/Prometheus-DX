import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
  const [edgeOpen, setEdgeOpen] = useState(false);
  const attendanceRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!edgeOpen) return undefined;

    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        attendanceRef.current &&
        !attendanceRef.current.contains(target)
      ) {
        setEdgeOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, [edgeOpen]);

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
      <aside
        className="attendance-control attendance-edge-time pending"
        aria-label="Time attendance"
        aria-busy="true"
      >
        <span className="attendance-pending-handle" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="attendance-edge-handle-dot" />
        </span>
      </aside>
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

  const handleAttendanceAction = () => {
    const finePointer =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(hover:hover) and (pointer:fine)').matches;

    if (!finePointer && !edgeOpen) {
      setEdgeOpen(true);
      return;
    }

    mutation.mutate(active?.status === 'OPEN' ? 'time-out' : 'time-in');
  };

  return (
    <aside
      ref={attendanceRef}
      className={`attendance-control attendance-edge-time${active?.status === 'OPEN' ? ' active' : ''}${active?.status === 'NEEDS_CORRECTION' ? ' correction' : ''}${edgeOpen ? ' edge-open' : ''}`}
      aria-label="Time attendance"
    >
      <button
        className="attendance-main"
        type="button"
        disabled={mutation.isPending || active?.status === 'NEEDS_CORRECTION'}
        onClick={handleAttendanceAction}
        aria-label={
          active?.status === 'OPEN'
            ? 'Time Out'
            : active?.status === 'NEEDS_CORRECTION'
              ? 'Correction required'
              : 'Time In'
        }
      >
        <span className="attendance-edge-handle" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="attendance-edge-handle-dot" />
        </span>

        <span className="attendance-edge-panel">
          <span className="attendance-progress" aria-hidden="true" />
          <span className="attendance-content">
            <span className="attendance-dot" aria-hidden="true" />
            <span className="attendance-copy">
              <span className="attendance-topline">
                <strong>
                  {active?.status === 'OPEN'
                    ? 'Time Out'
                    : active?.status === 'NEEDS_CORRECTION'
                      ? 'Correction required'
                      : 'Time In'}
                </strong>
                {active?.status === 'OPEN' && (
                  <time aria-label="Elapsed work session">
                    {formatDuration(elapsed)}
                  </time>
                )}
              </span>
              <small>
                {active?.status === 'OPEN'
                  ? `Since ${formatManilaDateTime(active.timeIn)}`
                  : active?.status === 'NEEDS_CORRECTION'
                    ? 'Resolve the previous session to continue'
                    : 'Start a work session'}
              </small>
              <span className="attendance-progress-text">
                {active?.status === 'OPEN'
                  ? 'Work session in progress'
                  : active?.status === 'NEEDS_CORRECTION'
                    ? 'Correction required before continuing'
                    : 'No active work session'}
              </span>
            </span>
          </span>
        </span>
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
