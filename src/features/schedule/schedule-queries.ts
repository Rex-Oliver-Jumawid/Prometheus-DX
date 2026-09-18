import { queryOptions } from '@tanstack/react-query';
import {
  MyScheduleResponseSchema,
  TeamScheduleResponseSchema,
} from '../../../shared/contracts/schedule';
import { apiFetch } from '../../lib/api';

export const scheduleKeys = {
  all: ['schedule'] as const,
  team: ['schedule', 'team'] as const,
  mine: ['schedule', 'mine'] as const,
};

export function teamScheduleQuery(accessToken?: string) {
  return queryOptions({
    queryKey: scheduleKeys.team,
    queryFn: () =>
      apiFetch('/schedule/team', TeamScheduleResponseSchema, { accessToken }),
    staleTime: 30_000,
  });
}

export function myScheduleQuery(accessToken?: string) {
  return queryOptions({
    queryKey: scheduleKeys.mine,
    queryFn: () =>
      apiFetch('/schedule/me', MyScheduleResponseSchema, { accessToken }),
    staleTime: 30_000,
  });
}
