import { queryOptions } from '@tanstack/react-query';
import {
  CurrentWorkSessionResponseSchema,
  TeamWorkSummaryResponseSchema,
  WorkSessionHistoryResponseSchema,
} from '../../../shared/contracts/work-session';
import { apiFetch } from '../../lib/api';

export const workSessionKeys = {
  all: ['work-sessions'] as const,
  current: ['work-sessions', 'current'] as const,
  history: (week?: string) =>
    ['work-sessions', 'history', week ?? 'current'] as const,
};

export const teamWorkKeys = {
  all: ['team-work'] as const,
  summary: (week?: string) => ['team-work', week ?? 'current'] as const,
};

export function currentWorkSessionQuery(accessToken?: string) {
  return queryOptions({
    queryKey: workSessionKeys.current,
    queryFn: () =>
      apiFetch('/work-sessions/current', CurrentWorkSessionResponseSchema, {
        accessToken,
      }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function workSessionHistoryQuery(accessToken?: string, week?: string) {
  return queryOptions({
    queryKey: workSessionKeys.history(week),
    queryFn: () =>
      apiFetch(
        `/work-sessions/history${week ? `?week=${week}` : ''}`,
        WorkSessionHistoryResponseSchema,
        { accessToken },
      ),
    staleTime: 10_000,
  });
}

export function teamWorkSummaryQuery(accessToken?: string, week?: string) {
  return queryOptions({
    queryKey: teamWorkKeys.summary(week),
    queryFn: () =>
      apiFetch(
        `/team${week ? `?week=${week}` : ''}`,
        TeamWorkSummaryResponseSchema,
        { accessToken },
      ),
    staleTime: 10_000,
  });
}
