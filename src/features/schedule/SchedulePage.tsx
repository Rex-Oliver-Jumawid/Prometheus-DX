import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  MemberScheduleSchema,
  UpdateScheduleRequestSchema,
  WEEKDAYS,
  clockTimeToMinutes,
  type TeamScheduleResponse,
  type UpdateScheduleRequest,
  type Weekday,
} from '../../../shared/contracts/schedule';
import type { WorkSessionHistoryResponse } from '../../../shared/contracts/work-session';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
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
  myScheduleQuery,
  scheduleKeys,
  teamScheduleQuery,
} from './schedule-queries';
import './schedule.css';

const DAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function defaultFormValues(
  schedule: TeamScheduleResponse['members'][number]['schedule'],
): UpdateScheduleRequest {
  return schedule
    ? {
        targetWeeklyMinutes: schedule.targetWeeklyMinutes,
        blocks: schedule.blocks.map(({ weekday, startTime, endTime }) => ({
          weekday,
          startTime,
          endTime,
        })),
      }
    : { targetWeeklyMinutes: 2_400, blocks: [] };
}

function weekMinutes(
  blocks: Array<{ startTime: string; endTime: string }>,
): number {
  return blocks.reduce(
    (total, block) =>
      total +
      Math.max(
        0,
        clockTimeToMinutes(block.endTime) - clockTimeToMinutes(block.startTime),
      ),
    0,
  );
}

export function SchedulePage() {
  const { member, session } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'team' | 'shifts'>('team');
  const [configuring, setConfiguring] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(member?.id ?? '');
  const teamQuery = useQuery(teamScheduleQuery(session?.access_token));
  const mineQuery = useQuery(myScheduleQuery(session?.access_token));
  const historyQuery = useQuery({
    ...workSessionHistoryQuery(session?.access_token),
    enabled: view === 'shifts',
  });
  const teamWorkQuery = useQuery({
    ...teamWorkSummaryQuery(session?.access_token),
    enabled: view === 'shifts',
  });
  const form = useForm<UpdateScheduleRequest>({
    defaultValues: defaultFormValues(null),
  });
  const blocks = useFieldArray({ control: form.control, name: 'blocks' });
  const watchedBlocks = form.watch('blocks');
  const targetMinutes = form.watch('targetWeeklyMinutes');

  useEffect(() => {
    if (!mineQuery.isPending) {
      form.reset(defaultFormValues(mineQuery.data?.schedule ?? null));
    }
  }, [form, mineQuery.data, mineQuery.isPending]);

  useEffect(() => {
    if (!selectedMemberId && member?.id) setSelectedMemberId(member.id);
  }, [member?.id, selectedMemberId]);

  const mutation = useMutation({
    mutationFn: (input: UpdateScheduleRequest) =>
      apiFetch('/schedule/me', MemberScheduleSchema, {
        accessToken: session?.access_token,
        method: 'PUT',
        body: input,
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(scheduleKeys.mine, { schedule: saved });
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.team });
      setConfiguring(false);
    },
  });

  const selectedMember = useMemo(
    () =>
      teamQuery.data?.members.find((item) => item.id === selectedMemberId) ??
      teamQuery.data?.members.find((item) => item.id === member?.id) ??
      teamQuery.data?.members[0],
    [member?.id, selectedMemberId, teamQuery.data?.members],
  );
  const selectedWorkMember = teamWorkQuery.data?.members.find(
    (item) => item.id === selectedMember?.id,
  );

  const enterConfiguration = () => {
    setView('team');
    setSelectedMemberId(member?.id ?? '');
    form.reset(defaultFormValues(mineQuery.data?.schedule ?? null));
    setFormError(null);
    mutation.reset();
    setConfiguring(true);
  };

  const submitSchedule = (input: UpdateScheduleRequest) => {
    const parsed = UpdateScheduleRequestSchema.safeParse(input);
    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? 'Check the schedule values.',
      );
      return;
    }
    setFormError(null);
    mutation.mutate(parsed.data);
  };

  const generateWeek = () => {
    const dailyMinutes = 8 * 60;
    const target = Math.max(0, Math.min(5 * dailyMinutes, targetMinutes));
    let remaining = target;
    const generated: UpdateScheduleRequest['blocks'] = [];
    for (const weekday of WEEKDAYS.slice(0, 5)) {
      if (remaining <= 0) break;
      const duration = Math.min(dailyMinutes, remaining);
      const end = 9 * 60 + duration;
      generated.push({
        weekday,
        startTime: '09:00',
        endTime: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(
          end % 60,
        ).padStart(2, '0')}`,
      });
      remaining -= duration;
    }
    form.setValue('blocks', generated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  if (teamQuery.isPending || mineQuery.isPending) {
    return (
      <section className="schedule-state">Loading Team Schedule...</section>
    );
  }

  if (teamQuery.isError || mineQuery.isError) {
    return (
      <section className="schedule-state error" role="alert">
        <h1>Schedule could not be loaded</h1>
        <p>{(teamQuery.error ?? mineQuery.error)?.message}</p>
        <button
          className="schedule-button primary"
          onClick={() =>
            void Promise.all([teamQuery.refetch(), mineQuery.refetch()])
          }
        >
          Try again
        </button>
      </section>
    );
  }

  const members = teamQuery.data?.members ?? [];
  const ownMember = members.find((item) => item.id === member?.id);
  const ownSchedule = mineQuery.data?.schedule ?? ownMember?.schedule ?? null;

  return (
    <section className="schedule-page" aria-labelledby="schedule-title">
      <header className="schedule-header">
        <div>
          <p className="page-kicker">COMPANY AVAILABILITY</p>
          <h1 id="schedule-title">Schedule</h1>
          <p>Planned local working hours in one shared weekly view.</p>
        </div>
        <div className="schedule-header-actions">
          <div
            className="schedule-tabs"
            role="tablist"
            aria-label="Schedule view"
          >
            <button
              role="tab"
              aria-selected={view === 'team'}
              className={view === 'team' ? 'active' : ''}
              onClick={() => setView('team')}
            >
              Team Schedule
            </button>
            <button
              role="tab"
              aria-selected={view === 'shifts'}
              className={view === 'shifts' ? 'active' : ''}
              onClick={() => {
                setConfiguring(false);
                setView('shifts');
              }}
            >
              Shifts
            </button>
          </div>
          <button
            className="schedule-button primary"
            onClick={enterConfiguration}
          >
            Configure My Schedule
          </button>
        </div>
      </header>

      {view === 'shifts' ? (
        <section className="schedule-panel shifts-panel" aria-label="Shifts">
          <div className="schedule-panel-heading">
            <div>
              <p className="page-kicker">PLANNED SHIFTS</p>
              <h2>
                {selectedMember?.id === member?.id
                  ? 'My Shifts'
                  : `${selectedMember?.fullName}'s Shifts`}
              </h2>
              <p>Recurring planned availability shown in Asia/Manila.</p>
            </div>
            <label className="schedule-select-field">
              <span>Member</span>
              <select
                value={selectedMember?.id ?? ''}
                onChange={(event) => setSelectedMemberId(event.target.value)}
              >
                {members.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="work-week-stats">
            <article>
              <span>Scheduled</span>
              <strong>
                {formatMinutes(selectedWorkMember?.scheduledMinutes ?? 0)}
              </strong>
              <small>Recurring planned hours</small>
            </article>
            <article>
              <span>Worked</span>
              <strong>
                {formatHours(selectedWorkMember?.actualWorkedSeconds ?? 0)}
              </strong>
              <small>Persisted Time In / Out</small>
            </article>
            <article>
              <span>Status</span>
              <strong>
                {selectedWorkMember?.workingNow ? 'Working Now' : 'Timed Out'}
              </strong>
              <small>From unresolved OPEN session</small>
            </article>
          </div>
          <ScheduleSummary schedule={selectedMember?.schedule ?? null} />
          {selectedMember?.id === member?.id && (
            <WorkHistory
              pending={historyQuery.isPending}
              error={historyQuery.error}
              history={historyQuery.data}
              retry={() => void historyQuery.refetch()}
            />
          )}
        </section>
      ) : (
        <>
          {configuring && (
            <form
              className="schedule-panel configure-panel"
              onSubmit={form.handleSubmit(submitSchedule)}
            >
              <div className="schedule-panel-heading">
                <div>
                  <p className="page-kicker">PERSONAL SCHEDULE</p>
                  <h2>Configure My Schedule</h2>
                  <p>
                    Set your weekly target, then add, edit, or remove planned
                    blocks.
                  </p>
                </div>
                <div className="schedule-balance">
                  Scheduled {formatMinutes(weekMinutes(watchedBlocks))} / Target{' '}
                  {formatMinutes(targetMinutes)}
                </div>
              </div>
              <div className="schedule-config-toolbar">
                <label>
                  <span>Target hours per week</span>
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.5"
                    value={targetMinutes / 60}
                    onChange={(event) =>
                      form.setValue(
                        'targetWeeklyMinutes',
                        Math.round(Number(event.target.value) * 60),
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="schedule-button"
                  onClick={generateWeek}
                >
                  Generate Weekdays
                </button>
                <button
                  type="button"
                  className="schedule-button"
                  onClick={() =>
                    blocks.append({
                      weekday: 'MONDAY',
                      startTime: '09:00',
                      endTime: '17:00',
                    })
                  }
                >
                  Add Block
                </button>
              </div>
              <div className="schedule-block-editor">
                {blocks.fields.length === 0 ? (
                  <div className="schedule-empty compact">
                    <strong>No planned blocks yet.</strong>
                    <span>Add a block or generate a weekday schedule.</span>
                  </div>
                ) : (
                  blocks.fields.map((field, index) => (
                    <div className="schedule-block-row" key={field.id}>
                      <label>
                        <span>Day</span>
                        <select {...form.register(`blocks.${index}.weekday`)}>
                          {WEEKDAYS.map((day) => (
                            <option key={day} value={day}>
                              {DAY_LABELS[day]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Start</span>
                        <input
                          type="time"
                          {...form.register(`blocks.${index}.startTime`)}
                        />
                      </label>
                      <label>
                        <span>End</span>
                        <input
                          type="time"
                          {...form.register(`blocks.${index}.endTime`)}
                        />
                      </label>
                      <button
                        type="button"
                        className="schedule-remove"
                        aria-label={`Remove block ${index + 1}`}
                        onClick={() => blocks.remove(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
              {formError && (
                <p className="schedule-message error" role="alert">
                  {formError}
                </p>
              )}
              {mutation.isError && (
                <p className="schedule-message error" role="alert">
                  {mutation.error.message}
                </p>
              )}
              <div className="schedule-form-actions">
                <button
                  type="button"
                  className="schedule-button"
                  disabled={mutation.isPending}
                  onClick={() => setConfiguring(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="schedule-button primary"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          )}

          {!ownSchedule && !configuring && (
            <section className="schedule-empty hero">
              <span className="schedule-empty-icon" aria-hidden="true">
                ＋
              </span>
              <h2>Your schedule is ready to configure</h2>
              <p>
                Add planned hours so teammates can see when you are usually
                available.
              </p>
              <button
                className="schedule-button primary"
                onClick={enterConfiguration}
              >
                Configure My Schedule
              </button>
            </section>
          )}

          <section
            className="schedule-panel team-panel"
            aria-label="Team Schedule"
          >
            <div className="schedule-panel-heading">
              <div>
                <p className="page-kicker">MERGED WEEK</p>
                <h2>Team Schedule</h2>
                <p>Recurring planned availability. Times use Asia/Manila.</p>
              </div>
              <span className="timezone-pill">UTC+08:00 · Asia/Manila</span>
            </div>
            <TeamWeek members={members} currentMemberId={member?.id} />
          </section>
        </>
      )}
    </section>
  );
}

function WorkHistory({
  pending,
  error,
  history,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  history: WorkSessionHistoryResponse | undefined;
  retry: () => void;
}) {
  return (
    <section className="work-history" aria-labelledby="work-history-title">
      <div className="work-history-head">
        <div>
          <p className="page-kicker">ACTUAL WORK</p>
          <h3 id="work-history-title">Weekly work history</h3>
        </div>
        {history && (
          <strong>{formatHours(history.totalDurationSeconds)}</strong>
        )}
      </div>
      {pending ? (
        <p>Loading work history...</p>
      ) : error ? (
        <div className="work-history-error" role="alert">
          <span>{error.message}</span>
          <button onClick={retry}>Try again</button>
        </div>
      ) : history?.sessions.length ? (
        <div className="work-history-list">
          {history.sessions.map((session) => (
            <article key={session.id}>
              <div>
                <strong>{formatManilaDateTime(session.timeIn)}</strong>
                <span>
                  {session.timeOut
                    ? `to ${formatManilaDateTime(session.timeOut)}`
                    : session.status === 'OPEN'
                      ? 'Active session'
                      : 'Correction required'}
                </span>
              </div>
              <div className="work-history-duration">
                <strong>{formatHours(session.durationSeconds)}</strong>
                <span>{session.status.replace('_', ' ')}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="schedule-empty compact">
          <strong>No work sessions this week</strong>
          <span>Time In to begin recording actual work separately.</span>
        </div>
      )}
    </section>
  );
}

function ScheduleSummary({
  schedule,
}: {
  schedule: TeamScheduleResponse['members'][number]['schedule'];
}) {
  if (!schedule || schedule.blocks.length === 0) {
    return (
      <div className="schedule-empty compact">
        <strong>No planned schedule</strong>
        <span>This member has not shared recurring availability yet.</span>
      </div>
    );
  }
  return (
    <div className="shift-list">
      {WEEKDAYS.map((day) => {
        const dayBlocks = schedule.blocks.filter(
          (block) => block.weekday === day,
        );
        return (
          <article key={day} className="shift-day">
            <strong>{DAY_LABELS[day]}</strong>
            <div>
              {dayBlocks.length ? (
                dayBlocks.map((block) => (
                  <span key={block.id}>
                    {formatClock(block.startTime)} -{' '}
                    {formatClock(block.endTime)}
                  </span>
                ))
              ) : (
                <span className="rest-label">No planned hours</span>
              )}
            </div>
          </article>
        );
      })}
      <div className="shift-total">
        <span>Weekly target</span>
        <strong>{formatMinutes(schedule.targetWeeklyMinutes)}</strong>
      </div>
    </div>
  );
}

function TeamWeek({
  members,
  currentMemberId,
}: {
  members: TeamScheduleResponse['members'];
  currentMemberId?: string;
}) {
  return (
    <div className="team-week">
      {WEEKDAYS.map((day) => {
        const entries = members.flatMap((member) =>
          (member.schedule?.blocks ?? [])
            .filter((block) => block.weekday === day)
            .map((block) => ({ member, block })),
        );
        return (
          <article className="team-day" key={day}>
            <header>
              <strong>{DAY_LABELS[day]}</strong>
              <span>
                {entries.length} {entries.length === 1 ? 'block' : 'blocks'}
              </span>
            </header>
            <div className="team-day-blocks">
              {entries.length === 0 ? (
                <span className="team-day-empty">No shared availability</span>
              ) : (
                entries.map(({ member, block }) => (
                  <div
                    className={`team-member-block${member.id === currentMemberId ? ' mine' : ''}`}
                    key={block.id}
                  >
                    <span className="schedule-avatar" aria-hidden="true">
                      {initials(member.fullName)}
                    </span>
                    <span className="team-member-copy">
                      <strong>{member.fullName}</strong>
                      <small>
                        {formatClock(block.startTime)} -{' '}
                        {formatClock(block.endTime)}
                      </small>
                    </span>
                    <span className="department-chip">
                      {member.department.shortLabel}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
