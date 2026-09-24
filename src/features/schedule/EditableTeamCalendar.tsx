import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  WEEKDAYS,
  clockTimeToMinutes,
  type ScheduleBlockInput,
  type TeamScheduleResponse,
  type Weekday,
} from '../../../shared/contracts/schedule';
import { formatClock } from './schedule-format';
import {
  EDITOR_END_MINUTES,
  EDITOR_START_MINUTES,
  EDITOR_STEP_MINUTES,
  editorClock,
  isValidEditorPlacement,
} from './schedule-editor';

const DAY_NAMES: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};
const ROW_HEIGHT = 44;
const DAY_WIDTH = 127;
const TIME_WIDTH = 70;

type Entry = {
  key: string;
  name: string;
  start: number;
  end: number;
  ownIndex: number | null;
};

type Gesture = {
  pointerId: number;
  index: number;
  mode: 'move' | 'resize';
  clientX: number;
  clientY: number;
  initialDay: Weekday;
  initialStart: number;
  initialEnd: number;
  originalBlocks: ScheduleBlockInput[];
  originalRestDays: Set<Weekday>;
  changed: boolean;
  invalid: boolean;
};

export function EditableTeamCalendar({
  members,
  currentMemberId,
  currentMemberName,
  dateLabels,
  blocks,
  restDays,
  selectedIndex,
  onSelect,
  onChange,
  onToggleRest,
  onMessage,
  disabled = false,
}: {
  members: TeamScheduleResponse['members'];
  currentMemberId?: string;
  currentMemberName: string;
  dateLabels: Record<Weekday, string>;
  blocks: ScheduleBlockInput[];
  restDays: ReadonlySet<Weekday>;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onChange: (blocks: ScheduleBlockInput[], restDays?: ReadonlySet<Weekday>) => void;
  onToggleRest: (day: Weekday) => void;
  onMessage: (message: string) => void;
  disabled?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const hours = Array.from({ length: 17 }, (_, index) => (7 + index) * 60);
  const teamEntries = members
    .filter((person) => person.id !== currentMemberId)
    .flatMap((person) =>
      (person.schedule?.blocks ?? []).map((block) => ({
        name: person.fullName,
        weekday: block.weekday,
        start: clockTimeToMinutes(block.startTime),
        end: clockTimeToMinutes(block.endTime),
        key: person.id + '-' + block.id,
      })),
    );

  function startGesture(event: PointerEvent<HTMLDivElement>, index: number, mode: 'move' | 'resize') {
    if (disabled || event.button !== 0) return;
    const block = blocks[index];
    if (!block) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(index);
    onMessage('');
    gestureRef.current = {
      pointerId: event.pointerId,
      index,
      mode,
      clientX: event.clientX,
      clientY: event.clientY,
      initialDay: block.weekday,
      initialStart: clockTimeToMinutes(block.startTime),
      initialEnd: clockTimeToMinutes(block.endTime),
      originalBlocks: blocks.map((item) => ({ ...item })),
      originalRestDays: new Set(restDays),
      changed: false,
      invalid: false,
    };
    setDraggingIndex(index);
    stageRef.current?.setPointerCapture?.(event.pointerId);
  }

  function updateGesture(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (disabled || !gesture || gesture.pointerId !== event.pointerId) return;
    const hourDelta = Math.round((event.clientY - gesture.clientY) / ROW_HEIGHT) * EDITOR_STEP_MINUTES;
    const index = gesture.index;
    let candidate: ScheduleBlockInput;
    if (gesture.mode === 'resize') {
      candidate = {
        weekday: gesture.initialDay,
        startTime: editorClock(gesture.initialStart),
        endTime: editorClock(
          Math.max(
            gesture.initialStart + EDITOR_STEP_MINUTES,
            Math.min(EDITOR_END_MINUTES, gesture.initialEnd + hourDelta),
          ),
        ),
      };
    } else {
      const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 0;
      const dayWidth =
        stageWidth > TIME_WIDTH
          ? (stageWidth - TIME_WIDTH) / WEEKDAYS.length
          : DAY_WIDTH;
      const dayDelta = Math.round((event.clientX - gesture.clientX) / dayWidth);
      const dayIndex = Math.max(
        0,
        Math.min(6, WEEKDAYS.indexOf(gesture.initialDay) + dayDelta),
      );
      const duration = gesture.initialEnd - gesture.initialStart;
      const proposedStart = Math.max(
        EDITOR_START_MINUTES,
        Math.min(EDITOR_END_MINUTES - duration, gesture.initialStart + hourDelta),
      );
      candidate = {
        weekday: WEEKDAYS[dayIndex],
        startTime: editorClock(proposedStart),
        endTime: editorClock(proposedStart + duration),
      };
    }
    const nextRestDays = new Set(gesture.originalRestDays);
    if (
      gesture.mode === 'move' &&
      candidate.weekday !== gesture.initialDay &&
      nextRestDays.has(candidate.weekday)
    ) {
      const sourceStillHasWork = gesture.originalBlocks.some(
        (item, otherIndex) =>
          otherIndex !== index && item.weekday === gesture.initialDay,
      );
      if (sourceStillHasWork) {
        gesture.invalid = true;
        return;
      }
      nextRestDays.delete(candidate.weekday);
      nextRestDays.add(gesture.initialDay);
    }
    if (!isValidEditorPlacement(gesture.originalBlocks, index, candidate)) {
      gesture.invalid = true;
      return;
    }
    gesture.invalid = false;
    const original = gesture.originalBlocks[index];
    const changed =
      original.weekday !== candidate.weekday ||
      original.startTime !== candidate.startTime ||
      original.endTime !== candidate.endTime;
    gesture.changed = changed;
    if (changed) {
      const next = gesture.originalBlocks.map((item) => ({ ...item }));
      next[index] = candidate;
      onChange(next, nextRestDays);
    } else {
      onChange(gesture.originalBlocks, gesture.originalRestDays);
    }
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    // An invalid attempt without a valid drag preview has not mutated the
    // draft. Avoid emitting an unnecessary form update on pointer release.
    if ((cancelled || gesture.invalid) && gesture.changed) {
      onChange(gesture.originalBlocks, gesture.originalRestDays);
    }
    if (gesture.invalid) {
      onMessage(
        'That placement is unavailable. Avoid overlapping your own blocks, or free the source day before swapping onto a rest day.',
      );
    }
    if (stageRef.current?.hasPointerCapture?.(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
    setDraggingIndex(null);
  }

  return (
    <>
      <div className="schedule-calendar-scroll">
        <div
          className="schedule-calendar-stage schedule-calendar-editing"
          ref={stageRef}
          onPointerMove={updateGesture}
          onPointerUp={(event) => finishGesture(event)}
          onPointerCancel={(event) => finishGesture(event, true)}
        >
          <div className="schedule-calendar-head-row">
            <div className="schedule-calendar-time-head">Time</div>
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                className={'schedule-calendar-day-head editor-day-header' + (restDays.has(day) ? ' rest-day' : '')}
                aria-label={DAY_NAMES[day] + ': ' + (restDays.has(day) ? 'rest day, make workday' : 'workday, make rest day')}
                aria-pressed={restDays.has(day)}
                disabled={disabled}
                onClick={() => onToggleRest(day)}
                key={day}
              >
                <strong>{DAY_NAMES[day]}</strong>
                <small>{dateLabels[day]}</small>
                <span>{restDays.has(day) ? 'Rest · click to work' : 'Work · click to rest'}</span>
              </button>
            ))}
          </div>
          <div className="schedule-calendar-body">
            <div className="schedule-time-axis">
              {hours.map((minutes) => (
                <div key={minutes}>{formatClock(editorClock(minutes))}</div>
              ))}
            </div>
            {WEEKDAYS.map((day) => {
              const entries: Entry[] = [
                ...teamEntries
                  .filter((entry) => entry.weekday === day)
                  .map((entry) => ({
                    key: entry.key,
                    name: entry.name,
                    start: entry.start,
                    end: entry.end,
                    ownIndex: null,
                  })),
                ...blocks.flatMap((block, index) =>
                  block.weekday === day
                    ? [{
                        key: 'own-' + index,
                        name: currentMemberName,
                        start: clockTimeToMinutes(block.startTime),
                        end: clockTimeToMinutes(block.endTime),
                        ownIndex: index,
                      }]
                    : [],
                ),
              ]
                .filter((entry) => entry.end > EDITOR_START_MINUTES && entry.start < 24 * 60)
                .sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
              const laneEnds: number[] = [];
              const placed = entries.map((entry) => {
                let lane = laneEnds.findIndex((end) => end <= entry.start);
                if (lane < 0) lane = laneEnds.length;
                laneEnds[lane] = entry.end;
                return { ...entry, lane };
              });
              const laneCount = Math.max(1, laneEnds.length);
              return (
                <div
                  className={'schedule-calendar-day' + (restDays.has(day) ? ' rest-day' : '')}
                  aria-label={DAY_NAMES[day]}
                  key={day}
                >
                  {placed.map((entry) => {
                    const style: CSSProperties = {
                      top: ((Math.max(entry.start, EDITOR_START_MINUTES) - EDITOR_START_MINUTES) / 60) * ROW_HEIGHT + 6,
                      height: Math.max(12, ((Math.min(entry.end, 24 * 60) - Math.max(entry.start, EDITOR_START_MINUTES)) / 60) * ROW_HEIGHT - 12),
                      left: 'calc(' + ((100 / laneCount) * entry.lane) + '% + 6px)',
                      width: 'calc(' + (100 / laneCount) + '% - 12px)',
                    };
                    const own = entry.ownIndex !== null;
                    const isSelected = own && entry.ownIndex === selectedIndex;
                    return (
                      <div
                        role={own ? 'button' : undefined}
                        tabIndex={own ? 0 : undefined}
                        aria-label={own ? 'Select ' + DAY_NAMES[day] + ' schedule block, ' + formatClock(editorClock(entry.start)) + ' to ' + formatClock(editorClock(entry.end)) : undefined}
                        aria-pressed={own ? isSelected : undefined}
                        onKeyDown={own ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(entry.ownIndex);
                          }
                        } : undefined}
                        onPointerDown={own && !disabled ? (event) => startGesture(event, entry.ownIndex!, 'move') : undefined}
                        className={'schedule-calendar-block' + (own ? ' mine editable' : '') + (isSelected ? ' selected' : '') + (own && entry.ownIndex === draggingIndex ? ' dragging' : '') + (100 / laneCount < 34 ? ' thin' : '')}
                        key={entry.key}
                        style={style}
                        title={entry.name + ': ' + formatClock(editorClock(entry.start)) + ' - ' + formatClock(editorClock(entry.end))}
                      >
                        <strong>{entry.name}</strong>
                        <small>{formatClock(editorClock(entry.start))} - {formatClock(editorClock(entry.end))}</small>
                        {own && (
                          <div
                            className="schedule-resize-handle"
                            role="button"
                            aria-label="Resize selected schedule block"
                            onPointerDown={disabled ? undefined : (event) => startGesture(event, entry.ownIndex!, 'resize')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="compact-team-week">
        {WEEKDAYS.map((day) => (
          <article key={day}>
            <header>
              <button type="button" disabled={disabled} onClick={() => onToggleRest(day)}>
                {DAY_NAMES[day]} · {restDays.has(day) ? 'Rest (tap for work)' : 'Work (tap for rest)'}
              </button>
              <span>{dateLabels[day]}</span>
            </header>
            <div>
              {blocks.map((block, index) =>
                block.weekday === day ? (
                  <button
                    className={'schedule-compact-edit-block' + (selectedIndex === index ? ' selected' : '')}
                    type="button"
                    key={index}
                    onClick={() => onSelect(index)}
                  >
                    Your block: {formatClock(block.startTime)} – {formatClock(block.endTime)}
                  </button>
                ) : null,
              )}
              {teamEntries.filter((entry) => entry.weekday === day).map((entry) => (
                <div key={entry.key}>
                  {entry.name}: {formatClock(editorClock(entry.start))} – {formatClock(editorClock(entry.end))}
                </div>
              ))}
              {!blocks.some((block) => block.weekday === day) &&
                !teamEntries.some((entry) => entry.weekday === day) &&
                <p>No shared availability</p>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
