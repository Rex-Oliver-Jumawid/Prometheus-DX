/**
 * The weekly calendar follows .model/finalmodel.html: when any two different
 * members overlap on a day, every member keeps one stable vertical lane for
 * that entire day. Without cross-member overlap, blocks use the full day.
 * A member's multiple non-overlapping blocks always reuse their own lane.
 */
export type MemberLaneEntry = {
  memberId: string;
  start: number;
  end: number;
};

export function layoutScheduleLanes<T extends MemberLaneEntry>(
  entries: readonly T[],
  memberOrder: readonly string[],
): { placed: Array<T & { lane: number }>; laneCount: number; split: boolean } {
  const split = entries.some((left, index) =>
    entries.some((right, rightIndex) =>
      rightIndex > index &&
      left.memberId !== right.memberId &&
      left.start < right.end &&
      right.start < left.end,
    ),
  );

  if (!split) {
    return {
      placed: entries.map((entry) => ({ ...entry, lane: 0 })),
      laneCount: 1,
      split: false,
    };
  }

  const visible = new Set(entries.map((entry) => entry.memberId));
  const ordered = [...new Set([
    ...memberOrder.filter((id) => visible.has(id)),
    ...entries.map((entry) => entry.memberId),
  ])];
  const laneByMember = new Map(ordered.map((memberId, index) => [memberId, index]));

  return {
    placed: entries.map((entry) => ({
      ...entry,
      lane: laneByMember.get(entry.memberId) ?? 0,
    })),
    laneCount: ordered.length,
    split: true,
  };
}

/** Match the prototype's 5px column inset and 3px between member lanes. */
export function calendarLaneStyle(lane: number, count: number) {
  const laneCount = Math.max(1, count);
  const unavailableWidth = 10 + 3 * (laneCount - 1);
  return {
    left: `calc(${(100 * lane) / laneCount}% + ${5 + 3 * lane - (unavailableWidth * lane) / laneCount}px)`,
    width: `calc(${100 / laneCount}% - ${unavailableWidth / laneCount}px)`,
  };
}

/** Position the vertical separator in the middle of the 3px lane gap. */
export function calendarLaneDivider(lane: number, count: number): string {
  const laneCount = Math.max(1, count);
  const unavailableWidth = 10 + 3 * (laneCount - 1);
  return `calc(${(100 * lane) / laneCount}% + ${5 + 3 * (lane - 1) - (unavailableWidth * lane) / laneCount + 1.5}px)`;
}
