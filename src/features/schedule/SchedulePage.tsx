import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
import type {
  WorkSession,
  WorkSessionHistoryResponse,
} from '../../../shared/contracts/work-session';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import { formatHours, formatManilaDateTime } from '../work-sessions/work-session-format';
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

const CALENDAR_START_MINUTES = 7 * 60;
const CALENDAR_END_MINUTES = 24 * 60;
const CALENDAR_ROW_HEIGHT = 44;

function minutesToClock(minutes: number): string {
  if (minutes === 24 * 60) return '00:00';
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );
}

function currentWeekDateLabels(): Record<Weekday, string> {
  const manilaParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(manilaParts.find((item) => item.type === type)?.value ?? 0);
  const today = new Date(
    Date.UTC(part('year'), part('month') - 1, part('day'), 12),
  );
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - mondayOffset);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });

  return Object.fromEntries(
    WEEKDAYS.map((weekday, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + index);
      return [weekday, label.format(date)];
    }),
  ) as Record<Weekday, string>;
}

function currentMondayYmd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 1);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const date = new Date(ymd + 'T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekRangeLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00.000Z');
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  if (sameMonth) return month.format(start) + ' ' + start.getUTCDate() + '–' + end.getUTCDate();
  return (
    month.format(start) +
    ' ' +
    start.getUTCDate() +
    ' – ' +
    month.format(end) +
    ' ' +
    end.getUTCDate()
  );
}

function weekDateLabels(weekStart: string): Record<Weekday, string> {
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return Object.fromEntries(
    WEEKDAYS.map((weekday, index) => {
      const date = new Date(weekStart + 'T12:00:00.000Z');
      date.setUTCDate(date.getUTCDate() + index);
      return [weekday, label.format(date)];
    }),
  ) as Record<Weekday, string>;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? hours + 'h ' + remainder + 'm' : hours + 'h';
}

function formatSignedHours(seconds: number): string {
  if (!seconds) return '0h';
  const sign = seconds > 0 ? '+' : '−';
  return sign + formatHours(Math.abs(seconds));
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

function weekdayFromInstant(instant: string): Weekday {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  }).format(new Date(instant));
  return raw.toUpperCase() as Weekday;
}

function clockMinutesFromInstant(instant: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(instant));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function sessionOverlapSeconds(
  session: WorkSession,
  schedule: TeamScheduleResponse['members'][number]['schedule'],
): number {
  if (!session.timeOut || !schedule) return 0;
  const weekday = weekdayFromInstant(session.timeIn);
  const start = clockMinutesFromInstant(session.timeIn);
  const end = clockMinutesFromInstant(session.timeOut);
  if (end < start) return 0;

  return schedule.blocks
    .filter((block) => block.weekday === weekday)
    .reduce((total, block) => {
      const blockStart = clockTimeToMinutes(block.startTime);
      const blockEnd = clockTimeToMinutes(block.endTime);
      return total + Math.max(0, Math.min(end, blockEnd) - Math.max(start, blockStart)) * 60;
    }, 0);
}

function dayActualSeconds(
  history: WorkSessionHistoryResponse | undefined,
  weekday: Weekday,
): number {
  return (history?.sessions ?? [])
    .filter((session) => weekdayFromInstant(session.timeIn) === weekday)
    .reduce((total, session) => total + session.durationSeconds, 0);
}

export function SchedulePage() {
  const { member, session } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'team' | 'shifts'>('team');
  const [configuring, setConfiguring] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(member?.id ?? '');
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[] | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [weekParam, setWeekParam] = useState<string | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<Weekday | null>(null);

  const teamQuery = useQuery(teamScheduleQuery(session?.access_token));
  const mineQuery = useQuery(myScheduleQuery(session?.access_token));
  const historyQuery = useQuery({
    ...workSessionHistoryQuery(session?.access_token, weekParam),
    enabled: view === 'shifts',
  });
  const teamWorkQuery = useQuery({
    ...teamWorkSummaryQuery(session?.access_token, weekParam),
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
      setFormError(parsed.error.issues[0]?.message ?? 'Check the schedule values.');
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
        endTime:
          String(Math.floor(end / 60)).padStart(2, '0') +
          ':' +
          String(end % 60).padStart(2, '0'),
      });
      remaining -= duration;
    }
    form.setValue('blocks', generated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  if (teamQuery.isPending || mineQuery.isPending) {
    return <section className="schedule-state">Loading Team Schedule...</section>;
  }

  if (teamQuery.isError || mineQuery.isError) {
    return (
      <section className="schedule-state error" role="alert">
        <h1>Schedule could not be loaded</h1>
        <p>{(teamQuery.error ?? mineQuery.error)?.message}</p>
        <button
          className="schedule-button primary"
          onClick={() => void Promise.all([teamQuery.refetch(), mineQuery.refetch()])}
        >
          Try again
        </button>
      </section>
    );
  }

  const members = teamQuery.data?.members ?? [];
  const ownMember = members.find((item) => item.id === member?.id);
  const ownSchedule = mineQuery.data?.schedule ?? ownMember?.schedule ?? null;
  const departments = Array.from(
    new Map(members.map((item) => [item.department.id, item.department])).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));
  const peopleIds = selectedPeopleIds ?? members.map((item) => item.id);
  const filteredMembers = members.filter(
    (item) =>
      peopleIds.includes(item.id) &&
      (!departmentId || item.department.id === departmentId),
  );
  const visibleBlockCount = filteredMembers.reduce(
    (total, item) => total + (item.schedule?.blocks.length ?? 0),
    0,
  );

  const togglePerson = (memberId: string) => {
    const currentIds = selectedPeopleIds ?? members.map((item) => item.id);
    const nextIds = currentIds.includes(memberId)
      ? currentIds.filter((id) => id !== memberId)
      : [...currentIds, memberId];
    setSelectedPeopleIds(nextIds.length === members.length ? null : nextIds);
  };

  const currentWeek = weekParam ?? currentMondayYmd();
  const currentRange = weekRangeLabel(currentWeek);
  const shiftsDateLabels = weekDateLabels(currentWeek);
  const scheduledMinutes = selectedWorkMember?.scheduledMinutes ?? 0;
  const workedSeconds =
    selectedMember?.id === member?.id
      ? historyQuery.data?.totalDurationSeconds ?? selectedWorkMember?.actualWorkedSeconds ?? 0
      : selectedWorkMember?.actualWorkedSeconds ?? 0;
  const varianceSeconds = workedSeconds - scheduledMinutes * 60;
  const overlapSeconds =
    selectedMember?.id === member?.id
      ? (historyQuery.data?.sessions ?? []).reduce(
          (total, item) => total + sessionOverlapSeconds(item, selectedMember?.schedule ?? null),
          0,
        )
      : 0;

  const shiftWeek = (days: number) => {
    const next = addDaysYmd(currentWeek, days);
    setWeekParam(next === currentMondayYmd() ? undefined : next);
    setSelectedDay(null);
  };

  return (
    <section className="schedule-page" aria-labelledby="schedule-title">
      <header className="schedule-header">
        <div>
          <p className="page-kicker">COMPANY AVAILABILITY</p>
          <h1 id="schedule-title">Schedule</h1>
          <p>Chosen startup duty hours in one merged weekly calendar.</p>
        </div>
        <div className="schedule-header-actions">
          <div className="schedule-tabs" role="tablist" aria-label="Schedule view">
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
          <button className="schedule-button primary" onClick={enterConfiguration}>
            Configure My Schedule
          </button>
        </div>
      </header>

      {view === 'shifts' ? (
        <section className="shifts-workspace" aria-label="Shifts">
          <div className="shift-filter-card">
            <div>
              <p className="page-kicker">SHIFT FILTERS</p>
              <strong>Member work history</strong>
              <p>Compare scheduled commitment and actual sessions one week at a time.</p>
            </div>
            <div className="shift-filter-controls">
              <label className="schedule-select-field">
                <span>Member</span>
                <select
                  value={selectedMember?.id ?? ''}
                  onChange={(event) => {
                    setSelectedMemberId(event.target.value);
                    setSelectedDay(null);
                  }}
                >
                  {members.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="shift-week-picker">
                <span>Week</span>
                <div>
                  <button type="button" aria-label="Previous week" onClick={() => shiftWeek(-7)}>
                    ‹
                  </button>
                  <strong>{currentRange}</strong>
                  <button type="button" aria-label="Next week" onClick={() => shiftWeek(7)}>
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="shift-comparison-heading">
            <div>
              <p className="page-kicker">PLANNED VS ACTUAL</p>
              <strong>{currentRange}</strong>
              <p>
                Planned commitment compared with actual Time In / Time Out sessions for{' '}
                {selectedMember?.fullName ?? 'this member'}.
              </p>
            </div>
          </div>

          <div className="shift-stat-grid">
            <ShiftStat label="Scheduled" value={formatMinutes(scheduledMinutes)} note="Effective planned hours" />
            <ShiftStat label="Worked" value={formatHours(workedSeconds)} note="Recorded Time In / Out" />
            <ShiftStat label="Variance" value={formatSignedHours(varianceSeconds)} note="Worked minus scheduled" />
            <ShiftStat
              label="Schedule overlap"
              value={selectedMember?.id === member?.id ? formatHours(overlapSeconds) : '—'}
              note={
                selectedMember?.id === member?.id
                  ? 'Worked inside planned windows'
                  : 'Detailed overlap is available for your own sessions'
              }
            />
          </div>

          <section className="shift-week-card">
            <header>
              <div>
                <strong>Week comparison</strong>
                <p>Click any day to inspect its schedule and actual sessions.</p>
              </div>
              {scheduledMinutes > 0 && workedSeconds >= scheduledMinutes * 60 && (
                <span className="fulfilled-pill">Commitment fulfilled ✓</span>
              )}
            </header>
            <div className="shift-day-list">
              {WEEKDAYS.map((weekday) => {
                const planned =
                  selectedMember?.schedule?.blocks
                    .filter((block) => block.weekday === weekday)
                    .reduce(
                      (total, block) =>
                        total +
                        Math.max(
                          0,
                          clockTimeToMinutes(block.endTime) -
                            clockTimeToMinutes(block.startTime),
                        ),
                      0,
                    ) ?? 0;
                const actual =
                  selectedMember?.id === member?.id
                    ? dayActualSeconds(historyQuery.data, weekday)
                    : 0;
                const maxMinutes = Math.max(planned, actual / 60, 60);
                return (
                  <button
                    type="button"
                    className={'shift-day-row' + (selectedDay === weekday ? ' selected' : '')}
                    key={weekday}
                    onClick={() => setSelectedDay(weekday)}
                  >
                    <div className="shift-day-label">
                      <strong>{DAY_LABELS[weekday]}</strong>
                      <span>{shiftsDateLabels[weekday]}</span>
                    </div>
                    <div className="shift-day-bars">
                      <TimelineBar
                        label="Planned"
                        ratio={planned / maxMinutes}
                        variant="planned"
                      />
                      <TimelineBar
                        label="Actual"
                        ratio={(actual / 60) / maxMinutes}
                        variant="actual"
                      />
                    </div>
                    <strong className="shift-day-total">
                      {formatHours(actual)} / {formatMinutes(planned)}
                    </strong>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedDay && (
            <DayInspector
              weekday={selectedDay}
              schedule={selectedMember?.schedule ?? null}
              history={
                selectedMember?.id === member?.id ? historyQuery.data : undefined
              }
              dateLabel={shiftsDateLabels[selectedDay]}
            />
          )}
        </section>
      ) : (
        <>
          <section className="schedule-filters" aria-label="Schedule filters">
            <div className="schedule-filterbar">
              <details className="schedule-people-filter">
                <summary>
                  <span className="schedule-filter-control-label">People</span>
                  <span className="schedule-filter-control">
                    {peopleIds.length === members.length
                      ? 'All ' + members.length + ' members'
                      : peopleIds.length + ' selected'}
                    <span aria-hidden="true">⌄</span>
                  </span>
                </summary>
                <div className="schedule-people-menu">
                  {members.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        aria-label={item.fullName}
                        checked={peopleIds.includes(item.id)}
                        onChange={() => togglePerson(item.id)}
                      />
                      <span aria-hidden="true" data-label={item.fullName} />
                    </label>
                  ))}
                </div>
              </details>

              <label className="schedule-filter-field">
                <span>Department</span>
                <select
                  aria-label="Department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="schedule-filter-field">
                <span>View</span>
                <div className="schedule-static-value">Merged week</div>
              </div>

              <div className="schedule-filter-field">
                <span>Time range</span>
                <div className="schedule-static-value">7:00 AM – 12:00 AM</div>
              </div>

              <div className="schedule-filter-summary">
                <span>Showing</span>
                <strong>Merged schedule · {filteredMembers.length} visible</strong>
              </div>
            </div>
          </section>

          {configuring && (
            <form
              className="schedule-config-drawer"
              onSubmit={form.handleSubmit(submitSchedule)}
            >
              <div className="schedule-config-topline">
                <div>
                  <p className="page-kicker">YOUR MOVABLE SCHEDULE</p>
                  <h2>Configure My Schedule</h2>
                  <p>Build your base week while keeping the merged team calendar visible below.</p>
                </div>
                <div className="schedule-balance">
                  {formatMinutes(weekMinutes(watchedBlocks))} / {formatMinutes(targetMinutes)}
                </div>
              </div>

              <div className="schedule-config-toolbar">
                <label>
                  <span>Target hours per week</span>
                  <input
                    aria-label="Target hours per week"
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
                <button type="button" className="schedule-button" onClick={generateWeek}>
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
                        <select
                          aria-label={'Day ' + (index + 1)}
                          {...form.register('blocks.' + index + '.weekday' as const)}
                        >
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
                          aria-label={index === 0 ? 'Start' : 'Start ' + (index + 1)}
                          type="time"
                          {...form.register('blocks.' + index + '.startTime' as const)}
                        />
                      </label>
                      <label>
                        <span>End</span>
                        <input
                          aria-label={index === 0 ? 'End' : 'End ' + (index + 1)}
                          type="time"
                          {...form.register('blocks.' + index + '.endTime' as const)}
                        />
                      </label>
                      <button
                        type="button"
                        className="schedule-remove"
                        aria-label={'Remove block ' + (index + 1)}
                        onClick={() => blocks.remove(index)}
                      >
                        ×
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
            </form>
          )}

          {!ownSchedule && !configuring && (
            <section className="schedule-empty hero">
              <div className="schedule-empty-icon" aria-hidden="true">↔</div>
              <h2>Your schedule is ready to configure</h2>
              <p>
                Generate a base schedule, mark rest days, then redistribute your hours
                while keeping the team view visible.
              </p>
              <button className="schedule-button primary" onClick={enterConfiguration}>
                Configure My Schedule
              </button>
            </section>
          )}

          <section className="schedule-panel team-panel">
            <div className="schedule-panel-heading">
              <div>
                <p className="page-kicker">MERGED WEEK</p>
                <h2>Team Schedule</h2>
                <p>
                  Each horizontal band is one hour. Your selected viewer&apos;s blocks
                  stay visible alongside the rest of the team.
                </p>
              </div>
              <div className="schedule-legend" aria-label="Schedule legend">
                <span><i className="mine" />Your movable schedule</span>
                <span><i className="team" />Team schedule</span>
                <span><i className="rest" />Rest day</span>
              </div>
            </div>

            <TeamCalendar
              members={filteredMembers}
              currentMemberId={member?.id}
              dateLabels={currentWeekDateLabels()}
            />

            {visibleBlockCount === 0 && (
              <div className="schedule-calendar-empty">
                No schedule blocks match these filters.
              </div>
            )}
          </section>

          <aside className="schedule-note">
            <span aria-hidden="true">↔</span>
            <div>
              <strong>Redistribute hours instead of forcing identical days.</strong>
              <p>
                Generate a base schedule, mark rest days, then move your own blocks
                while keeping the weekly target visible.
              </p>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}

function ShiftStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="shift-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function TimelineBar({
  label,
  ratio,
  variant,
}: {
  label: string;
  ratio: number;
  variant: 'planned' | 'actual';
}) {
  return (
    <div className="timeline-row">
      <span>{label}</span>
      <div className="timeline-track">
        <i
          className={variant}
          style={{ width: Math.max(0, Math.min(100, ratio * 100)) + '%' }}
        />
      </div>
    </div>
  );
}

function DayInspector({
  weekday,
  schedule,
  history,
  dateLabel,
}: {
  weekday: Weekday;
  schedule: TeamScheduleResponse['members'][number]['schedule'];
  history?: WorkSessionHistoryResponse;
  dateLabel: string;
}) {
  const planned = schedule?.blocks.filter((block) => block.weekday === weekday) ?? [];
  const actual = (history?.sessions ?? []).filter(
    (session) => weekdayFromInstant(session.timeIn) === weekday,
  );

  return (
    <section className="day-inspector">
      <header>
        <div>
          <p className="page-kicker">DAY INSPECTOR</p>
          <h3>{DAY_LABELS[weekday]} · {dateLabel}</h3>
        </div>
        <span>Schedule overrides are not configured yet.</span>
      </header>
      <div className="day-inspector-columns">
        <div>
          <strong>Planned schedule</strong>
          {planned.length ? (
            planned.map((block) => (
              <p key={block.id}>{formatClock(block.startTime)} – {formatClock(block.endTime)}</p>
            ))
          ) : (
            <p>Rest day</p>
          )}
        </div>
        <div>
          <strong>Actual sessions</strong>
          {actual.length ? (
            actual.map((item) => (
              <p key={item.id}>
                {formatManilaDateTime(item.timeIn)}
                {item.timeOut ? ' – ' + formatManilaDateTime(item.timeOut) : ' – Working now'}
              </p>
            ))
          ) : (
            <p>No recorded session.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function TeamCalendar({
  members,
  currentMemberId,
  dateLabels,
}: {
  members: TeamScheduleResponse['members'];
  currentMemberId?: string;
  dateLabels: Record<Weekday, string>;
}) {
  const hours = Array.from(
    { length: (CALENDAR_END_MINUTES - CALENDAR_START_MINUTES) / 60 },
    (_, index) => CALENDAR_START_MINUTES + index * 60,
  );

  return (
    <>
      <div className="schedule-calendar-scroll">
        <div className="schedule-calendar-stage">
          <div className="schedule-calendar-head-row">
            <div className="schedule-calendar-time-head">Time</div>
            {WEEKDAYS.map((day) => (
              <div
                className={
                  'schedule-calendar-day-head' +
                  (day === 'SATURDAY' || day === 'SUNDAY' ? ' rest-day' : '')
                }
                key={day}
              >
                <strong>{DAY_LABELS[day]}</strong>
                <small>{dateLabels[day]}</small>
                {(day === 'SATURDAY' || day === 'SUNDAY') && <span>Rest</span>}
              </div>
            ))}
          </div>
          <div className="schedule-calendar-body">
            <div className="schedule-time-axis">
              {hours.map((minutes) => (
                <div key={minutes}>{formatClock(minutesToClock(minutes))}</div>
              ))}
            </div>
            {WEEKDAYS.map((day) => (
              <CalendarDay
                day={day}
                members={members}
                currentMemberId={currentMemberId}
                key={day}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="compact-team-week">
        {WEEKDAYS.map((day) => {
          const dayEntries = members.flatMap((calendarMember) =>
            (calendarMember.schedule?.blocks ?? [])
              .filter((block) => block.weekday === day)
              .map((block) => ({ calendarMember, block })),
          );
          return (
            <article key={day}>
              <header>
                <strong>{DAY_LABELS[day]}</strong>
                <span>{dateLabels[day]}</span>
              </header>
              <div>
                {dayEntries.length ? (
                  dayEntries.map(({ calendarMember, block }) => (
                    <div
                      className={calendarMember.id === currentMemberId ? 'mine' : ''}
                      key={block.id}
                    >
                      <strong aria-label={calendarMember.fullName} data-label={calendarMember.fullName} />
                      <span
                        aria-label={formatClock(block.startTime) + ' - ' + formatClock(block.endTime)}
                        data-label={formatClock(block.startTime) + ' - ' + formatClock(block.endTime)}
                      />
                    </div>
                  ))
                ) : (
                  <p>No shared availability</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function CalendarDay({
  day,
  members,
  currentMemberId,
}: {
  day: Weekday;
  members: TeamScheduleResponse['members'];
  currentMemberId?: string;
}) {
  const entries = members
    .flatMap((calendarMember) =>
      (calendarMember.schedule?.blocks ?? [])
        .filter((block) => block.weekday === day)
        .map((block) => ({
          calendarMember,
          block,
          start: clockTimeToMinutes(block.startTime),
          end: clockTimeToMinutes(block.endTime),
        })),
    )
    .filter(
      (entry) =>
        entry.end > CALENDAR_START_MINUTES &&
        entry.start < CALENDAR_END_MINUTES,
    )
    .sort(
      (left, right) =>
        left.start -
          right.start ||
        left.end -
          right.end ||
        left.calendarMember.fullName.localeCompare(right.calendarMember.fullName),
    );

  const laneEnds: number[] = [];
  const positioned = entries.map((entry) => {
    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = entry.end;
    return { ...entry, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);

  return (
    <div
      className={
        'schedule-calendar-day' +
        (entries.length === 0 ? ' empty' : '') +
        (day === 'SATURDAY' || day === 'SUNDAY' ? ' rest-day' : '')
      }
      aria-label={DAY_LABELS[day]}
    >
      {positioned.map(({ calendarMember, block, start, end, lane }) => {
        const visibleStart = Math.max(start, CALENDAR_START_MINUTES);
        const visibleEnd = Math.min(end, CALENDAR_END_MINUTES);
        const top =
          ((visibleStart - CALENDAR_START_MINUTES) / 60) * CALENDAR_ROW_HEIGHT;
        const height = ((visibleEnd - visibleStart) / 60) * CALENDAR_ROW_HEIGHT;
        const width = 100 / laneCount;
        const style = {
          top,
          height: Math.max(height, 18),
          left: 'calc(' + lane * width + '% + 3px)',
          width: 'calc(' + width + '% - 6px)',
        } satisfies CSSProperties;

        return (
          <div
            className={
              'schedule-calendar-block' +
              (calendarMember.id === currentMemberId ? ' mine' : '') +
              (width < 34 ? ' thin' : '')
            }
            key={block.id}
            style={style}
            title={
              calendarMember.fullName +
              ': ' +
              formatClock(block.startTime) +
              ' - ' +
              formatClock(block.endTime)
            }
          >
            <strong>{calendarMember.fullName}</strong>
            <small>{formatClock(block.startTime)} - {formatClock(block.endTime)}</small>
          </div>
        );
      })}
    </div>
  );
}
