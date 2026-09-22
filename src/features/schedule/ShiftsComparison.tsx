import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TeamScheduleResponse } from '../../../shared/contracts/schedule';
import type { WorkSession } from '../../../shared/contracts/work-session';
import {
  formatHours,
  formatManilaDateTime,
} from '../work-sessions/work-session-format';
import {
  teamWorkSummaryQuery,
  workSessionHistoryQuery,
} from '../work-sessions/work-session-queries';
import { formatClock } from './schedule-format';
import {
  changeWeek,
  compareWeek,
  currentManilaWeek,
  weekRangeLabel,
  type TimelineSegment,
} from './schedule-comparison';

type Members = TeamScheduleResponse['members'];

function Timeline({
  segments,
  kind,
}: {
  segments: TimelineSegment[];
  kind: 'planned' | 'actual';
}) {
  return (
    <div className={'shift-timeline ' + kind} aria-hidden="true">
      {segments.map((segment, index) => (
        <span
          key={index}
          className="shift-timeline-segment"
          style={{
            left: ((segment.start / 1440) * 100) + '%',
            width: (((segment.end - segment.start) / 1440) * 100) + '%',
          }}
        />
      ))}
    </div>
  );
}

function signedHours(seconds: number): string {
  return (seconds > 0 ? '+' : seconds < 0 ? '-' : '') +
    formatHours(Math.abs(seconds));
}

function sessionSummary(session: WorkSession): string {
  if (session.status === 'NEEDS_CORRECTION') return 'Correction required';
  if (session.status === 'OPEN') return 'Working now';
  return session.timeOut
    ? 'To ' + formatManilaDateTime(session.timeOut)
    : 'Completed';
}

export function ShiftsComparison({
  members,
  currentMemberId,
  accessToken,
  selectedMemberId,
  onSelectMember,
}: {
  members: Members;
  currentMemberId?: string;
  accessToken?: string;
  selectedMemberId: string;
  onSelectMember: (id: string) => void;
}) {
  const [week, setWeek] = useState(() => currentManilaWeek());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = members.find((member) => member.id === selectedMemberId)
    ?? members.find((member) => member.id === currentMemberId)
    ?? members[0];
  const isMine = selected?.id === currentMemberId;
  const historyQuery = useQuery({
    ...workSessionHistoryQuery(accessToken, week),
    enabled: Boolean(isMine && accessToken),
  });
  const teamQuery = useQuery(teamWorkSummaryQuery(accessToken, week));
  const summary = teamQuery.data?.members.find(
    (person) => person.id === selected?.id,
  );
  const comparison = useMemo(
    () =>
      compareWeek(
        week,
        selected?.schedule ?? null,
        isMine ? (historyQuery.data?.sessions ?? []) : [],
      ),
    [week, selected?.schedule, isMine, historyQuery.data?.sessions],
  );
  const selectedDayData = comparison.days.find((day) => day.dateKey === selectedDay);
  const historyReady = isMine && historyQuery.isSuccess;
  const worked = historyReady
    ? comparison.workedSeconds
    : summary?.actualWorkedSeconds;
  const scheduled = comparison.plannedMinutes;
  const hasActualDailyData = historyReady;
  const correctionCount = isMine
    ? (historyQuery.data?.sessions ?? []).filter(
        (session) => session.status === 'NEEDS_CORRECTION',
      ).length
    : 0;

  function moveWeek(amount: number) {
    setWeek((previous) => changeWeek(previous, amount));
    setSelectedDay(null);
  }

  return (
    <section className="shifts-experience" aria-label="Shifts">
      <div className="shift-filters-panel">
        <div>
          <p className="page-kicker">SHIFT FILTERS</p>
          <strong>Member work history</strong>
          <p>Compare scheduled commitment and actual sessions one week at a time.</p>
        </div>
        <div className="shift-filter-controls">
          <label className="schedule-select-field">
            <span>Member</span>
            <select
              aria-label="Member"
              value={selected?.id ?? ''}
              onChange={(event) => {
                onSelectMember(event.target.value);
                setSelectedDay(null);
              }}
            >
              {members.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
          <div className="shift-week-picker">
            <span>Week</span>
            <div className="shift-week-actions">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => moveWeek(-1)}
              >
                ‹
              </button>
              <strong>{weekRangeLabel(week)}</strong>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => moveWeek(1)}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="shift-overview">
        <div className="shift-section-intro">
          <div>
            <p className="page-kicker">PLANNED VS ACTUAL</p>
            <h2>{weekRangeLabel(week)}</h2>
            <p>
              Planned commitment compared with recorded Time In / Time Out
              sessions for {selected?.fullName ?? 'the selected member'}.
            </p>
          </div>
          {hasActualDailyData && scheduled > 0 && (
            <span className="shift-fulfillment">
              {comparison.workedSeconds >= scheduled * 60
                ? 'Commitment fulfilled ✓'
                : 'Below planned hours'}
            </span>
          )}
        </div>

        <div className="shift-metrics" aria-live="polite">
          <article>
            <span>Scheduled</span>
            <strong>{formatHours(scheduled * 60)}</strong>
            <small>Effective recurring planned hours</small>
          </article>
          <article>
            <span>Worked</span>
            <strong>
              {teamQuery.isPending || (isMine && historyQuery.isPending)
                ? '…'
                : worked === undefined
                  ? '—'
                  : formatHours(worked)}
            </strong>
            <small>Recorded Time In / Out</small>
          </article>
          <article>
            <span>Variance</span>
            <strong>
              {worked === undefined || (isMine && !historyReady)
                ? '—'
                : signedHours(worked - scheduled * 60)}
            </strong>
            <small>Worked minus scheduled</small>
          </article>
          <article>
            <span>Schedule overlap</span>
            <strong>
              {historyReady ? formatHours(comparison.overlapSeconds) : '—'}
            </strong>
            <small>
              {isMine
                ? 'Worked inside planned windows'
                : 'Detailed sessions available to their owner'}
            </small>
          </article>
        </div>

        {correctionCount > 0 && (
          <p className="shift-notice" role="status">
            {correctionCount} unresolved session(s) need correction and are
            excluded from worked totals.
          </p>
        )}
        {teamQuery.isError && (
          <div className="work-history-error" role="alert">
            <span>Weekly team totals unavailable: {teamQuery.error.message}</span>
            <button onClick={() => void teamQuery.refetch()}>Try again</button>
          </div>
        )}
        {isMine && historyQuery.isError && (
          <div className="work-history-error" role="alert">
            <span>Work history unavailable: {historyQuery.error.message}</span>
            <button onClick={() => void historyQuery.refetch()}>Try again</button>
          </div>
        )}
      </div>

      <div className="shift-comparison-panel">
        <div className="shift-section-intro">
          <div>
            <h2>Week comparison</h2>
            <p>
              {isMine
                ? 'Select any day to inspect planned windows and recorded sessions.'
                : 'Planned daily availability and authorized weekly work totals.'}
            </p>
          </div>
          <div className="shift-timeline-key">
            <span><i className="planned" /> Planned</span>
            <span><i className="actual" /> Actual</span>
          </div>
        </div>

        <div className="shift-day-list">
          {comparison.days.map((day) => {
            const expanded = selectedDay === day.dateKey;
            return (
              <div className="shift-day-row" key={day.dateKey}>
                <button
                  type="button"
                  className={'shift-day-trigger' + (expanded ? ' selected' : '')}
                  aria-expanded={expanded}
                  onClick={() => setSelectedDay(expanded ? null : day.dateKey)}
                >
                  <span className="shift-day-name">
                    <strong>{day.label}</strong>
                    <small>{day.dateLabel}</small>
                  </span>
                  <span className="shift-day-tracks">
                    <span className="shift-track-row">
                      <small>Planned</small>
                      <Timeline segments={day.planned} kind="planned" />
                    </span>
                    <span className="shift-track-row">
                      <small>Actual</small>
                      {hasActualDailyData ? (
                        <Timeline segments={day.actual} kind="actual" />
                      ) : (
                        <span className="shift-timeline unavailable" />
                      )}
                    </span>
                  </span>
                  <span className="shift-day-total">
                    {hasActualDailyData
                      ? formatHours(day.workedSeconds)
                      : '—'}{' / '}
                    {formatHours(day.plannedMinutes * 60)}
                  </span>
                  <span className="shift-day-chevron" aria-hidden="true">
                    {expanded ? '⌃' : '⌄'}
                  </span>
                </button>
                {expanded && (
                  <div className="shift-day-detail">
                    <div>
                      <strong>Planned schedule</strong>
                      {day.planned.length ? (
                        day.planned.map((segment, index) => (
                          <p key={index}>
                            {formatClock(String(Math.floor(segment.start / 60)).padStart(2, '0') + ':' + String(segment.start % 60).padStart(2, '0'))}
                            {' - '}
                            {formatClock(String(Math.floor(segment.end / 60)).padStart(2, '0') + ':' + String(segment.end % 60).padStart(2, '0'))}
                          </p>
                        ))
                      ) : (
                        <p>Rest day / no planned hours</p>
                      )}
                      <small>Recurring schedule. Date-specific overrides are not yet supported.</small>
                    </div>
                    <div>
                      <strong>Actual sessions</strong>
                      {hasActualDailyData && selectedDayData?.sessions.length ? (
                        selectedDayData.sessions.map((session) => (
                          <p key={session.id}>
                            {formatManilaDateTime(session.timeIn)}
                            {' · '}
                            {sessionSummary(session)}
                          </p>
                        ))
                      ) : (
                        <p>
                          {isMine
                            ? historyQuery.isPending
                              ? 'Loading sessions…'
                              : 'No recorded sessions'
                            : 'Detailed sessions are private to their owner.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="shift-privacy-note">
          Times use Asia/Manila. Actual daily records are shown only for your
          own sessions. Recurring planned hours are not attendance records.
        </p>
      </div>
    </section>
  );
}
