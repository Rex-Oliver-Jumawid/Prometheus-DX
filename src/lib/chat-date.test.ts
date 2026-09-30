import { describe, expect, it } from 'vitest';
import { chatDateKey, chatDateLabel, startsNewChatDate } from './chat-date';

describe('chat date grouping', () => {
  it('starts a group for the first message and when the local calendar date changes', () => {
    expect(startsNewChatDate('2026-09-22T10:00:00.000Z')).toBe(true);
    expect(
      startsNewChatDate(
        '2026-09-22T12:30:00.000Z',
        '2026-09-22T10:00:00.000Z',
      ),
    ).toBe(false);
    expect(
      startsNewChatDate(
        '2026-09-23T08:00:00.000Z',
        '2026-09-22T12:30:00.000Z',
      ),
    ).toBe(true);
  });

  it('formats a stable date key and the approved divider label', () => {
    const value = new Date(2026, 8, 22, 12, 0, 0);
    expect(chatDateKey(value)).toBe('2026-09-22');
    expect(chatDateLabel(value)).toBe('Sep 22, 2026');
  });
});
