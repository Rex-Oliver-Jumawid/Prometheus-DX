import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CorrectWorkSessionResponseSchema,
  CurrentWorkSessionResponseSchema,
  TimeOutWorkSessionRequestSchema,
  WorkSessionActivityResponseSchema,
} from '../../../shared/contracts/work-session';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { homeKeys } from '../home/home-queries';
import { scheduleKeys } from '../schedule/schedule-queries';
import {
  formatDuration,
  formatManilaDateTime,
  manilaInputToIso,
  toLocalDateTimeInput,
} from './work-session-format';
import {
  currentWorkSessionQuery,
  teamWorkSummaryQuery,
  teamWorkKeys,
  workSessionKeys,
} from './work-session-queries';
import './work-sessions.css';

export function WorkAttendanceControl() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const current = useQuery(currentWorkSessionQuery(session?.access_token));
  const team = useQuery(teamWorkSummaryQuery(session?.access_token));
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [edgeOpen, setEdgeOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const attendanceRef = useRef<HTMLElement>(null);
  const [reason, setReason] = useState('');
  const [timeOutOpen, setTimeOutOpen] = useState(false);
  const [workSummary, setWorkSummary] = useState('');
  const [correctedTimeIn, setCorrectedTimeIn] = useState('');
  const [correctedTimeOut, setCorrectedTimeOut] = useState('');

  const workingMembers = team.data?.members.filter((member) => member.workingNow) ?? [];
  const visibleMembers = workingMembers.slice(0, 3);
  const remainingCount = workingMembers.length - visibleMembers.length;
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

  // Native device banner, not an in-app reminder. Server-side activity
  // tracking and scheduled Web Push handle sessions after the tab is suspended.
  useEffect(() => {
    const accessToken = session?.access_token;
    if (!activeId || activeStatus !== 'OPEN' || !accessToken) return undefined;

    let lastActivityAt = Date.now();
    let lastReportedAt = 0;
    let reminded = false;
    let stopped = false;
    const reportActivity = () => {
      const now = Date.now();
      if (now - lastReportedAt < 120_000) return;
      lastReportedAt = now;
      void apiFetch('/work-sessions/activity', WorkSessionActivityResponseSchema, {
        accessToken,
        method: 'POST',
      }).catch(() => {
        // Activity updates are best-effort: never interrupt the running timer.
      });
    };
    const recordActivity = () => {
      lastActivityAt = Date.now();
      reminded = false;
      if (document.visibilityState === 'visible') reportActivity();
    };
    const remindIfIdle = () => {
      if (stopped || reminded || Date.now() - lastActivityAt < 30 * 60_000) return;
      reminded = true;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const title = 'Prometheus DX · Still working?';
      const options: NotificationOptions = {
        body: 'Your work session is still running after 30 minutes without activity.',
        tag: 'prometheus-work-session-idle-' + activeId,
        data: { url: '/schedule?view=shifts' },
      };
      void (async () => {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          if (!stopped) await registration.showNotification(title, options);
        } else if (!stopped) {
          new Notification(title, options);
        }
      })().catch(() => undefined);
    };
    reportActivity();
    for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
      document.addEventListener(event, recordActivity, { passive: true });
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recordActivity();
      else remindIfIdle();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(remindIfIdle, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      for (const event of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
        document.removeEventListener(event, recordActivity);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeId, activeStatus, session?.access_token]);

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
        setPeopleOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, [edgeOpen]);

  useEffect(() => {
    if (!peopleOpen) return undefined;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeopleOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [peopleOpen]);

  const refreshAffectedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: workSessionKeys.all }),
      queryClient.invalidateQueries({ queryKey: teamWorkKeys.all }),
      queryClient.invalidateQueries({ queryKey: homeKeys.all }),
      queryClient.invalidateQueries({ queryKey: scheduleKeys.team }),
    ]);
  };

  const mutation = useMutation({
    mutationFn: (input: { action: 'time-in' | 'time-out'; summary?: string }) =>
      apiFetch(`/work-sessions/${input.action}`, CurrentWorkSessionResponseSchema, {
        accessToken: session?.access_token,
        method: 'POST',
        ...(input.action === 'time-out'
          ? { body: TimeOutWorkSessionRequestSchema.parse({ summary: input.summary }) }
          : {}),
      }),
    onSuccess: async (response, input) => {
      if (input.action === 'time-out') {
        setTimeOutOpen(false);
        setWorkSummary('');
      }
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

  if (current.isPending && !current.data) {
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

  if (current.isError && !current.data) {
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

    if (active?.status === 'OPEN') {
      setTimeOutOpen(true);
      return;
    }
    mutation.mutate({ action: 'time-in' });
  };

  return (
    <aside
      ref={attendanceRef}
      className={`attendance-control attendance-edge-time${active?.status === 'OPEN' ? ' active' : ''}${active?.status === 'NEEDS_CORRECTION' ? ' correction' : ''}${edgeOpen ? ' edge-open' : ''}`}
      aria-label="Time attendance"
    >
      <div className="attendance-row">
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

      <div className="attendance-people">
        <button
          type="button"
          className="attendance-people-trigger"
          aria-label={`View working members, ${workingMembers.length} working now`}
          aria-expanded={peopleOpen}
          aria-controls="attendance-people-list"
          onClick={() => {
            setEdgeOpen(true);
            setPeopleOpen((open) => !open);
          }}
        >
          {visibleMembers.map((member) => (
            <span
              className="attendance-person-avatar"
              key={member.id}
              title={member.fullName}
            >
              {member.profileImagePath ? (
                <img src={member.profileImagePath} alt="" />
              ) : (
                member.fullName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()
              )}
              <span className="attendance-person-online" />
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="attendance-people-more">+{remainingCount}</span>
          )}
          {workingMembers.length === 0 && (
            <span className="attendance-people-empty-count">
              {team.isPending ? '...' : '0 working'}
            </span>
          )}
        </button>
      </div>
      </div>

      {peopleOpen && (
        <section
          id="attendance-people-list"
          className="attendance-people-popover"
          aria-label="Working members"
        >
          <header className="attendance-people-heading">
            <div>
              <span className="attendance-people-eyebrow">TEAM PRESENCE</span>
              <h2>Working now</h2>
              <p>
                {workingMembers.length} {workingMembers.length === 1 ? 'member' : 'members'} currently working
              </p>
            </div>
            <button
              type="button"
              aria-label="Close working members"
              onClick={() => setPeopleOpen(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          {team.isError ? (
            <div className="attendance-people-state" role="alert">
              <span>Could not load working members.</span>
              <button type="button" onClick={() => void team.refetch()}>
                Retry
              </button>
            </div>
          ) : team.isPending ? (
            <p className="attendance-people-state" role="status">
              Loading working members...
            </p>
          ) : workingMembers.length === 0 ? (
            <p className="attendance-people-state">
              No team members have an active work session.
            </p>
          ) : (
            <ul className={`attendance-people-list${workingMembers.length > 3 ? " is-scrollable" : ""}`}>
              {workingMembers.map((member) => (
                <li key={member.id}>
                  <span className="attendance-person-avatar">
                    {member.profileImagePath ? (
                      <img src={member.profileImagePath} alt="" />
                    ) : (
                      member.fullName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()
                    )}
                    <span className="attendance-person-online" />
                  </span>
                  <span className="attendance-people-member-copy">
                    <strong>{member.fullName}</strong>
                    <small>{member.position || member.department.name}</small>
                  </span>
                  <span className="attendance-people-status"><i aria-hidden="true" />Working</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
      {timeOutOpen && active?.status === 'OPEN' && createPortal(
        <div className="attendance-summary-backdrop" role="presentation">
          <form
            className="attendance-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-summary-heading"
            onSubmit={(event) => {
              event.preventDefault();
              if (!mutation.isPending && workSummary.trim().length >= 3) {
                mutation.mutate({ action: 'time-out', summary: workSummary.trim() });
              }
            }}
          >
            <h2 id="attendance-summary-heading">Complete your work session</h2>
            <p>Summarize what you accomplished before timing out. This will appear in your shift history.</p>
            <label htmlFor="attendance-work-summary">Work summary</label>
            <textarea
              id="attendance-work-summary"
              autoFocus
              required
              minLength={3}
              maxLength={2000}
              rows={5}
              value={workSummary}
              onChange={(event) => setWorkSummary(event.target.value)}
              placeholder="What did you work on today?"
              disabled={mutation.isPending}
            />
            {mutation.isError && <p className="attendance-modal-error" role="alert">{mutation.error.message}</p>}
            <div className="attendance-summary-actions">
              <button type="button" disabled={mutation.isPending} onClick={() => { setTimeOutOpen(false); mutation.reset(); }}>Keep working</button>
              <button type="submit" disabled={mutation.isPending || workSummary.trim().length < 3}>
                {mutation.isPending ? 'Saving...' : 'Submit summary & Time Out'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </aside>
  );
}
