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
  const message = vi.fn();
  function Harness() {
    const [blocks, setBlocks] = useState(initial);
    const [selected, setSelected] = useState<number | null>(null);
    return <EditableTeamCalendar members={members} currentMemberId={ownId}
      currentMemberName="Me" dateLabels={dateLabels} blocks={blocks} restDays={rest}
      selectedIndex={selected} onSelect={setSelected}
      onChange={next => { changed(next); setBlocks(next); }}
      onToggleRest={toggleRest} onMessage={message} />;
  }
  const view = render(<Harness />);
  const stage = view.container.querySelector('.schedule-calendar-stage')!;
  const mine = () => screen.getByRole('button', { name: /Select Monday schedule block/ });
  return { ...view, stage, mine, changed, toggleRest, message };
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

  it('rejects movement onto a rest day without changing the draft', () => {
    const s = setup();
    fireEvent.pointerDown(s.mine(), { pointerId: 3, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(s.stage, { pointerId: 3, clientX: 835, clientY: 200 });
    fireEvent.pointerUp(s.stage, { pointerId: 3 });
    expect(s.changed).not.toHaveBeenCalled();
    expect(s.message).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
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

  it('delegates rest-day header clicks to the draft owner', () => {
    const s = setup();
    fireEvent.click(screen.getByRole('button', { name: /Saturday: rest day/ }));
    expect(s.toggleRest).toHaveBeenCalledWith('SATURDAY');
  });
});
