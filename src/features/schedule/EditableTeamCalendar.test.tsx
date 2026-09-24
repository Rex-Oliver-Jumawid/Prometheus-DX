import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WEEKDAYS, type ScheduleBlockInput, type TeamScheduleResponse } from '../../../shared/contracts/schedule';
import { EditableTeamCalendar } from './EditableTeamCalendar';

const monday: ScheduleBlockInput = { weekday: 'MONDAY', startTime: '10:00', endTime: '12:00' };
const ownId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const members = [{
  id: otherId, fullName: 'Teammate', position: null,
  department: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Engineering', shortLabel: 'Eng' },
  schedule: {
    id: '33333333-3333-4333-8333-333333333333', memberId: otherId,
    targetWeeklyMinutes: 120, createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z',
    blocks: [{ id: '44444444-4444-4444-8444-444444444444', ...monday }],
  },
}] satisfies TeamScheduleResponse['members'];
const dateLabels = Object.fromEntries(WEEKDAYS.map(day => [day, 'Sep 21'])) as Record<(typeof WEEKDAYS)[number], string>;

function setup(initial: ScheduleBlockInput[] = [monday], rest = new Set<(typeof WEEKDAYS)[number]>(['SATURDAY', 'SUNDAY'])) {
  const changed = vi.fn();
  const toggleRest = vi.fn();
  const restChanges = vi.fn();
  const message = vi.fn();
  function Harness() {
    const [blocks, setBlocks] = useState(initial);
    const [restDays, setRestDays] = useState(new Set(rest));
    const [selected, setSelected] = useState<number | null>(null);
    return <EditableTeamCalendar members={members} currentMemberId={ownId}
      currentMemberName="Me" dateLabels={dateLabels} blocks={blocks} restDays={restDays}
      selectedIndex={selected} onSelect={setSelected}
      onChange={(next, nextRestDays) => {
        changed(next);
        setBlocks(next);
        if (nextRestDays) {
          restChanges(new Set(nextRestDays));
          setRestDays(new Set(nextRestDays));
        }
      }}
      onToggleRest={(day) => { toggleRest(day); }}
      onMessage={message} />;
  }
  const view = render(<Harness />);
  const stage = view.container.querySelector('.schedule-calendar-stage')!;
  const mine = () => screen.getByRole('button', { name: /Select Monday schedule block, 10:00 AM to 12:00 PM/ });
  return { ...view, stage, mine, changed, restChanges, toggleRest, message };
}

describe('EditableTeamCalendar pointer gestures', () => {
  it('moves a block vertically and horizontally while retaining selection', () => {
    const s = setup();
    fireEvent.pointerDown(s.mine(), { pointerId: 1, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 1, clientX: 327, clientY: 244 });
    fireEvent.pointerUp(s.stage, { pointerId: 1 });
    expect(s.changed).toHaveBeenLastCalledWith([{ weekday: 'TUESDAY', startTime: '11:00', endTime: '13:00' }]);
    expect(screen.getByRole('button', { name: /Select Tuesday schedule block/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('resizes only the current member block with the bottom pointer handle', () => {
    const s = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Resize selected schedule block' }), { pointerId: 2, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 2, clientX: 200, clientY: 244 });
    fireEvent.pointerUp(s.stage, { pointerId: 2 });
    expect(s.changed).toHaveBeenLastCalledWith([{ weekday: 'MONDAY', startTime: '10:00', endTime: '13:00' }]);
  });

  it('rejects moving onto a rest day when the source still has another block', () => {
    const s = setup([monday, { weekday: 'MONDAY', startTime: '13:00', endTime: '15:00' }]);
    fireEvent.pointerDown(s.mine(), { pointerId: 3, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 3, clientX: 835, clientY: 200 });
    fireEvent.pointerUp(s.stage, { pointerId: 3 });
    expect(s.changed).not.toHaveBeenCalled();
    expect(s.message).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
  });

  it('swaps the source rest day when moving its only block onto a rest day', () => {
    const s = setup();
    fireEvent.pointerDown(s.mine(), { pointerId: 5, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 5, clientX: 835, clientY: 200 });
    fireEvent.pointerUp(s.stage, { pointerId: 5 });
    expect(s.changed).toHaveBeenLastCalledWith([
      { weekday: 'SATURDAY', startTime: '10:00', endTime: '12:00' },
    ]);
    expect(s.restChanges).toHaveBeenLastCalledWith(new Set(['MONDAY', 'SUNDAY']));
    expect(screen.getByRole('button', { name: /Saturday: workday, make rest day/ })).toBeInTheDocument();
  });

  it('rejects overlap with another own block but allows overlap with teammates', () => {
    const s = setup([monday, { weekday: 'TUESDAY', startTime: '10:00', endTime: '12:00' }]);
    fireEvent.pointerDown(s.mine(), { pointerId: 4, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 4, clientX: 327, clientY: 200 });
    fireEvent.pointerUp(s.stage, { pointerId: 4 });
    expect(s.changed).not.toHaveBeenCalled();
    expect(s.message).toHaveBeenCalledWith(expect.stringContaining('overlapping'));
    expect(s.container.querySelectorAll('.schedule-calendar-block')).toHaveLength(3);
  });

  it('restores the original draft after a valid preview followed by an overlapping destination', () => {
    const s = setup([monday, { weekday: 'TUESDAY', startTime: '10:00', endTime: '12:00' }]);
    fireEvent.pointerDown(s.mine(), { pointerId: 6, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 6, clientX: 200, clientY: 244 });
    expect(s.changed).toHaveBeenLastCalledWith([
      { weekday: 'MONDAY', startTime: '11:00', endTime: '13:00' },
      { weekday: 'TUESDAY', startTime: '10:00', endTime: '12:00' },
    ]);
    fireEvent.pointerMove(s.stage, { pointerId: 6, clientX: 327, clientY: 200 });
    fireEvent.pointerUp(s.stage, { pointerId: 6 });
    expect(s.changed).toHaveBeenLastCalledWith([
      monday,
      { weekday: 'TUESDAY', startTime: '10:00', endTime: '12:00' },
    ]);
    expect(s.message).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
    expect(s.mine()).toBeInTheDocument();
  });

  it('keeps a boundary block fully inside its day column', () => {
    setup([{ weekday: 'MONDAY', startTime: '07:00', endTime: '10:00' }]);
    const block = screen.getByRole('button', { name: /Select Monday schedule block, 7:00 AM to 10:00 AM/ });
    expect(block).toHaveStyle({ top: '6px', height: '120px' });
    expect((block as HTMLElement).style.width).toContain('- 12px');
  });

  it('delegates rest-day header clicks to the draft owner', () => {
    const s = setup();
    fireEvent.click(screen.getByRole('button', { name: /Saturday: rest day/ }));
    expect(s.toggleRest).toHaveBeenCalledWith('SATURDAY');
  });
});
