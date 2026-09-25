import { describe, expect, it } from 'vitest';
import {
  calendarLaneDivider,
  calendarLaneStyle,
  layoutScheduleLanes,
} from './schedule-lanes';

describe('the reference calendar lane layout', () => {
  it('uses the whole day column if different members never overlap', () => {
    const entries = [
      { memberId: 'a', start: 9, end: 11 },
      { memberId: 'b', start: 11, end: 14 },
      { memberId: 'a', start: 15, end: 18 },
    ];
    const layout = layoutScheduleLanes(entries, ['a', 'b']);
    expect(layout).toMatchObject({ laneCount: 1, split: false });
    expect(layout.placed.map((item) => item.lane)).toEqual([0, 0, 0]);
    expect(calendarLaneStyle(0, 1).width).toBe('calc(100% - 10px)');
  });

  it('keeps a stable lane per person all day as soon as two people overlap', () => {
    const entries = [
      { memberId: 'b', start: 10, end: 13 },
      { memberId: 'a', start: 9, end: 12 },
      { memberId: 'a', start: 14, end: 17 },
      { memberId: 'c', start: 19, end: 21 },
    ];
    const layout = layoutScheduleLanes(entries, ['a', 'b', 'c']);
    expect(layout).toMatchObject({ laneCount: 3, split: true });
    expect(layout.placed.map((item) => item.lane)).toEqual([1, 0, 0, 2]);
    expect(calendarLaneStyle(1, 2)).toEqual({
      left: 'calc(50% + 1.5px)',
      width: 'calc(50% - 6.5px)',
    });
    expect(calendarLaneDivider(1, 2)).toBe('calc(50% + 0px)');
  });

  it('respects member order, never splits a same-member overlap, and ignores touching edges', () => {
    const sameMember = [
      { memberId: 'a', start: 8, end: 11 },
      { memberId: 'a', start: 9, end: 12 },
    ];
    expect(layoutScheduleLanes(sameMember, ['a']).split).toBe(false);
    expect(layoutScheduleLanes([
      { memberId: 'a', start: 8, end: 10 },
      { memberId: 'b', start: 10, end: 12 },
    ], ['b', 'a']).split).toBe(false);
    const layout = layoutScheduleLanes([
      { memberId: 'b', start: 8, end: 12 },
      { memberId: 'a', start: 9, end: 13 },
    ], ['a', 'b']);
    expect(layout.placed.map((item) => item.lane)).toEqual([1, 0]);
  });
});
