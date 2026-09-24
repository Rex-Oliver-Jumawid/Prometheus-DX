import { queryOptions } from '@tanstack/react-query';
import { HomeDashboardResponseSchema } from '../../../shared/contracts/home';
import { apiFetch } from '../../lib/api';

export const homeKeys = {
  all: ['home'] as const,
  dashboard: ['home', 'dashboard'] as const,
};

export function homeDashboardQuery(accessToken?: string) {
  return queryOptions({
    queryKey: homeKeys.dashboard,
    queryFn: ({ signal }) =>
      apiFetch('/home', HomeDashboardResponseSchema, {
        accessToken,
        signal,
      }),
    staleTime: 2_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}
